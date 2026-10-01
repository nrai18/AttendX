import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capgo/capacitor-speech-recognition';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { api } from '../lib/api.ts';

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
  voice?: number;
  elevenlabsVoiceId?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
  onDuration?: (durationMs: number) => void;
  autoResumeListening?: boolean;
  listenOptions?: VoiceListenOptions;
}

export class NativeVoiceService {
  private static isListeningState = false;
  private static isSpeakingState = false;
  private static isLoopActive = false;
  private static continuousListenOptions: VoiceListenOptions | null = null;
  private static activeWebRecognition: any = null;
  private static startPromise: Promise<any> | null = null; // FE-H09 FIX: Promise lock for native plugin start
  private static currentAudio: HTMLAudioElement | null = null;
  private static currentSessionId = 0;
  private static pendingStartPromise: Promise<any> | null = null;
  private static cooldownTimeoutId: any = null;

  /**
   * Check whether speech recognition is currently active.
   */
  static isListening(): boolean {
    return this.isListeningState;
  }

  /**
   * Check whether text-to-speech audio is currently playing.
   */
  static isSpeaking(): boolean {
    return this.isSpeakingState;
  }

  /**
   * Check whether the continuous hands-free voice loop is active.
   */
  static isContinuousLoop(): boolean {
    return this.isLoopActive;
  }

  /**
   * Start a continuous hands-free voice loop with designated listen options.
   */
  static startContinuousLoop(listenOptions: VoiceListenOptions): void {
    this.isLoopActive = true;
    this.continuousListenOptions = listenOptions;
  }

  /**
   * Immediately terminate continuous hands-free voice loop, halting both mic and audio.
   */
  static async stopContinuousLoop(): Promise<void> {
    this.currentSessionId++;
    this.isLoopActive = false;
    this.continuousListenOptions = null;
    if (this.cooldownTimeoutId) {
      clearTimeout(this.cooldownTimeoutId);
      this.cooldownTimeoutId = null;
    }
    await this.stopSpeaking();
    await this.stopListening();
  }

