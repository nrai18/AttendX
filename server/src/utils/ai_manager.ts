import { GoogleGenAI } from '@google/genai';

export class AIManager {
  private static keys: string[] = [];
  private static currentKeyIndex = 0;
  private static aiInstances: Record<string, GoogleGenAI> = {};
  
  // Strict compliance with AGENTS.md (No 3.5, 2.0, or 1.5 models)
  private static readonly SAFE_CASCADE = [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-pro'
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
    if (!options.model || options.model.includes('3.5') || options.model.includes('1.5') || options.model.includes('2.0') || options.model.includes('-lite') || options.model.includes('preview')) {
       modelsToTry = [...this.SAFE_CASCADE];
    } else {
       // Append cascade for fallbacks
       modelsToTry = [options.model, ...this.SAFE_CASCADE].filter((val, index, self) => self.indexOf(val) === index);
    }
    
    for (let mIndex = 0; mIndex < modelsToTry.length; mIndex++) {
      const currentModel = modelsToTry[mIndex];
      const modelOptions = { ...options, model: currentModel };
      
      let attemptsOnThisModel = 0;
      const maxAttempts = this.keys.length;

      while (attemptsOnThisModel < maxAttempts) {
        const key = this.keys[this.currentKeyIndex];
        let ai = this.aiInstances[key];
        if (!ai) {
          ai = new GoogleGenAI({ apiKey: key });
          this.aiInstances[key] = ai;
        }
        
        if (Date.now() - startTime > TIMEOUT_MS) {
          throw new Error('AI request took too long. Failing fast to prevent 5-minute hang.');
        }
        
        try {
          // PER-REQUEST TIMEOUT: 25s for flash, 60s for pro models
          const perRequestTimeout = currentModel.includes('pro') ? 60000 : 25000;
          
          return await Promise.race([
             ai.models.generateContent(modelOptions),
             new Promise((_, reject) => setTimeout(() => reject(new Error(`AI request timeout exceeded (${perRequestTimeout}ms limit)`)), perRequestTimeout))
          ]);
        } catch (error: any) {
          attemptsOnThisModel++;
          const status = error.status || error.code || 500;
          const msg = error.message || 'Unknown error';
          
          console.warn(`[AIManager] Model ${currentModel} on Key ${this.currentKeyIndex} failed (${status} - ${msg}).`);
          
          if (status === 503 || msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('overloaded')) {
             console.warn(`[AIManager] 503 Unavailable detected. Downgrading model immediately...`);
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
        }
      }
    }
    
    throw new Error('All provided Gemini API keys and fallback models were exhausted.');
  }
}
