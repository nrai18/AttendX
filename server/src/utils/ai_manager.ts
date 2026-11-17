import { GoogleGenAI } from '@google/genai';

export class AIManager {
  private static keys: string[] = [];
  private static currentKeyIndex = 0;
  private static aiInstances: Record<string, GoogleGenAI> = {};
  
  // Strict compliance with AGENTS.md (No 2.0 or 1.5 models)
  private static readonly SAFE_CASCADE = [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite'
  ];

  private static init() {
    if (this.keys.length === 0) {
      const keysStr = process.env.GEMINI_API_KEY || '';
      this.keys = keysStr.split(',').map(k => k.trim()).filter(k => k.length > 0);
      if (this.keys.length === 0) {
          this.keys = [keysStr];
      }
    }
  }

  public static async generateContent(options: any): Promise<any> {
    this.init();
    const startTime = Date.now();
    const TIMEOUT_MS = 110000; // 110s max backend limit to prevent 120s frontend timeout
    
    // Priority: Try the requested model first (if it's safe), then fallback to safe cascade
    let modelsToTry = [options.model];
    if (!options.model || options.model.includes('1.5') || options.model.includes('2.0') || options.model.includes('preview')) {
       modelsToTry = [...this.SAFE_CASCADE];
    } else {
       // Append cascade for fallbacks
       modelsToTry = [options.model, ...this.SAFE_CASCADE].filter((val, index, self) => self.indexOf(val) === index);
    }
    
    const hasInlineData = Array.isArray(options.contents)
      ? options.contents.some(
          (c: any) =>
            Array.isArray(c?.parts) &&
            c.parts.some((p: any) => Boolean(p?.inlineData)),
        )
      : false;

    for (let mIndex = 0; mIndex < modelsToTry.length; mIndex++) {
      const currentModel = modelsToTry[mIndex];
      const modelOptions = { ...options, model: currentModel };

      // Strip thinkingConfig proactively on lite models, otherwise normalize thinkingLevel -> thinkingBudget
      if (modelOptions.config?.thinkingConfig) {
        modelOptions.config = { ...modelOptions.config };
        if (currentModel.includes('lite')) {
          delete modelOptions.config.thinkingConfig;
        } else {
          const tc = { ...modelOptions.config.thinkingConfig };
          if ('thinkingLevel' in tc) {
            delete tc.thinkingLevel;
            if (!('thinkingBudget' in tc)) {
              tc.thinkingBudget = 0;
            }
          }
          modelOptions.config.thinkingConfig = tc;
        }
      }

      let attemptsOnThisModel = 0;
      let unavailableErrorsOnModel = 0;
      const maxAttempts = this.keys.length;

      while (attemptsOnThisModel < maxAttempts) {
        const key = this.keys[this.currentKeyIndex];
        let ai = this.aiInstances[key];
        if (!ai) {
          ai = new GoogleGenAI({ apiKey: key });
          this.aiInstances[key] = ai;
        }

        const elapsed = Date.now() - startTime;
        const remainingBudget = TIMEOUT_MS - elapsed;
        if (remainingBudget <= 2000) {
          throw new Error('AI request took too long. Failing fast to prevent 5-minute hang.');
        }

        const ttftTimeout = Math.min(
          currentModel.includes('pro') ? 60000 : hasInlineData ? 55000 : 30000,
          remainingBudget,
        );
        const controller = new AbortController();
        let ttftTimer: ReturnType<typeof setTimeout> | null = null;

        try {
          // Streaming Token Accumulation with real AbortController cancellation on TTFT timeout
          ttftTimer = setTimeout(() => {
            controller.abort(new Error(`AI TTFT timeout exceeded (${ttftTimeout}ms limit)`));
          }, ttftTimeout);

          const attemptOptions = {
            ...modelOptions,
            config: {
              ...(modelOptions.config || {}),
              abortSignal: controller.signal,
            },
          };

          const responseStream: any = await ai.models.generateContentStream(attemptOptions);

          let fullText = "";
          for await (const chunk of responseStream) {
            if (ttftTimer) {
              clearTimeout(ttftTimer);
              ttftTimer = null;
            }
            if (chunk.text) {
              fullText += chunk.text;
            }
          }

          return {
            text: fullText,
            candidates: responseStream?.candidates || [],
            toString: () => fullText,
            valueOf: () => fullText
          };
        } catch (error: any) {
          attemptsOnThisModel++;
          const status = error.status || error.code || 500;
          const rawMsg = controller.signal.aborted
            ? (controller.signal.reason?.message || `AI TTFT timeout exceeded (${ttftTimeout}ms limit)`)
            : (error.message || 'Unknown error');
          const msg = rawMsg;
          let cleanMsg = rawMsg;
          try {
            if (rawMsg.includes('{')) {
              const jsonMatch = rawMsg.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsedErr = JSON.parse(jsonMatch[0]);
                cleanMsg = parsedErr?.error?.message || parsedErr?.message || cleanMsg;
                if (typeof cleanMsg === 'string' && cleanMsg.includes('{')) {
                  const nested = JSON.parse(cleanMsg.match(/\{[\s\S]*\}/)?.[0] || '{}');
                  cleanMsg = nested?.error?.message || nested?.message || cleanMsg;
                }
              }
            }
          } catch {}
          if (typeof cleanMsg === 'string' && cleanMsg.length > 200) cleanMsg = cleanMsg.slice(0, 200) + '...';

          console.warn(`[AIManager] Model ${currentModel} on Key ${this.currentKeyIndex} failed (${status} - ${cleanMsg}).`);

          if (status === 400 && modelOptions.config?.thinkingConfig) {
            console.warn(`[AIManager] 400 with thinkingConfig on ${currentModel}; stripping thinkingConfig and retrying...`);
            modelOptions.config = { ...modelOptions.config };
            delete modelOptions.config.thinkingConfig;
            attemptsOnThisModel--; // Config normalization should not consume a key attempt
            continue;
          }

          if (status === 400) {
            console.warn(`[AIManager] 400 Bad Request on ${currentModel}; advancing to next fallback model...`);
            break;
          }

          if (status === 503 || msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('overloaded')) {
            unavailableErrorsOnModel++;
            if (unavailableErrorsOnModel < Math.min(3, maxAttempts)) {
              console.warn(`[AIManager] 503 Unavailable on Key ${this.currentKeyIndex}; trying next API key (${unavailableErrorsOnModel}/3)...`);
              this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
              await new Promise((r) => setTimeout(r, 150));
              continue;
            }
            console.warn(`[AIManager] Repeated 503 Unavailable on ${currentModel}. Downgrading model...`);
            break;
          }

          if (status === 404 || msg.includes('404') || msg.includes('not found')) {
            console.warn(`[AIManager] 404 Not Found. Downgrading model immediately...`);
            break;
          }

          if (status === 429 || msg.includes('429') || msg.includes('Quota')) {
            console.warn(`[AIManager] 429 Quota Exceeded. Rotating to next API key horizontally...`);
            this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
            continue;
          }

          console.warn(`[AIManager] Transient error. Rotating to next API key...`);
          this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
        } finally {
          if (ttftTimer) {
            clearTimeout(ttftTimer);
            ttftTimer = null;
          }
        }
      }
    }
    
    throw new Error('All provided Gemini API keys and fallback models were exhausted.');
  }

  public static async generateContentStream(options: any): Promise<any> {
    this.init();
    const key = this.keys[this.currentKeyIndex];
    let ai = this.aiInstances[key];
    if (!ai) {
      ai = new GoogleGenAI({ apiKey: key });
      this.aiInstances[key] = ai;
    }
    const model = options.model || "gemini-3.8-flash";
    return ai.models.generateContentStream({ ...options, model });
  }
}