  /**
   * Bind voice change event listener across platforms.
   */
  static bindVoicesChanged(callback: () => void): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = callback;
    }
  }

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
        let isGranted = false;
        
        // 1. Force use VoiceRecorder because it has a perfectly reliable native Android mic prompt
        const micStatus = await VoiceRecorder.hasAudioRecordingPermission();
        if (micStatus.value) {
          isGranted = true;
        } else {
          const request = await VoiceRecorder.requestAudioRecordingPermission();
          if (request.value) {
            isGranted = true;
          }
        }

        // 2. Also sync with the SpeechRecognition plugin
        const speechStatus = await SpeechRecognition.checkPermissions();
        if (speechStatus.speechRecognition !== 'granted') {
          await SpeechRecognition.requestPermissions();
        }

        return isGranted;
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

    // Clear any pending cooldown timer to avoid duplicate or leaked restarts
    if (this.cooldownTimeoutId) {
      clearTimeout(this.cooldownTimeoutId);
      this.cooldownTimeoutId = null;
    }

    // Audio clash prevention: stop assistant speech first to avoid capturing output audio
    await this.stopSpeaking();
    await this.stopListening();
    // Allow the native Android speech engine to fully release before restarting
    if (Capacitor.isNativePlatform()) {
      await new Promise(r => setTimeout(r, 200));
    }

    const sessionId = ++this.currentSessionId;
    const isLoopSession = this.isLoopActive;

    const startupSequence = async (): Promise<boolean> => {
      if (Capacitor.isNativePlatform()) {
        try {
          const granted = await this.requestPermissions();
          if (
            this.isSpeakingState ||
            (isLoopSession && !this.isLoopActive) ||
            sessionId !== this.currentSessionId
          ) {
            return false;
          }

          if (!granted) {
            options.onError?.(new Error("Microphone permission not granted. Please enable it in Android App Settings."));
            options.onEnd?.();
            return false;
          }

          // Prevent listener leaks: remove existing listeners first
          await SpeechRecognition.removeAllListeners();
          if (
            this.isSpeakingState ||
            (isLoopSession && !this.isLoopActive) ||
            sessionId !== this.currentSessionId
          ) {
            return false;
          }

          await SpeechRecognition.addListener('partialResults', (data: any) => {
            if (data.matches && data.matches.length > 0) {
              const transcript = data.matches[0];
              options.onPartialResult?.(transcript);
              options.onFinalResult?.(transcript);
            }
          });

          // Pre-start assertion: must match current session, not speaking, and loop active if continuous
          if (
            sessionId !== this.currentSessionId ||
            this.isSpeakingState ||
            (isLoopSession && !this.isLoopActive)
          ) {
            return false;
          }

          this.isListeningState = true;
          // FE-H09 FIX: Store the start promise so stopListening can wait for it
          this.startPromise = SpeechRecognition.start({
            language: 'en-US', // Fallback to en-US as it is guaranteed to be installed natively
            maxResults: 1,
            prompt: 'Listening...',
            partialResults: true,
            popup: false, // Set to false to allow continuous seamless background listening
          });
          
          const result = await this.startPromise;

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
        } finally {
          this.startPromise = null;
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
          rec.continuous = true;
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
            if (this.activeWebRecognition === rec) {
              this.isListeningState = false;
              this.activeWebRecognition = null;
            }
            options.onError?.(event);
          };

          rec.onend = () => {
            if (this.activeWebRecognition === rec) {
              this.isListeningState = false;
              this.activeWebRecognition = null;
            }
            options.onEnd?.();
          };

          if (
            sessionId !== this.currentSessionId ||
            this.isSpeakingState ||
            (isLoopSession && !this.isLoopActive)
          ) {
            return false;
          }

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
    };

    this.pendingStartPromise = startupSequence();
    try {
      return await this.pendingStartPromise;
    } finally {
      this.pendingStartPromise = null;
    }
  }

  /**
   * Stop speech recognition across native and web platforms.
   */
  static async stopListening(): Promise<void> {
    this.currentSessionId++;
    this.isListeningState = false;
    
    // Invalidate and await any in-flight startup sequence
    if (this.pendingStartPromise) {
      try { await this.pendingStartPromise; } catch (e) {}
    }

    // FE-H09 FIX: Wait for the plugin to actually start before attempting to stop it
    if (this.startPromise) {
      try { await this.startPromise; } catch (e) {}
    }

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
      // Allow the browser hardware loop to fully release the mic before returning
      await new Promise(r => setTimeout(r, 150));
    }
  }

  /**
   * Speak clean text aloud.
   * Flushes currently playing audio before starting a new utterance to prevent voice overlap.
   */
  static async getVoices() {
    try {
      const result = await TextToSpeech.getSupportedVoices();
      return result.voices || [];
    } catch (err) {
      console.warn("Failed to get voices:", err);
      return [];
    }
  }

  static async speak(text: string, options?: VoiceSpeakOptions): Promise<boolean> {
    const cleanText = this.cleanTextForSpeech(text);
    if (!cleanText) return false;

    // Clear any pending cooldown timer to avoid duplicate or leaked restarts
    if (this.cooldownTimeoutId) {
      clearTimeout(this.cooldownTimeoutId);
      this.cooldownTimeoutId = null;
    }

    // Requirement R2 (Echo Prevention): strictly await stopListening BEFORE any audio playback begins
    await this.stopListening();
    // Audio clash prevention: stop any ongoing audio before starting new playback
    await this.stopSpeaking();
    this.isSpeakingState = true;

    const safeStorageGet = (key: string) => {
      try {
        return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    };

    const preferredVoiceStr = safeStorageGet("attendx_preferred_voice_index");
    const prefVoiceIndex = preferredVoiceStr !== null ? parseInt(preferredVoiceStr, 10) : undefined;
    
    // Explicit options override localStorage preferences (crucial for settings preview)
    const finalVoiceIndex = options?.voice !== undefined ? options.voice : prefVoiceIndex;
    
    const prefPitch = safeStorageGet("attendx_preferred_voice_pitch");
    const prefRate = safeStorageGet("attendx_preferred_voice_rate");
    
    const finalPitch = options?.pitch ?? (prefPitch ? parseFloat(prefPitch) : 1.0);
    const finalRate = options?.rate ?? (prefRate ? parseFloat(prefRate) : 1.05);

    const prefElevenLabsVoiceId = options?.elevenlabsVoiceId || safeStorageGet("attendx_elevenlabs_voice_id");

    const handlePlaybackEnd = async () => {
      this.isSpeakingState = false;
      options?.onEnd?.();

      // Requirement R1: Continuous Audio Loop auto-resume
      const shouldResume = Boolean(options?.autoResumeListening || this.isLoopActive);
      const targetListenOptions = options?.listenOptions || this.continuousListenOptions;

      if (shouldResume && targetListenOptions && this.isLoopActive) {
        if (this.cooldownTimeoutId) {
          clearTimeout(this.cooldownTimeoutId);
          this.cooldownTimeoutId = null;
        }
        // Acoustic echo buffer (500ms) to ensure speaker hardware & room reverberation clear
        this.cooldownTimeoutId = setTimeout(async () => {
          this.cooldownTimeoutId = null;
          if (this.isLoopActive && !this.isSpeakingState && !this.isListeningState) {
            await this.startListening(targetListenOptions);
          }
        }, 500);
      }
    };
    
    try {
      options?.onStart?.();
      
      const response = await api.post('/ai/tts', { 
        text: cleanText, 
        voice_id: prefElevenLabsVoiceId || 'hpp4J3VqNfWAUOO0d1Us' // Default to Bella
      }, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(response.data);
      
      const audio = new Audio(blobUrl);
      this.currentAudio = audio;
      
      audio.onloadedmetadata = () => {
        if (audio.duration && audio.duration !== Infinity && options?.onDuration) {
          options.onDuration(audio.duration * 1000);
        }
      };

      audio.onended = async () => {
        URL.revokeObjectURL(blobUrl);
        if (this.currentAudio === audio) this.currentAudio = null;
        await handlePlaybackEnd();
      };
      
      audio.onerror = (e) => {
        URL.revokeObjectURL(blobUrl);
        if (this.currentAudio === audio) this.currentAudio = null;
        this.isSpeakingState = false;
        options?.onError?.(e);
        options?.onEnd?.();
      };

      await audio.play();
      return true;
    } catch (err) {
      console.error("ElevenLabs TTS error:", err);
      try {
        await TextToSpeech.speak({
          text: cleanText,
          lang: options?.lang || 'en-IN',
          rate: finalRate,
          pitch: finalPitch,
          volume: options?.volume ?? 1.0,
          voice: !isNaN(finalVoiceIndex as any) ? finalVoiceIndex : undefined,
          queueStrategy: 0, // QueueStrategy.Flush on native
        });
        await handlePlaybackEnd();
        return true;
      } catch (fallbackErr) {
        this.isSpeakingState = false;
        options?.onError?.(fallbackErr);
        options?.onEnd?.();
        return false;
      }
    }
  }

  /**
   * Explicitly stop any active text-to-speech audio across platforms.
   */
  static async stopSpeaking(): Promise<void> {
    if (this.cooldownTimeoutId) {
      clearTimeout(this.cooldownTimeoutId);
      this.cooldownTimeoutId = null;
    }
    this.isSpeakingState = false;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    
    try {
      await TextToSpeech.stop();
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
      try {
        // Workaround for Chrome bug: cancel() leaves TTS in a broken state unless resumed first
        window.speechSynthesis.resume();
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }

  /**
   * Pauses TTS playback. Supported natively on Web. On native platforms, falls back to stop.
   */


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





