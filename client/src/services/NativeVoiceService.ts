import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

export interface VoiceListenOptions {
  onPartialResult?: (text: string) => void;
  onFinalResult?: (text: string) => void;
  onError?: (error: any) => void;
  onEnd?: () => void;
  lang?: string;
}

export interface VoiceSpeakOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

export class NativeVoiceService {
  private static isListeningState = false;
  private static activeWebRecognition: any = null;

  /**
   * Check whether speech recognition is available on the current device / browser.
   */
  static async isAvailable(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await SpeechRecognition.available();
        return Boolean(res && res.available);
      } catch {
        return false;
      }
    }
    return (
      typeof window !== 'undefined' &&
      Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    );
  }

  /**
   * Request microphone and speech recognition permissions.
   * Returns true only if permission is granted.
   */
  static async requestPermissions(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const hasPermission = await SpeechRecognition.checkPermissions();
        if (hasPermission.speechRecognition === 'granted') {
          return true;
        }
        const requested = await SpeechRecognition.requestPermissions();
        return requested.speechRecognition === 'granted';
      } catch (err) {
        console.warn("Speech recognition permission request failed:", err);
        return false;
      }
    }
    return true;
  }

  /**
   * Start listening for voice input.
   * Flushes any active audio prior to listening to avoid audio feedback.
   * Cleans up listener leaks before starting new sessions.
   */
  static async startListening(
    optionsOrOnResult: VoiceListenOptions | ((text: string) => void),
    maybeOnEnd?: () => void
  ): Promise<boolean> {
    const options: VoiceListenOptions =
      typeof optionsOrOnResult === 'function'
        ? {
            onPartialResult: optionsOrOnResult,
            onFinalResult: optionsOrOnResult,
            onEnd: maybeOnEnd,
          }
        : optionsOrOnResult;

    // Audio clash prevention: stop assistant speech first to avoid capturing output audio
    await this.stopSpeaking();
    await this.stopListening();

    if (Capacitor.isNativePlatform()) {
      try {
        const granted = await this.requestPermissions();
        if (!granted) {
          options.onError?.(new Error("Microphone permission not granted"));
          options.onEnd?.();
          return false;
        }

        // Prevent listener leaks: remove existing listeners first
        await SpeechRecognition.removeAllListeners();

        await SpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
          if (data.matches && data.matches.length > 0) {
            const transcript = data.matches[0];
            options.onPartialResult?.(transcript);
            options.onFinalResult?.(transcript);
          }
        });

        this.isListeningState = true;
        const result = await SpeechRecognition.start({
          language: options.lang || 'en-IN',
          maxResults: 1,
          prompt: 'Listening...',
          partialResults: true,
          popup: false,
        });

        if (result && result.matches && result.matches.length > 0) {
          const transcript = result.matches[0];
          options.onFinalResult?.(transcript);
        }
        this.isListeningState = false;
        options.onEnd?.();
        return true;
      } catch (err) {
        console.error("Native speech recognition error:", err);
        this.isListeningState = false;
        options.onError?.(err);
        options.onEnd?.();
        return false;
      }
    } else {
      // Safe Web browser fallback
      if (typeof window === 'undefined') {
        options.onEnd?.();
        return false;
      }

      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognitionClass) {
        console.warn("Speech recognition is not supported in this browser.");
        options.onError?.(new Error("Speech recognition is not supported in this browser."));
        options.onEnd?.();
        return false;
      }

      try {
        const rec = new SpeechRecognitionClass();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = options.lang || "en-IN";

        rec.onresult = (event: any) => {
          let currentTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          if (currentTranscript) {
            options.onPartialResult?.(currentTranscript);
            options.onFinalResult?.(currentTranscript);
          }
        };

        rec.onerror = (event: any) => {
          console.warn("Web speech recognition error:", event.error);
          this.isListeningState = false;
          this.activeWebRecognition = null;
          options.onError?.(event);
        };

        rec.onend = () => {
          this.isListeningState = false;
          this.activeWebRecognition = null;
          options.onEnd?.();
        };

        this.activeWebRecognition = rec;
        this.isListeningState = true;
        rec.start();
        return true;
      } catch (err) {
        console.error("Web speech recognition start error:", err);
        this.isListeningState = false;
        this.activeWebRecognition = null;
        options.onError?.(err);
        options.onEnd?.();
        return false;
      }
    }
  }

  /**
   * Stop speech recognition across native and web platforms.
   */
  static async stopListening(): Promise<void> {
    this.isListeningState = false;
    if (Capacitor.isNativePlatform()) {
      try {
        await SpeechRecognition.stop();
      } catch {
        // ignore
      }
      try {
        await SpeechRecognition.removeAllListeners();
      } catch {
        // ignore
      }
    } else if (this.activeWebRecognition) {
      try {
        this.activeWebRecognition.abort();
      } catch {
        // ignore
      }
      this.activeWebRecognition = null;
    }
  }

  /**
   * Speak clean text aloud.
   * Flushes currently playing audio before starting a new utterance to prevent voice overlap.
   */
  static async speak(text: string, options?: VoiceSpeakOptions): Promise<boolean> {
    const cleanText = this.cleanTextForSpeech(text);
    if (!cleanText) return false;

    // Audio clash prevention: stop any ongoing audio before starting new playback
    await this.stopSpeaking();

    try {
      options?.onStart?.();
      await TextToSpeech.speak({
        text: cleanText,
        lang: options?.lang || 'en-IN',
        rate: options?.rate ?? 1.05,
        pitch: options?.pitch ?? 1.0,
        volume: options?.volume ?? 1.0,
        queueStrategy: 0, // QueueStrategy.Flush on native
      });
      options?.onEnd?.();
      return true;
    } catch (err) {
      console.error("TextToSpeech error:", err);
      options?.onError?.(err);
      options?.onEnd?.();
      return false;
    }
  }

  /**
   * Explicitly stop any active text-to-speech audio across platforms.
   */
  static async stopSpeaking(): Promise<void> {
    try {
      await TextToSpeech.stop();
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }

  /**
   * Strip markdown, system prompt tokens, and URLs to ensure natural TTS audio.
   */
  static cleanTextForSpeech(text: string): string {
    if (!text) return "";
    let clean = text;

    // Strip bracketed system prompt markers e.g. [SYSTEM_IDENTITY], [CONFIRMATION_REQUIRED]
    clean = clean.replace(/\[[A-Z0-9_]+\]/g, "");

    // Transform markdown links [Anchor Text](http://...) -> Anchor Text
    clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

    // Remove remaining bracketed annotations or citations: [1], [2], etc.
    clean = clean.replace(/\[.*?\]/g, "");

    // Remove code blocks and inline code markers
    clean = clean.replace(/```[\s\S]*?```/g, "");
    clean = clean.replace(/`/g, "");

    // Remove headers (# Title)
    clean = clean.replace(/^#+\s+/gm, "");

    // Remove bold, italic, strikethrough markers
    clean = clean.replace(/[*_~]/g, "");

    // Remove bullet points / blockquotes at line starts
    clean = clean.replace(/^[\*\-+>]\s+/gm, "");

    // Normalize spacing and trim
    clean = clean.replace(/\s+/g, " ").trim();

    return clean;
  }
}

