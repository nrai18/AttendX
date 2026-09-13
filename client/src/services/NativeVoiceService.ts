import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

export class NativeVoiceService {
  static async requestPermissions() {
    if (Capacitor.isNativePlatform()) {
      const hasPermission = await SpeechRecognition.checkPermissions();
      if (hasPermission.speechRecognition !== 'granted') {
        await SpeechRecognition.requestPermissions();
      }
    }
  }

  static async startListening(onResult: (text: string) => void, onEnd: () => void) {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      await this.requestPermissions();
      
      // Capacitor plugin uses an event listener for partial results
      SpeechRecognition.addListener('partialResults', (data: any) => {
         if (data.matches && data.matches.length > 0) {
            onResult(data.matches[0]);
         }
      });
      
      const result = await SpeechRecognition.start({
        language: 'en-IN',
        maxResults: 1,
        prompt: 'Listening...',
        partialResults: true,
        popup: false,
      });

      if (result.matches && result.matches.length > 0) {
        onResult(result.matches[0]);
      }
      onEnd();
      return true;
    } catch (err) {
      console.error("Native speech recognition error:", err);
      onEnd();
      return false;
    }
  }

  static async stopListening() {
    if (Capacitor.isNativePlatform()) {
      try {
        await SpeechRecognition.stop();
      } catch (e) {}
    }
  }

  static async speak(text: string) {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const cleanText = text.replace(/[#*_`]/g, "").replace(/\[.*?\]/g, "").trim();
      await TextToSpeech.speak({
        text: cleanText,
        lang: 'en-IN',
        rate: 1.05,
        pitch: 1.0,
        volume: 1.0,
      });
      return true;
    } catch (e) {
      console.error("Native TTS error:", e);
      return false;
    }
  }

  static async stopSpeaking() {
    if (Capacitor.isNativePlatform()) {
      try {
        await TextToSpeech.stop();
      } catch (e) {}
    }
  }
}
