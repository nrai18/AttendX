
import { GoogleGenAI } from '@google/genai';

export class AIManager {
  private static keys: string[] = [];
  private static currentKeyIndex = 0;
  
  // The user's requested model cascade
  private static readonly MODEL_CASCADE = [
    'gemini-3.1-pro-preview',
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
    
    // Iterate through the model cascade
    for (let mIndex = 0; mIndex < this.MODEL_CASCADE.length; mIndex++) {
      const currentModel = this.MODEL_CASCADE[mIndex];
      const modelOptions = { ...options, model: currentModel };
      
      let attemptsOnThisModel = 0;
      const maxAttempts = this.keys.length;

      while (attemptsOnThisModel < maxAttempts) {
        const key = this.keys[this.currentKeyIndex];
        const ai = new GoogleGenAI({ apiKey: key });
        
        try {
          const response = await ai.models.generateContent(modelOptions);
          return response;
        } catch (error: any) {
          attemptsOnThisModel++;
          const status = error.status || error.code || 500;
          const msg = error.message || 'Unknown error';
          
          console.warn(`[AIManager] Model ${currentModel} on Key ${this.currentKeyIndex} failed (${status} - ${msg}).`);
          
          // If the model is globally overloaded (503), don't waste other API keys trying the same overloaded model
          if (status === 503 || msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('overloaded')) {
             console.warn(`[AIManager] 503 Unavailable detected. Downgrading model immediately...`);
             break; 
          }
          
          // If the model is completely deprecated/deleted (404), downgrade immediately
          if (status === 404 || msg.includes('404') || msg.includes('not found')) {
             console.warn(`[AIManager] 404 Not Found (Model missing). Downgrading model immediately...`);
             break;
          }

          // For 429 (Quota Exceeded) or transient errors, rotate to the next API key horizontally.
          // Since the user is supplying multiple keys (comma-separated), they are likely from different 
          // projects, so horizontal rotation is exactly what they want to bypass free tier limits.
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

