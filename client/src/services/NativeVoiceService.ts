import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { App } from '@capacitor/app';
import { SpeechRecognition } from '@capgo/capacitor-speech-recognition';
import { maskProfanity } from "../utils/profanityMask";
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { api } from '../lib/api.ts';
import { useAuthStore } from '../stores/authStore.ts';

export interface VoiceListenOptions {
  onStart?: () => void;
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
  onProgress?: (currentTimeMs: number, durationMs: number) => void;
  onWordCharIndex?: (charIndex: number) => void;
  onProvider?: (provider: "elevenlabs" | "google-tts" | "native-tts") => void;
  autoResumeListening?: boolean;
  listenOptions?: VoiceListenOptions;
}

/**
 * Detects voice breakout commands across Voice Overlay and Hands-Free mode.
 * Handles single words ("stop", "exit"), repeated commands ("stop stop conversation"),
 * conversational closing phrases ("listening thankyou stop", "thankyou stop", "listening thank you stop stop conversation"),
 * and polite exits ("thank you stop", "thank you goodbye").
 */
export const isVoiceBreakoutCommand = (text: string): boolean => {
  if (!text || typeof text !== 'string') return false;
  const norm = text.trim().toLowerCase().replace(/[.,!?;:'"()-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!norm) return false;

  // 1. Direct single keywords
  const singleKeywords = ['stop', 'cancel', 'exit', 'quit', 'goodbye', 'bye', 'cya', 'abort'];
  if (singleKeywords.includes(norm)) return true;

  // 2. Exact or compound phrases containing stop/conversation
  // e.g., "stop stop", "stop stop conversation", "stop conversation", "stop listening", "stop talking", "stop voice", "stop hands free"
  if (/^(?:please\s+)?stop(?:\s+stop)?(?:\s+(?:the\s+)?(?:conversation|listening|talking|mode|voice|hands\s*free))?$/i.test(norm)) return true;
  if (/^stop\s+stop$/i.test(norm)) return true;
  if (/^(?:just\s+)?(?:shut\s+up|be\s+quiet|end\s+conversation|close\s+voice|exit\s+mode)$/i.test(norm)) return true;

  // 3. Listening + stop / thank you combinations
  // e.g., "listening thankyou stop", "listening thankyou stop stop conversation", "listening thank you stop", "listening stop"
  if (/^listening\s+(?:thank\s*you|thanks)?\s*stop(?:\s+stop)?(?:\s+conversation)?$/i.test(norm)) return true;
  if (/^listening\s+(?:stop|stop\s+conversation|stop\s+stop\s+conversation|exit|quit|cancel)$/i.test(norm)) return true;

  // 4. Thank you + stop combinations
  // e.g., "thankyou stop", "thank you stop", "thank you stop stop conversation", "thank you stop conversation"
  if (/^(?:thank\s*you|thanks)\s*,?\s*stop(?:\s+stop)?(?:\s+conversation)?$/i.test(norm)) return true;
  if (/^(?:thank\s*you|thanks)\s*,?\s*(?:goodbye|bye|bye\s+bye|exit|cancel|close|that'?s\s+all|done)$/i.test(norm)) return true;

  // 5. Ending or standalone with "stop stop conversation" or "stop conversation"
  if (/\b(?:stop\s+stop\s+conversation|stop\s+conversation|stop\s+listening|stop\s+talking)\b/i.test(norm)) return true;

  // 6. Optional prefix like "ok stop stop conversation", "okay thankyou stop"
  if (/^(?:ok|okay|hey|alright|attendx|assistant)\s+(?:stop|stop\s+stop|listening\s+thank\s*you\s+stop|thank\s*you\s+stop)/i.test(norm)) {
    return isVoiceBreakoutCommand(norm.replace(/^(?:ok|okay|hey|alright|attendx|assistant)\s+/i, ''));
  }

  return false;
};

export class NativeVoiceService {
  static isBreakoutCommand = isVoiceBreakoutCommand;
  private static isListeningState = false;
  private static isSpeakingState = false;
  private static isLoopActive = false;
  private static continuousListenOptions: VoiceListenOptions | null = null;
  private static activeWebRecognition: any = null;
  private static startPromise: Promise<any> | null = null; // FE-H09 FIX: Promise lock for native plugin start
  private static currentAudio: HTMLAudioElement | null = null;
  private static sharedAudio: HTMLAudioElement | null = null;
  private static activeObjectUrl: string | null = null;
  private static progressIntervalId: any = null;
  private static currentSessionId = 0;
  private static speakSessionId = 0;
  private static pendingStartPromise: Promise<any> | null = null;
  private static cooldownTimeoutId: any = null;
  private static ttsRangeListener: { remove: () => Promise<void> } | null = null;

  /**
   * Prime a reusable HTMLAudioElement synchronously inside a user tap gesture
   * so Android WebView / mobile browsers never reject async ElevenLabs play() with NotAllowedError.
   */
  static unlockAudio(): void {
    if (typeof window === "undefined" || typeof Audio === "undefined") return;
    try {
      if (!this.sharedAudio) {
        this.sharedAudio = new Audio();
        this.sharedAudio.preload = "auto";
      }
      if (!this.isSpeakingState && !this.currentAudio) {
        const audio = this.sharedAudio;
        audio.muted = true;
        audio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
        const p = audio.play();
        if (p && typeof p.then === "function") {
          p.then(() => {
            if (!this.isSpeakingState) {
              audio.pause();
            }
            audio.muted = false;
          }).catch(() => {
            audio.muted = false;
          });
        } else {
          audio.muted = false;
        }
      }
    } catch {
      // ignore unlock failures on non-media environments
    }
  }

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
   * Check whether any voice interaction (speaking, listening, or hands-free loop) is active.
   */
  static isVoiceModeActive(): boolean {
    return this.isListeningState || this.isSpeakingState || this.isLoopActive;
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
          const req = await SpeechRecognition.requestPermissions();
          if (req && req.speechRecognition === 'granted') {
            isGranted = true;
          }
        }

        return isGranted;
      } catch (err) {
        console.warn("Speech recognition permission request failed:", err);
        return false;
      }
    } else {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(t => t.stop());
          return true;
        } catch (e) {
          console.warn("Microphone access denied on web:", e);
          return false;
        }
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

    try {
      localStorage.setItem("onboarding_voice_mode", "true");
      api.patch("/users/onboarding-status", { step: "voice_mode" }).catch(() => {});
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("onboarding-step-completed", { detail: { step: "voice_mode" } }));
      }
    } catch {}

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
            if (sessionId !== this.currentSessionId || !this.isListeningState || this.isSpeakingState) {
              return;
            }
            if (data.matches && data.matches.length > 0) {
              const transcript = data.matches[0];
              options.onPartialResult?.(transcript);
            }
          });

          await SpeechRecognition.addListener('listeningState', (event: any) => {
            if (sessionId !== this.currentSessionId) {
              return;
            }
            if (event.state === 'stopped') {
              if (!this.isListeningState) return;
              this.isListeningState = false;
              options.onEnd?.();
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
          options.onStart?.();
          // FE-H09 FIX: Store the start promise so stopListening can wait for it
          this.startPromise = SpeechRecognition.start({
            language: 'en-US', // Fallback to en-US as it is guaranteed to be installed natively
            maxResults: 1,
            prompt: 'Listening...',
            partialResults: true,
            popup: false, // Set to false to allow continuous seamless background listening
          });
          
          const result = await this.startPromise;
          // DO NOT call onEnd here! On Android 11+, partialResults: true causes this promise 
          // to resolve instantly (0-5ms). We must rely on the listeningState event above.
          if (sessionId === this.currentSessionId && this.isListeningState && result && result.matches && result.matches.length > 0) {
            const transcript = result.matches[0];
            options.onFinalResult?.(transcript);
          }
          return sessionId === this.currentSessionId;
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

        const granted = await this.requestPermissions();
        if (!granted) {
          options.onError?.(new Error("Microphone access denied. Please allow microphone access in settings."));
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
              const safeTranscript = maskProfanity(currentTranscript);
              options.onPartialResult?.(safeTranscript);
              options.onFinalResult?.(safeTranscript);
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
            // Only fire the onEnd callback if this instance is still the active one.
            // If stopListening() called abort(), it already nulled activeWebRecognition.
            // Calling onEnd() in that case would cause the hands-free loop to incorrectly restart.
            if (this.activeWebRecognition === rec) {
              this.isListeningState = false;
              this.activeWebRecognition = null;
              options.onEnd?.();
            }
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
          options.onStart?.();
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

    if (Capacitor.isNativePlatform()) {
      // Remove listeners FIRST so calling SpeechRecognition.stop() never emits a stale onEnd callback
      try {
        await SpeechRecognition.removeAllListeners();
      } catch {
        // ignore
      }
    }
    
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
    } else if (this.activeWebRecognition) {
      const rec = this.activeWebRecognition;
      this.activeWebRecognition = null;
      try {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.abort();
      } catch {
        // ignore
      }
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

    try {
      localStorage.setItem("onboarding_voice_mode", "true");
      api.patch("/users/onboarding-status", { step: "voice_mode" }).catch(() => {});
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("onboarding-step-completed", { detail: { step: "voice_mode" } }));
      }
    } catch {}

    // Requirement R2 (Echo Prevention): strictly await stopListening BEFORE any audio playback begins
    await this.stopListening();
    // Audio clash prevention: stop any ongoing audio before starting new playback
    await this.stopSpeaking();
    const mySpeakId = ++this.speakSessionId;
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

    let hasStartedPlayback = false;
    const firePlaybackStart = () => {
      if (mySpeakId !== this.speakSessionId || hasStartedPlayback) return;
      hasStartedPlayback = true;
      options?.onStart?.();
    };

    const handlePlaybackEnd = async () => {
      if (mySpeakId !== this.speakSessionId) return;
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
          if (
            mySpeakId === this.speakSessionId &&
            this.isLoopActive &&
            !this.isSpeakingState &&
            !this.isListeningState
          ) {
            await this.startListening(targetListenOptions);
          }
        }, 500);
      }
    };

    const speakWithNativeFallback = async (): Promise<boolean> => {
      if (mySpeakId !== this.speakSessionId) return false;
      options?.onProvider?.("native-tts");
      let startFallbackTimer: ReturnType<typeof setTimeout> | null = null;
      let finished = false;
      try {
        if (this.ttsRangeListener) {
          await this.ttsRangeListener.remove().catch(() => {});
          this.ttsRangeListener = null;
        }
        try {
          this.ttsRangeListener = await TextToSpeech.addListener('onRangeStart', (info: any) => {
            if (mySpeakId !== this.speakSessionId) return;
            if (startFallbackTimer) {
              clearTimeout(startFallbackTimer);
              startFallbackTimer = null;
            }
            firePlaybackStart();
            if (typeof info?.start === "number") {
              options?.onWordCharIndex?.(info.start);
            }
          });
        } catch {
          // Web or unsupported listener falls back to calibrated start timer
        }
        startFallbackTimer = setTimeout(() => {
          if (!finished && mySpeakId === this.speakSessionId) {
            firePlaybackStart();
          }
        }, Capacitor.isNativePlatform() ? 450 : 120);

        await TextToSpeech.speak({
          text: cleanText,
          lang: options?.lang || 'en-IN',
          rate: finalRate,
          pitch: finalPitch,
          volume: options?.volume ?? 1.0,
          voice: !isNaN(finalVoiceIndex as any) ? finalVoiceIndex : undefined,
          queueStrategy: 0,
        });
        finished = true;
        if (startFallbackTimer) {
          clearTimeout(startFallbackTimer);
          startFallbackTimer = null;
        }
        if (this.ttsRangeListener) {
          await this.ttsRangeListener.remove().catch(() => {});
          this.ttsRangeListener = null;
        }
        if (mySpeakId === this.speakSessionId) {
          firePlaybackStart();
          await handlePlaybackEnd();
        }
        return true;
      } catch (fallbackErr) {
        finished = true;
        if (startFallbackTimer) {
          clearTimeout(startFallbackTimer);
          startFallbackTimer = null;
        }
        if (this.ttsRangeListener) {
          await this.ttsRangeListener.remove().catch(() => {});
          this.ttsRangeListener = null;
        }
        if (mySpeakId === this.speakSessionId) {
          this.isSpeakingState = false;
          options?.onError?.(fallbackErr);
          options?.onEnd?.();
        }
        return false;
      }
    };

    try {
      const voiceId = prefElevenLabsVoiceId || 'hpp4J3VqNfWAUOO0d1Us';

      const decodeBase64ToBlob = (b64: string, mimeType = "audio/mpeg"): Blob => {
        const stripped = (b64.includes(",") ? b64.split(",")[1] : b64).replace(/\s+/g, "");
        const bin = atob(stripped);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Blob([bytes], { type: mimeType });
      };

      const isJwtExpiringSoon = (token: string | null | undefined): boolean => {
        if (!token) return true;
        try {
          const payloadB64 = token.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/");
          if (!payloadB64) return true;
          const payload = JSON.parse(atob(payloadB64));
          return !payload?.exp || payload.exp * 1000 < Date.now() + 15000;
        } catch {
          return true;
        }
      };

      const getHeaderIgnoreCase = (headers: Record<string, any> | undefined, name: string): string => {
        if (!headers) return "";
        const target = name.toLowerCase();
        for (const key of Object.keys(headers)) {
          if (key.toLowerCase() === target) return String(headers[key] ?? "");
        }
        return "";
      };

      let audioBlob: Blob;
      let resolvedProvider: "elevenlabs" | "google-tts" = "elevenlabs";

      if (Capacitor.isNativePlatform()) {
        // On Android/iOS, CapacitorHttp's XHR patch omits responseType, corrupting raw binary XHR payloads.
        // Call CapacitorHttp.post directly with explicit responseType: "blob" AND format: "json" so BOTH
        // JSON-base64 responses and legacy raw audio/mpeg responses decode losslessly.
        let token = useAuthStore.getState().accessToken;
        if (isJwtExpiringSoon(token)) {
          await api.get("/auth/me", { silent: true }).catch(() => {});
          token = useAuthStore.getState().accessToken;
        }

        const ttsUrl = `${api.defaults.baseURL}/ai/tts`;
        const executeNativeTts = async (bearer: string | null) =>
          CapacitorHttp.post({
            url: ttsUrl,
            headers: {
              "Content-Type": "application/json",
              ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
            },
            data: { text: cleanText, voice_id: voiceId, format: "json" },
            responseType: "blob",
            connectTimeout: 15000,
            readTimeout: 15000,
          });

        let nativeRes = await executeNativeTts(token);
        if (nativeRes.status === 401) {
          await api.get("/auth/me", { silent: true }).catch(() => {});
          token = useAuthStore.getState().accessToken;
          if (token) {
            nativeRes = await executeNativeTts(token);
          }
        }

        if (mySpeakId !== this.speakSessionId) return false;
        if (nativeRes.status < 200 || nativeRes.status >= 300) {
          throw new Error(`Native TTS HTTP ${nativeRes.status}`);
        }

        const headerProvider = getHeaderIgnoreCase(nativeRes.headers, "x-tts-provider").toLowerCase();
        if (headerProvider === "google-tts") resolvedProvider = "google-tts";

        const rawNativeData = nativeRes.data;
        if (rawNativeData && typeof rawNativeData === "object" && typeof rawNativeData.audioBase64 === "string") {
          if (String(rawNativeData.provider || "").toLowerCase() === "google-tts") {
            resolvedProvider = "google-tts";
          }
          audioBlob = decodeBase64ToBlob(rawNativeData.audioBase64, rawNativeData.mimeType || "audio/mpeg");
        } else if (typeof rawNativeData === "string" && rawNativeData.length > 0) {
          audioBlob = decodeBase64ToBlob(rawNativeData, "audio/mpeg");
        } else {
          throw new Error("Empty native TTS audio payload");
        }
      } else {
        // Web browser: Authenticated POST via Axios so expired JWTs auto-refresh via interceptor
        const ttsRes = await api.post(
          "/ai/tts",
          { text: cleanText, voice_id: voiceId, format: "json" },
          {
            responseType: "blob",
            silent: true,
            timeout: 15000,
          },
        );

        if (mySpeakId !== this.speakSessionId) return false;

        const contentType = getHeaderIgnoreCase(ttsRes.headers as any, "content-type").toLowerCase();
        const headerProvider = getHeaderIgnoreCase(ttsRes.headers as any, "x-tts-provider").toLowerCase();
        if (headerProvider === "google-tts") resolvedProvider = "google-tts";

        const rawData = ttsRes.data;
        if (contentType.includes("application/json")) {
          const jsonText = rawData instanceof Blob ? await rawData.text() : typeof rawData === "string" ? rawData : JSON.stringify(rawData);
          const parsed = JSON.parse(jsonText);
          if (!parsed?.audioBase64) throw new Error("Missing audioBase64 in JSON TTS payload");
          if (String(parsed.provider || "").toLowerCase() === "google-tts") resolvedProvider = "google-tts";
          audioBlob = decodeBase64ToBlob(parsed.audioBase64, parsed.mimeType || "audio/mpeg");
        } else if (rawData instanceof Blob) {
          audioBlob = rawData.type ? rawData : new Blob([rawData], { type: "audio/mpeg" });
        } else if (rawData instanceof ArrayBuffer) {
          audioBlob = new Blob([rawData], { type: "audio/mpeg" });
        } else if (typeof rawData === "string" && rawData.length > 0) {
          audioBlob = decodeBase64ToBlob(rawData, "audio/mpeg");
        } else {
          throw new Error("Empty or unsupported TTS audio payload");
        }
      }

      if (audioBlob.size < 128) {
        throw new Error(`TTS audio payload too small (${audioBlob.size} bytes)`);
      }

      options?.onProvider?.(resolvedProvider);

      const blobUrl = URL.createObjectURL(audioBlob);
      if (this.activeObjectUrl) {
        try { URL.revokeObjectURL(this.activeObjectUrl); } catch {}
      }
      this.activeObjectUrl = blobUrl;

      const audio = this.sharedAudio || new Audio();
      this.sharedAudio = audio;
      audio.muted = false;
      audio.volume = options?.volume ?? 1.0;
      audio.preload = "auto";
      this.currentAudio = audio;

      const clearProgressTimer = () => {
        if (this.progressIntervalId) {
          clearInterval(this.progressIntervalId);
          this.progressIntervalId = null;
        }
      };

      const syncAudioDuration = () => {
        if (mySpeakId !== this.speakSessionId) return;
        if (audio.duration && Number.isFinite(audio.duration) && audio.duration > 0) {
          options?.onDuration?.(audio.duration * 1000);
          options?.onProgress?.(audio.currentTime * 1000, audio.duration * 1000);
        }
      };

      const cleanupFile = () => {
        clearProgressTimer();
        if (this.activeObjectUrl === blobUrl) {
          try { URL.revokeObjectURL(blobUrl); } catch {}
          this.activeObjectUrl = null;
        }
      };

      const detachAudio = () => {
        audio.onloadedmetadata = null;
        audio.ondurationchange = null;
        audio.ontimeupdate = null;
        audio.onplaying = null;
        audio.onended = null;
        audio.onerror = null;
      };

      audio.onloadedmetadata = syncAudioDuration;
      audio.ondurationchange = syncAudioDuration;
      audio.ontimeupdate = () => {
        if (mySpeakId !== this.speakSessionId) return;
        const durMs = audio.duration && Number.isFinite(audio.duration) ? audio.duration * 1000 : 0;
        options?.onProgress?.(audio.currentTime * 1000, durMs);
      };

      audio.onended = async () => {
        detachAudio();
        cleanupFile();
        if (this.currentAudio === audio) this.currentAudio = null;
        await handlePlaybackEnd();
      };

      audio.onerror = async (e) => {
        detachAudio();
        cleanupFile();
        if (this.currentAudio === audio) this.currentAudio = null;
        if (mySpeakId !== this.speakSessionId) return;
        console.warn("Audio stream failed, falling back to native TTS...", e);
        await speakWithNativeFallback();
      };

      // Only trigger UI word parser once audio physically starts playing
      audio.onplaying = () => {
        if (mySpeakId !== this.speakSessionId) return;
        syncAudioDuration();
        firePlaybackStart();
        clearProgressTimer();
        this.progressIntervalId = setInterval(() => {
          if (mySpeakId !== this.speakSessionId || audio.paused || audio.ended) return;
          const durMs = audio.duration && Number.isFinite(audio.duration) ? audio.duration * 1000 : 0;
          options?.onProgress?.(audio.currentTime * 1000, durMs);
        }, 50);
      };

      audio.src = blobUrl;
      audio.load();
      await audio.play();
      return true;
    } catch (err) {
      if (mySpeakId !== this.speakSessionId) return false;
      console.warn("ElevenLabs TTS request/playback failed, falling back to native TTS:", err);
      return await speakWithNativeFallback();
    }
  }

  /**
   * Explicitly stop any active text-to-speech audio across platforms.
   */
  static async stopSpeaking(): Promise<void> {
    this.speakSessionId++;
    if (this.cooldownTimeoutId) {
      clearTimeout(this.cooldownTimeoutId);
      this.cooldownTimeoutId = null;
    }
    if (this.progressIntervalId) {
      clearInterval(this.progressIntervalId);
      this.progressIntervalId = null;
    }
    this.isSpeakingState = false;
    if (this.ttsRangeListener) {
      await this.ttsRangeListener.remove().catch(() => {});
      this.ttsRangeListener = null;
    }
    if (this.currentAudio) {
      const audio = this.currentAudio;
      this.currentAudio = null;
      try {
        // Detach handlers BEFORE pausing/emptying src so aborted streams never trigger Google TTS fallback!
        audio.onloadedmetadata = null;
        audio.ondurationchange = null;
        audio.ontimeupdate = null;
        audio.onplaying = null;
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      } catch {
        // ignore
      }
    }
    if (this.activeObjectUrl) {
      try { URL.revokeObjectURL(this.activeObjectUrl); } catch {}
      this.activeObjectUrl = null;
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

if (Capacitor.isNativePlatform()) {
  App.addListener('appStateChange', ({ isActive }: { isActive: boolean }) => {
    if (!isActive) {
      NativeVoiceService.stopContinuousLoop();
    }
  });
}





