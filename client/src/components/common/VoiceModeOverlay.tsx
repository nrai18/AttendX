import { App } from '@capacitor/app';
import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, VolumeX, X, Settings, Square, Check } from "lucide-react";
import { NativeVoiceService, isVoiceBreakoutCommand } from "../../services/NativeVoiceService";
import { useBackHandlerStore } from "../../stores/backHandlerStore";
import { api } from "../../lib/api";
import { maskProfanity } from "../../utils/profanityMask";
import { normalizeCopilotQuery } from "../../utils/copilotFastPath";

interface VoiceModeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: (query: string, inputMethod?: 'text' | 'voice' | 'voice_overlay') => Promise<string | undefined>;
  pendingActionMsgId?: string;
  onConfirmPendingAction?: (msgId: string) => void;
  onCancelPendingAction?: (msgId: string) => void;
}

const VISUAL_FILLER_PHRASES = [
  "Just a moment...",
  "Thinking...",
  "Give me a second...",
  "Working on that...",
  "Let's see...",
  "Processing..."
];

interface CinematicTextProps {
  text: string;
  startTime: number;
  durationMs: number;
  audioProgressMs: number;
  audioDurationMs: number;
  nativeCharIndex: number;
  isDone?: boolean;
}

const CinematicText = React.memo(({
  text,
  startTime,
  durationMs,
  audioProgressMs,
  audioDurationMs,
  nativeCharIndex,
  isDone,
}: CinematicTextProps) => {
  const wordMeta = useMemo(() => {
    const tokens: Array<{ word: string; charStart: number; charEnd: number; cumEndRatio: number }> = [];
    const regex = /\S+/g;
    let match: RegExpExecArray | null;
    const rawWeights: number[] = [];
    const spans: Array<{ word: string; charStart: number; charEnd: number }> = [];

    while ((match = regex.exec(text)) !== null) {
      const w = match[0];
      spans.push({ word: w, charStart: match.index, charEnd: match.index + w.length });
      const punctPause = /[.!?]["')\]]*$/.test(w) ? 7.5 : /[,;:—–-]["')\]]*$/.test(w) ? 3.5 : 0;
      rawWeights.push(Math.max(2.2, w.length * 0.95) + 1.6 + punctPause);
    }

    const totalWeight = rawWeights.reduce((acc, v) => acc + v, 0) || 1;
    let running = 0;
    for (let i = 0; i < spans.length; i++) {
      running += rawWeights[i];
      tokens.push({
        ...spans[i],
        cumEndRatio: running / totalWeight,
      });
    }
    return { tokens, totalWeight };
  }, [text]);

  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);
  const lastScrolledLineRef = useRef<number>(-1);

  const computeTargetIndex = (progressRatio: number): number => {
    const { tokens } = wordMeta;
    if (tokens.length === 0) return 0;
    const clamped = Math.min(1, Math.max(0, progressRatio));
    for (let i = 0; i < tokens.length; i++) {
      if (clamped <= tokens[i].cumEndRatio) return i;
    }
    return tokens.length - 1;
  };

  useEffect(() => {
    const totalWords = wordMeta.tokens.length;
    if (isDone) {
      activeIndexRef.current = totalWords;
      setActiveIndex(totalWords);
      return;
    }

    if (totalWords === 0) {
      activeIndexRef.current = 0;
      setActiveIndex(0);
      return;
    }

    // Mode 1: Exact Android Native TTS onRangeStart character offset
    if (nativeCharIndex >= 0) {
      let idx = 0;
      for (let i = 0; i < totalWords; i++) {
        if (nativeCharIndex >= wordMeta.tokens[i].charStart) idx = i;
        else break;
      }
      if (idx !== activeIndexRef.current) {
        activeIndexRef.current = idx;
        setActiveIndex(idx);
      }
      return;
    }

    // Mode 2: Exact HTML5 Audio playback clock (ElevenLabs / Server MP3 — pauses automatically on buffer!)
    if (audioDurationMs > 0 && audioProgressMs >= 0) {
      // Slight 60ms onset offset matches natural MP3 leading silence so cursor stays locked with speech
      const ratio = Math.min(1, Math.max(0, (audioProgressMs - 60) / audioDurationMs));
      const idx = computeTargetIndex(ratio);
      if (idx !== activeIndexRef.current) {
        activeIndexRef.current = idx;
        setActiveIndex(idx);
      }
      return;
    }

    if (startTime <= 0) {
      activeIndexRef.current = 0;
      setActiveIndex(0);
      return;
    }

    // Mode 3: Calibrated weighted fallback (muted mode or before metadata loads)
    const effectiveDuration = durationMs > 0 ? durationMs : Math.max(1200, (wordMeta.totalWeight / 13.5) * 1000);
    const checkProgress = () => {
      const elapsed = Math.max(0, Date.now() - startTime);
      const ratio = Math.min(1, elapsed / effectiveDuration);
      const targetIndex = computeTargetIndex(ratio);
      if (targetIndex !== activeIndexRef.current) {
        activeIndexRef.current = targetIndex;
        setActiveIndex(targetIndex);
      }
    };

    const timerId = setInterval(checkProgress, 40);
    checkProgress();
    return () => clearInterval(timerId);
  }, [startTime, durationMs, audioProgressMs, audioDurationMs, nativeCharIndex, wordMeta, isDone]);

  // Smooth container-only scrolling when a word wraps to a new line
  useEffect(() => {
    if (!containerRef.current || !activeWordRef.current || isDone) return;
    const container = containerRef.current;
    const wordEl = activeWordRef.current;
    const offsetTop = wordEl.offsetTop;

    if (Math.abs(offsetTop - lastScrolledLineRef.current) > 12) {
      lastScrolledLineRef.current = offsetTop;
      const targetScroll = Math.max(0, offsetTop - container.clientHeight / 2 + wordEl.clientHeight / 2);
      container.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
  }, [activeIndex, isDone]);

  return (
    <div
      ref={containerRef}
      className="max-h-[200px] md:max-h-[260px] overflow-y-auto w-full px-4 relative overscroll-contain scrollbar-hide [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <div className="py-8 flex flex-wrap justify-center content-center gap-x-[0.34em] gap-y-2">
        {wordMeta.tokens.map((item, i) => {
          const isPast = i < activeIndex;
          const isCurrent = i === activeIndex && !isDone;
          const isSpoken = isPast || isCurrent || isDone;

          return (
            <span
              key={i}
              ref={isCurrent ? activeWordRef : null}
              className={`inline-flex items-center text-2xl md:text-3xl lg:text-4xl tracking-tight transition-colors duration-150 ${
                isSpoken
                  ? "text-slate-950 dark:text-[#FFFFFF] opacity-100 font-bold"
                  : "text-slate-400/55 dark:text-zinc-500/45 font-semibold"
              }`}
            >
              <span>{item.word}</span>
              {/* Streaming cursor travelling hand-in-hand with active speech */}
              {isCurrent && (
                <span className="inline-block w-[3px] h-[0.85em] ml-1.5 bg-slate-950 dark:bg-[#FFFFFF] rounded-full align-middle animate-pulse shadow-[0_0_8px_rgba(15,23,42,0.35)] dark:shadow-[0_0_10px_rgba(255,255,255,0.95)]" />
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
});

// Hardware-accelerated dual-theme Orb (crisp contrast in both Light and Dark mode)
const AnimatedVoiceOrb = React.memo(({ uiState }: { uiState: string }) => {
  return (
    <div className="relative flex items-center justify-center w-60 h-60 sm:w-64 sm:h-64 mt-4 will-change-transform">
      {/* Ambient Glow */}
      <motion.div
        animate={{
          scale: uiState === "LISTENING" ? [1, 1.18, 1] : uiState === "SPEAKING" ? [1, 1.32, 1.08, 1.24, 1] : uiState === "PROCESSING" ? [1, 1.1, 1] : [1, 1.04, 1],
          opacity: uiState === "LISTENING" ? [0.35, 0.65, 0.35] : uiState === "SPEAKING" ? [0.45, 0.8, 0.45] : [0.22, 0.4, 0.22]
        }}
        transition={{ repeat: Infinity, duration: uiState === "SPEAKING" ? 1.5 : 2, ease: "easeInOut" }}
        className={`absolute w-60 h-60 sm:w-64 sm:h-64 rounded-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] transform-gpu dark:mix-blend-screen ${
          uiState === "LISTENING"
            ? "from-slate-900/20 via-slate-500/10 to-transparent dark:from-white/40 dark:via-white/10 dark:to-transparent"
            : uiState === "SPEAKING"
            ? "from-rose-500/35 via-pink-400/15 to-transparent dark:from-pink-500/50 dark:via-pink-500/10 dark:to-transparent"
            : uiState === "PROCESSING"
            ? "from-cyan-500/30 via-sky-400/10 to-transparent dark:from-cyan-500/35 dark:via-cyan-500/10 dark:to-transparent"
            : "from-slate-400/20 via-slate-300/5 to-transparent dark:from-white/15 dark:to-transparent"
        }`}
      />

      {/* Core Solid Orb */}
      <motion.div
        animate={{
          scale: uiState === "LISTENING" ? [1, 1.05, 1] : uiState === "SPEAKING" ? [1, 1.12, 0.96, 1.05, 1] : uiState === "PROCESSING" ? [1, 1.06, 1] : [1, 1.02, 1],
        }}
        transition={{ repeat: Infinity, duration: uiState === "SPEAKING" ? 1.2 : 2, ease: "easeInOut" }}
        className={`relative z-10 w-36 h-36 sm:w-44 sm:h-44 rounded-full shadow-2xl transition-colors duration-500 transform-gpu bg-gradient-to-tr ${
          uiState === "LISTENING"
            ? "from-slate-800 via-slate-900 to-slate-700 shadow-slate-900/30 dark:from-zinc-100 dark:via-white dark:to-white dark:shadow-white/40"
            : uiState === "SPEAKING"
            ? "from-rose-500 via-pink-500 to-rose-300 shadow-rose-500/40 dark:from-pink-300 dark:via-rose-400 dark:to-white dark:shadow-pink-500/50"
            : uiState === "PROCESSING"
            ? "from-sky-500 via-cyan-500 to-cyan-300 shadow-cyan-500/35 dark:from-cyan-100 dark:to-cyan-300 dark:shadow-cyan-500/40"
            : "from-slate-400 to-slate-500 shadow-slate-400/30 dark:from-zinc-600 dark:to-zinc-500 dark:shadow-white/15"
        }`}
      />
    </div>
  );
});

export const VoiceModeOverlay: React.FC<VoiceModeOverlayProps> = ({
  isOpen,
  onClose,
  onSendMessage,
  pendingActionMsgId,
  onConfirmPendingAction,
  onCancelPendingAction,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [transcript, setTranscript] = useState("");
  const [lastResponse, setLastResponse] = useState("");
  const [processingLabel, setProcessingLabel] = useState("Thinking...");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speechDuration, setSpeechDuration] = useState(0);
  const [speechStartTime, setSpeechStartTime] = useState(0);
  const [audioProgressMs, setAudioProgressMs] = useState(-1);
  const [audioDurationMs, setAudioDurationMs] = useState(0);
  const [nativeCharIndex, setNativeCharIndex] = useState(-1);
  const [activeTtsProvider, setActiveTtsProvider] = useState<"elevenlabs" | "google-tts" | "native-tts" | null>(null);
  const turnIdRef = useRef(0);
  const userMutedMicRef = useRef(false);
  const showVoiceSettingsRef = useRef(false);
  const autoRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityAtRef = useRef<number>(Date.now());

  const cleanedResponseText = useMemo(() => {
    return NativeVoiceService.cleanTextForSpeech(lastResponse);
  }, [lastResponse]);

  // Handle hardware back button: dismiss Voice Settings sheet first, then Voice Mode overlay
  useEffect(() => {
    if (!isOpen) return;

    const unregister = useBackHandlerStore.getState().register(() => {
      if (showVoiceSettingsRef.current) {
        closeVoiceSettings();
        return true;
      }
      handleClose();
      return true;
    });

    return () => unregister();
  }, [isOpen, onClose]);

  // Voice Settings State
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<number>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem("attendx_preferred_voice_index") : null;
    return saved !== null ? parseInt(saved, 10) : 1; // Default to Bella
  });
  const [previewVoice, setPreviewVoice] = useState<number | null>(null);

  useEffect(() => {
    showVoiceSettingsRef.current = showVoiceSettings;
  }, [showVoiceSettings]);

  // 21 Free ElevenLabs Premade Voices (Alternating Male/Female)
  const curatedVoices = useMemo(() => {
    return [
      { originalIndex: 0, alias: "Adam", desc: "Male (Dominant & Firm)", elevenLabsId: "pNInz6obpgDQGcFmaJgB", pitch: 1.0, rate: 1.0, sample: "I'm ready when you are. Let's tackle your schedule for today." },
      { originalIndex: 1, alias: "Bella", desc: "Female (Bright & Warm)", elevenLabsId: "hpp4J3VqNfWAUOO0d1Us", pitch: 1.0, rate: 1.0, sample: "Hi there! I can help you stay organized and keep track of your classes." },
      { originalIndex: 2, alias: "Charlie", desc: "Male (Deep & Energetic)", elevenLabsId: "IKne3meq5aSn9XLyUdCD", pitch: 1.0, rate: 1.0, sample: "Alright, let's get moving! What's on the agenda for today?" },
      { originalIndex: 3, alias: "Jessica", desc: "Female (Playful & Bright)", elevenLabsId: "cgSgspJ2msm6clMCkdW9", pitch: 1.0, rate: 1.0, sample: "Hey! I'm here to help make your day just a little bit easier. How's it going?" },
      { originalIndex: 4, alias: "George", desc: "Male (Warm Storyteller)", elevenLabsId: "JBFqnCBsd6RMkjVDRZzb", pitch: 1.0, rate: 1.0, sample: "The best way to start the day is with a solid plan. Let's look at your timetable." },
      { originalIndex: 5, alias: "Sarah", desc: "Female (Mature & Reassuring)", elevenLabsId: "EXAVITQu4vr4xnSDxMaL", pitch: 1.0, rate: 1.0, sample: "Hello. I'll make sure everything is in order so you can focus on what matters." },
      { originalIndex: 6, alias: "Roger", desc: "Male (Laid-Back & Casual)", elevenLabsId: "CwhRBWXzGAHq8TQ4Fs17", pitch: 1.0, rate: 1.0, sample: "Hey, what's up? Just let me know what you need help with, and I've got you covered." },
      { originalIndex: 7, alias: "Laura", desc: "Female (Quirky Enthusiast)", elevenLabsId: "FGY2WhTYpPnrIDTdsKH5", pitch: 1.0, rate: 1.0, sample: "Ooh, let's see what we have planned today! I'm super excited to get started." },
      { originalIndex: 8, alias: "Callum", desc: "Male (Husky Trickster)", elevenLabsId: "N2lVS1w4EtoT3dr4eOWO", pitch: 1.0, rate: 1.0, sample: "Got a busy day ahead? Don't worry, I know all the shortcuts." },
      { originalIndex: 9, alias: "Alice", desc: "Female (Clear Educator)", elevenLabsId: "Xb7hH8MSUJpSbSDYk0k2", pitch: 1.0, rate: 1.0, sample: "Welcome back. Let's go through your upcoming classes step by step." },
      { originalIndex: 10, alias: "Harry", desc: "Male (Fierce Warrior)", elevenLabsId: "SOYHLrjzK2X1ezoPC6cr", pitch: 1.0, rate: 1.0, sample: "Whatever challenges you face today, we will handle them together." },
      { originalIndex: 11, alias: "Matilda", desc: "Female (Knowledgeable)", elevenLabsId: "XrExE9yKIg1WjnnlVkGX", pitch: 1.0, rate: 1.0, sample: "Good to see you. I have all your attendance data and reports right here." },
      { originalIndex: 12, alias: "Liam", desc: "Male (Energetic Creator)", elevenLabsId: "TX3LPaxmHKxFdv7VOQHJ", pitch: 1.0, rate: 1.0, sample: "Hey everyone! Let's dive right in and check out what's happening today." },
      { originalIndex: 13, alias: "Lily", desc: "Female (Velvety Actress)", elevenLabsId: "pFZP5JQG7iQjIQuC4Bku", pitch: 1.0, rate: 1.0, sample: "Whenever you're ready, I'll gracefully guide you through your schedule." },
      { originalIndex: 14, alias: "Will", desc: "Male (Relaxed Optimist)", elevenLabsId: "bIHbv24MWmeRgasZH58o", pitch: 1.0, rate: 1.0, sample: "No stress at all. We'll take today's schedule one step at a time." },
      { originalIndex: 15, alias: "Eric", desc: "Male (Smooth & Trustworthy)", elevenLabsId: "cjVigY5qzO86Huf0OWal", pitch: 1.0, rate: 1.0, sample: "You can count on me. I'll keep your schedule running like clockwork." },
      { originalIndex: 16, alias: "Chris", desc: "Male (Charming)", elevenLabsId: "iP95p4xoKVk53GoZ742B", pitch: 1.0, rate: 1.0, sample: "It's a great day to get things done. What can I do for you?" },
      { originalIndex: 17, alias: "Brian", desc: "Male (Deep & Resonant)", elevenLabsId: "nPczCjzI2devNBz1zQrb", pitch: 1.0, rate: 1.0, sample: "Take a deep breath. I have your entire timetable organized and ready." },
      { originalIndex: 18, alias: "Daniel", desc: "Male (Steady Broadcaster)", elevenLabsId: "onwK4e9ZLuTAKqWW03F9", pitch: 1.0, rate: 1.0, sample: "This is your daily briefing. Let's take a look at your attendance records." },
      { originalIndex: 19, alias: "Bill", desc: "Male (Wise & Mature)", elevenLabsId: "pqHfZKP75CvOlQylNhV4", pitch: 1.0, rate: 1.0, sample: "Experience has taught me that preparation is everything. Let's review your day." },
      { originalIndex: 20, alias: "River", desc: "Neutral (Relaxed & Informative)", elevenLabsId: "SAz9YHcvj6GT2YYXdXww", pitch: 1.0, rate: 1.0, sample: "Hello. I am here to assist you with all your administrative and scheduling tasks." }
    ];
  }, []);

  const activeVoiceInfo = useMemo(() => {
    return curatedVoices.find((cv) => cv.originalIndex === selectedVoice) || curatedVoices[1] || curatedVoices[0];
  }, [curatedVoices, selectedVoice]);

  const clearAutoRestartTimer = () => {
    if (autoRestartTimerRef.current) {
      clearTimeout(autoRestartTimerRef.current);
      autoRestartTimerRef.current = null;
    }
  };

  const openVoiceSettings = () => {
    NativeVoiceService.unlockAudio();
    clearAutoRestartTimer();
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    showVoiceSettingsRef.current = true;
    setShowVoiceSettings(true);

    // Pause active microphone and speech so sample previews play cleanly
    if (isListeningRef.current) {
      NativeVoiceService.stopListening();
      setIsListening(false);
      isListeningRef.current = false;
    }
    if (isSpeakingRef.current) {
      NativeVoiceService.stopSpeaking();
      setIsSpeaking(false);
      isSpeakingRef.current = false;
    }
  };

  const closeVoiceSettings = () => {
    showVoiceSettingsRef.current = false;
    setShowVoiceSettings(false);
    NativeVoiceService.stopSpeaking();
    lastActivityAtRef.current = Date.now();
    // Seamlessly resume continuous listening when returning from Voice Picker (unless user muted mic)
    if (isOpenRef.current && !userMutedMicRef.current && !isProcessingRef.current) {
      clearAutoRestartTimer();
      autoRestartTimerRef.current = setTimeout(() => {
        autoRestartTimerRef.current = null;
        if (isOpenRef.current && !showVoiceSettingsRef.current && !userMutedMicRef.current && !isProcessingRef.current && !isSpeakingRef.current) {
          startListening();
        }
      }, 220);
    }
  };

  const isOpenRef = useRef(isOpen);
  const voiceEnabledRef = useRef(voiceEnabled);
  const previewVoiceRef = useRef<number | null>(null);

  // Setup when opening settings
  useEffect(() => {
    if (showVoiceSettings) {
      stopListening();

      if (curatedVoices.length > 0) {
        const activeIndex = curatedVoices.findIndex(cv => cv.originalIndex === selectedVoice);
        const targetIndex = activeIndex >= 0 ? activeIndex : 0;
        const activeCv = curatedVoices[targetIndex];

        if (activeCv) {
          previewVoiceRef.current = activeCv.originalIndex;
          setPreviewVoice(activeCv.originalIndex);

          setTimeout(() => {
            const el = document.getElementById(`voice-item-${activeCv.originalIndex}`);
            if (el) {
              el.scrollIntoView({ behavior: 'instant', block: 'center' });
            }
          }, 60);

          NativeVoiceService.speak(activeCv.sample, {
            voice: activeCv.originalIndex,
            elevenlabsVoiceId: activeCv.elevenLabsId,
            pitch: activeCv.pitch,
            rate: activeCv.rate,
            onProvider: (provider) => setActiveTtsProvider(provider),
          }).catch(console.error);
        }
      }
    } else {
      previewVoiceRef.current = null;
      setPreviewVoice(null);
    }
  }, [showVoiceSettings, curatedVoices, selectedVoice]);
  const isSpeakingRef = useRef(isSpeaking);
  const isProcessingRef = useRef(isProcessing);
  const isListeningRef = useRef(isListening);
  const transcriptRef = useRef(transcript);
  const lastSubmittedVoiceQueryRef = useRef<string>("");
  const micStartTimeRef = useRef<number>(0);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const speechStartTimeRef = useRef<number>(0);
  const speechTotalDurationRef = useRef<number>(0);
  const currentUtteranceRef = useRef<string>("");
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SILENCE_IDLE_TIMEOUT_MS = 45000;

  const resetSilenceTimeout = () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    lastActivityAtRef.current = Date.now();
    if (isOpenRef.current && !isProcessingRef.current && !isSpeakingRef.current && !showVoiceSettingsRef.current) {
      silenceTimeoutRef.current = setTimeout(() => {
        if (
          isOpenRef.current &&
          !isProcessingRef.current &&
          !isSpeakingRef.current &&
          !showVoiceSettingsRef.current &&
          !NativeVoiceService.isSpeaking()
        ) {
          stopListening();
        }
      }, SILENCE_IDLE_TIMEOUT_MS);
    }
  };

  const checkVoiceBreakout = (text: string) => {
    if (isVoiceBreakoutCommand(text)) {
      handleClose();
      return true;
    }
    return false;
  };
  
  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);
  useEffect(() => { 
    isListeningRef.current = isListening; 
    if (typeof window !== "undefined") {
      (window as any).__attendx_ai_listening = isListening;
    }
  }, [isListening]);
  
  useEffect(() => { 
    isSpeakingRef.current = isSpeaking; 
    if (typeof window !== "undefined") {
      (window as any).__attendx_ai_speaking = isSpeaking;
    }
  }, [isSpeaking]);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  useEffect(() => {
    isOpenRef.current = isOpen;
    if (typeof window !== "undefined") {
      (window as any).__attendx_voice_mode_active = isOpen;
    }
    if (isOpen) {
      try {
        localStorage.setItem("onboarding_voice_mode", "true");
        api.patch("/users/onboarding-status", { step: "voice_mode" }).catch(() => {});
        window.dispatchEvent(new CustomEvent("onboarding-step-completed", { detail: { step: "voice_mode" } }));
      } catch {}
    }
    return () => {
      if (typeof window !== "undefined") {
        (window as any).__attendx_voice_mode_active = false;
        (window as any).__attendx_ai_listening = false;
        (window as any).__attendx_ai_speaking = false;
      }
    };
  }, [isOpen]);

  // Stop all active voice operations on unmount
  useEffect(() => {
    return () => {
      clearAutoRestartTimer();
      NativeVoiceService.stopContinuousLoop();
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    };
  }, []);

  const handleClose = () => {
    turnIdRef.current++;
    clearAutoRestartTimer();
    isOpenRef.current = false; // Killswitch for TTS & async turns
    isProcessingRef.current = false;
    isSpeakingRef.current = false;
    isListeningRef.current = false;
    showVoiceSettingsRef.current = false;
    userMutedMicRef.current = false;
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    NativeVoiceService.stopSpeaking();
    NativeVoiceService.stopContinuousLoop();
    onClose();
    setShowVoiceSettings(false);
    setIsSpeaking(false);
    setIsListening(false);
    setIsProcessing(false);
    setTranscript("");
    transcriptRef.current = "";
    lastSubmittedVoiceQueryRef.current = "";
    currentUtteranceRef.current = "";
    setLastResponse("");
    setProcessingLabel("Thinking...");
    speechStartTimeRef.current = 0;
    setSpeechStartTime(0);
    speechTotalDurationRef.current = 0;
    setSpeechDuration(0);
    setAudioProgressMs(-1);
    setAudioDurationMs(0);
    setNativeCharIndex(-1);
  };

  const getListenOptions = () => ({
    lang: "en-IN",
    onStart: () => {
      micStartTimeRef.current = Date.now();
      if (isOpenRef.current && !showVoiceSettingsRef.current) {
        setIsListening(true);
        isListeningRef.current = true;
        setTranscript("");
        transcriptRef.current = "";
        resetSilenceTimeout();
      }
    },
    onPartialResult: (text: string) => {
      if (!isSpeakingRef.current && !isProcessingRef.current && isOpenRef.current && !showVoiceSettingsRef.current) {
        if (text === lastSubmittedVoiceQueryRef.current && (Date.now() - micStartTimeRef.current < 1500)) {
          return;
        }
        // Clear previous AI answer the instant new user speech arrives
        if (text.trim()) {
          setLastResponse("");
          speechStartTimeRef.current = 0;
          setSpeechStartTime(0);
          setAudioProgressMs(-1);
          setAudioDurationMs(0);
          setNativeCharIndex(-1);
        }
        setTranscript(text);
        transcriptRef.current = text;
        resetSilenceTimeout();
      }
    },
    onFinalResult: (text: string) => {
      if (!isSpeakingRef.current && !isProcessingRef.current && isOpenRef.current && !showVoiceSettingsRef.current) {
        if (text === lastSubmittedVoiceQueryRef.current && (Date.now() - micStartTimeRef.current < 1500)) {
          return;
        }
        if (text.trim()) {
          setLastResponse("");
          speechStartTimeRef.current = 0;
          setSpeechStartTime(0);
          setAudioProgressMs(-1);
          setAudioDurationMs(0);
          setNativeCharIndex(-1);
        }
        setTranscript(text);
        transcriptRef.current = text;
        resetSilenceTimeout();
      }
    },
    onError: (err: any) => {
      const errCode = String(err?.error || err?.code || "").toLowerCase();
      const errMsg = String(err?.message || err || "").toLowerCase();
      const isPermissionError = errCode.includes("not-allowed") || errMsg.includes("permission") || errMsg.includes("denied");
      const isRecoverableSilence =
        !isPermissionError &&
        (errCode === "no-speech" ||
          errCode === "aborted" ||
          errCode === "6" ||
          errCode === "7" ||
          errMsg.includes("no match") ||
          errMsg.includes("no speech") ||
          errMsg.includes("timeout") ||
          !transcriptRef.current.trim());

      const withinActiveWindow = Date.now() - lastActivityAtRef.current < SILENCE_IDLE_TIMEOUT_MS;
      if (
        isRecoverableSilence &&
        withinActiveWindow &&
        isOpenRef.current &&
        !userMutedMicRef.current &&
        !showVoiceSettingsRef.current &&
        !isProcessingRef.current &&
        !isSpeakingRef.current
      ) {
        // Android SpeechRecognizer times out every ~3-5s of silence; keep UI listening and let onEnd silently restart
        return;
      }

      console.warn("Voice overlay recognition error:", err);
      if (isOpenRef.current) {
        setIsListening(false);
        isListeningRef.current = false;
      }
    },
    onEnd: () => {
      if (
        isOpenRef.current &&
        !showVoiceSettingsRef.current &&
        !NativeVoiceService.isSpeaking() &&
        !isSpeakingRef.current &&
        !isProcessingRef.current
      ) {
        if (transcriptRef.current.trim()) {
          // OS ended utterance with captured speech: submit immediately
          setIsListening(false);
          isListeningRef.current = false;
          handleProcessVoiceInput();
        } else if (
          !userMutedMicRef.current &&
          Date.now() - lastActivityAtRef.current < SILENCE_IDLE_TIMEOUT_MS
        ) {
          // Android SpeechRecognizer stopped on short silence pause: silently keep listening within the 45s window
          clearAutoRestartTimer();
          autoRestartTimerRef.current = setTimeout(async () => {
            autoRestartTimerRef.current = null;
            if (
              !isOpenRef.current ||
              userMutedMicRef.current ||
              showVoiceSettingsRef.current ||
              isProcessingRef.current ||
              isSpeakingRef.current ||
              NativeVoiceService.isSpeaking()
            ) {
              return;
            }
            const options = getListenOptions();
            NativeVoiceService.startContinuousLoop(options);
            const restarted = await NativeVoiceService.startListening(options);
            if (!restarted && isOpenRef.current && !isProcessingRef.current && !isSpeakingRef.current) {
              setIsListening(false);
              isListeningRef.current = false;
            }
          }, 350);
        } else {
          // Silence window elapsed or user muted: transition cleanly to idle
          stopListening();
        }
      }
    },
  });

  const startListening = async () => {
    if (!isOpenRef.current || showVoiceSettingsRef.current) return;
    clearAutoRestartTimer();
    turnIdRef.current++;
    userMutedMicRef.current = false;
    lastActivityAtRef.current = Date.now();
    await NativeVoiceService.stopSpeaking();
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    setIsProcessing(false);
    isProcessingRef.current = false;
    // Clear previous answer & word-reveal timers when user activates listening
    setLastResponse("");
    currentUtteranceRef.current = "";
    speechStartTimeRef.current = 0;
    setSpeechStartTime(0);
    speechTotalDurationRef.current = 0;
    setSpeechDuration(0);
    setAudioProgressMs(-1);
    setAudioDurationMs(0);
    setNativeCharIndex(-1);
    setTranscript("");
    transcriptRef.current = "";

    const options = getListenOptions();
    NativeVoiceService.startContinuousLoop(options);
    const started = await NativeVoiceService.startListening(options);
    if (!started && isOpenRef.current) {
      setIsListening(false);
      isListeningRef.current = false;
    }
  };

  const stopListening = async () => {
    clearAutoRestartTimer();
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    setIsListening(false);
    isListeningRef.current = false;
    await NativeVoiceService.stopContinuousLoop();
  };

  const toggleMicMute = () => {
    NativeVoiceService.unlockAudio();
    if (isListeningRef.current) {
      userMutedMicRef.current = true;
      stopListening();
    } else {
      userMutedMicRef.current = false;
      lastActivityAtRef.current = Date.now();
      startListening();
    }
  };

  const handleSpeakText = async (text: string, expectedTurnId = turnIdRef.current) => {
    if (!isOpenRef.current || expectedTurnId !== turnIdRef.current) return; // Abort if closed or superseded

    clearAutoRestartTimer();
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    const cleanText = NativeVoiceService.cleanTextForSpeech(text);
    if (!cleanText) {
      setIsProcessing(false);
      isProcessingRef.current = false;
      setLastResponse("");
      if (isOpenRef.current && !userMutedMicRef.current && !showVoiceSettingsRef.current) {
        startListening();
      }
      return;
    }

    currentUtteranceRef.current = cleanText;
    const wordCount = cleanText.split(/\s+/).length;
    // Calibrated initial duration until real audio duration arrives from metadata
    const expectedDurationMs = (wordCount / 2.2) * 1000 + 800;

    // Reset all timing clocks until audio physically starts coming from ElevenLabs or fallback TTS
    speechStartTimeRef.current = 0;
    setSpeechStartTime(0);
    speechTotalDurationRef.current = expectedDurationMs;
    setSpeechDuration(expectedDurationMs);
    setAudioProgressMs(-1);
    setAudioDurationMs(0);
    setNativeCharIndex(-1);

    if (voiceEnabledRef.current) {
      await NativeVoiceService.stopSpeaking();
      if (!isOpenRef.current || expectedTurnId !== turnIdRef.current) return;

      await NativeVoiceService.speak(cleanText, {
        lang: "en-IN",
        autoResumeListening: !userMutedMicRef.current && !showVoiceSettingsRef.current,
        listenOptions: getListenOptions(),
        onProvider: (provider) => {
          if (!isOpenRef.current || expectedTurnId !== turnIdRef.current) return;
          setActiveTtsProvider(provider);
        },
        onDuration: (durationMs) => {
          if (!isOpenRef.current || expectedTurnId !== turnIdRef.current) return;
          setAudioDurationMs(durationMs);
          if (speechStartTimeRef.current > 0 && speechTotalDurationRef.current > 0) {
            const oldDuration = speechTotalDurationRef.current;
            const now = Date.now();
            const elapsed = now - speechStartTimeRef.current;
            const ratio = Math.min(1, Math.max(0, elapsed / oldDuration));
            const newElapsed = ratio * durationMs;
            const newStartTime = now - newElapsed;
            speechStartTimeRef.current = newStartTime;
            setSpeechStartTime(newStartTime);
          }
          speechTotalDurationRef.current = durationMs;
          setSpeechDuration(durationMs);
        },
        onProgress: (currentTimeMs, durationMs) => {
          if (!isOpenRef.current || expectedTurnId !== turnIdRef.current) return;
          setAudioProgressMs(currentTimeMs);
          if (durationMs > 0) {
            setAudioDurationMs(durationMs);
          }
        },
        onWordCharIndex: (charIndex) => {
          if (!isOpenRef.current || expectedTurnId !== turnIdRef.current) return;
          setNativeCharIndex(charIndex);
        },
        onStart: () => {
          if (!isOpenRef.current || expectedTurnId !== turnIdRef.current) return;
          // Voice audio has physically started playing: reveal & start synchronized word highlight now
          const startedAt = Date.now();
          speechStartTimeRef.current = startedAt;
          setSpeechStartTime(startedAt);
          setLastResponse(cleanText);
          setIsProcessing(false);
          isProcessingRef.current = false;
          setIsSpeaking(true);
          isSpeakingRef.current = true;
        },
        onEnd: () => {
          if (expectedTurnId !== turnIdRef.current) return;
          setIsProcessing(false);
          isProcessingRef.current = false;
          setIsSpeaking(false);
          isSpeakingRef.current = false;
          lastActivityAtRef.current = Date.now();
          resetSilenceTimeout();
        },
        onError: () => {
          if (expectedTurnId !== turnIdRef.current) return;
          setIsProcessing(false);
          isProcessingRef.current = false;
          setIsSpeaking(false);
          isSpeakingRef.current = false;
          // Show text response gracefully when muted/offline TTS fails instead of eating the reply
          setLastResponse(cleanText);
          if (isOpenRef.current && !userMutedMicRef.current && !showVoiceSettingsRef.current) {
            startListening();
          }
        }
      });
    } else {
      // Speaker muted intentionally: reveal text immediately and resume listening
      setIsProcessing(false);
      isProcessingRef.current = false;
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      setLastResponse(cleanText);
      const startedAt = Date.now();
      speechStartTimeRef.current = startedAt;
      setSpeechStartTime(startedAt);
      if (isOpenRef.current && !userMutedMicRef.current && !showVoiceSettingsRef.current) {
        startListening();
      }
    }
  };

  const handleProcessVoiceInput = async () => {
    const currentTranscript = transcriptRef.current || transcript;
    if (!isOpenRef.current || !currentTranscript.trim() || isProcessingRef.current) return;

    clearAutoRestartTimer();
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    const rawQuery = currentTranscript.trim();
    if (checkVoiceBreakout(rawQuery)) {
      return;
    }

    // Normalize common speech splits (e.g. "time table" -> "timetable")
    const query = normalizeCopilotQuery(rawQuery);

    const currentTurn = ++turnIdRef.current;

    // Pause mic before AI thinking & TTS so STT cannot catch echo or fire stale onEnd
    setIsListening(false);
    isListeningRef.current = false;
    await NativeVoiceService.stopListening();

    setIsProcessing(true);
    isProcessingRef.current = true;
    lastSubmittedVoiceQueryRef.current = query;
    // Clear previous answer immediately when starting a new request
    setLastResponse("");
    speechStartTimeRef.current = 0;
    setSpeechStartTime(0);
    setSpeechDuration(0);
    setAudioProgressMs(-1);
    setAudioDurationMs(0);
    setNativeCharIndex(-1);

    if (pendingActionMsgId) {
      const cleanQuery = query.trim().toLowerCase().replace(/[.,!]/g, '');
      const isConfirming = /(yes|yeah|yep|do it|confirm|execute|sure|ok|okay|yes please|sure do it|yeah do it|yes yes do it|proceed)/.test(cleanQuery);
      const isCanceling = /(no|nope|cancel|abort|stop|don't|do not|no thanks|no do not cancel)/.test(cleanQuery);

      if (isConfirming) {
        onConfirmPendingAction?.(pendingActionMsgId);
        setTranscript("");
        transcriptRef.current = "";
        setProcessingLabel("Preparing voice...");
        await handleSpeakText("Action confirmed.", currentTurn);
        return;
      } else if (isCanceling) {
        onCancelPendingAction?.(pendingActionMsgId);
        setTranscript("");
        transcriptRef.current = "";
        setProcessingLabel("Preparing voice...");
        await handleSpeakText("Action cancelled.", currentTurn);
        return;
      }
    }

    // Show processing filler label separately without putting stale/dummy text into the response parser
    const randomFiller = VISUAL_FILLER_PHRASES[Math.floor(Math.random() * VISUAL_FILLER_PHRASES.length)];
    setProcessingLabel(randomFiller);

    try {
      const response = await onSendMessage(query, 'voice_overlay');
      if (!isOpenRef.current || currentTurn !== turnIdRef.current) return;

      await NativeVoiceService.stopSpeaking();
      if (!isOpenRef.current || currentTurn !== turnIdRef.current) return;

      if (response) {
        setTranscript("");
        transcriptRef.current = "";
        // Stay in PROCESSING ("Preparing voice...") until TTS audio physically starts playing
        setProcessingLabel("Preparing voice...");
        await handleSpeakText(response, currentTurn);
      } else {
        setIsProcessing(false);
        isProcessingRef.current = false;
        setTranscript("");
        transcriptRef.current = "";
        setLastResponse("");
        if (isOpenRef.current && !userMutedMicRef.current && !showVoiceSettingsRef.current) {
          startListening();
        }
      }
    } catch (err) {
      await NativeVoiceService.stopSpeaking();
      setIsProcessing(false);
      isProcessingRef.current = false;
      setTranscript("");
      transcriptRef.current = "";
      setLastResponse("");
      if (isOpenRef.current && currentTurn === turnIdRef.current) {
        setProcessingLabel("Preparing voice...");
        await handleSpeakText("I encountered an error. Please try again.", currentTurn);
      }
    }
  };

  // Auto-submit after natural speaking pause or when manually stopped
  useEffect(() => {
    if (isOpen && transcript.trim() && !isProcessing && !isSpeaking && !showVoiceSettings) {
      const delay = isListening ? 1600 : 500;
      const timer = setTimeout(() => {
        handleProcessVoiceInput();
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isListening, transcript, isProcessing, isSpeaking, showVoiceSettings]);

  // When Voice Mode opens, clear stale answers and start listening fresh
  useEffect(() => {
    if (isOpen) {
      turnIdRef.current++;
      clearAutoRestartTimer();
      userMutedMicRef.current = false;
      showVoiceSettingsRef.current = false;
      lastActivityAtRef.current = Date.now();
      setShowVoiceSettings(false);
      setTranscript("");
      transcriptRef.current = "";
      lastSubmittedVoiceQueryRef.current = "";
      currentUtteranceRef.current = "";
      setLastResponse("");
      setProcessingLabel("Thinking...");
      speechStartTimeRef.current = 0;
      setSpeechStartTime(0);
      speechTotalDurationRef.current = 0;
      setSpeechDuration(0);
      setAudioProgressMs(-1);
      setAudioDurationMs(0);
      setNativeCharIndex(-1);
      setIsProcessing(false);
      isProcessingRef.current = false;
      setIsSpeaking(false);
      isSpeakingRef.current = false;

      // Start listening cleanly without storing fake answer text in lastResponse
      const t = setTimeout(() => {
        if (isOpenRef.current) {
          startListening();
        }
      }, 120);
      return () => clearTimeout(t);
    } else {
      turnIdRef.current++;
      clearAutoRestartTimer();
      stopListening();
      NativeVoiceService.stopSpeaking();
      setTranscript("");
      transcriptRef.current = "";
      setLastResponse("");
      speechStartTimeRef.current = 0;
      setSpeechStartTime(0);
      setAudioProgressMs(-1);
      setAudioDurationMs(0);
      setNativeCharIndex(-1);
      setIsProcessing(false);
      setIsSpeaking(false);
    }
  }, [isOpen]);

  // Pause mic/speech when backgrounded; auto-resume smoothly when returning to foreground
  useEffect(() => {
    const listener = App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive && isOpenRef.current) {
        stopListening();
        NativeVoiceService.stopSpeaking();
      } else if (
        isActive &&
        isOpenRef.current &&
        !userMutedMicRef.current &&
        !showVoiceSettingsRef.current &&
        !isProcessingRef.current &&
        !isSpeakingRef.current &&
        !isListeningRef.current
      ) {
        lastActivityAtRef.current = Date.now();
        clearAutoRestartTimer();
        autoRestartTimerRef.current = setTimeout(() => {
          autoRestartTimerRef.current = null;
          if (isOpenRef.current && !userMutedMicRef.current && !showVoiceSettingsRef.current && !isProcessingRef.current && !isSpeakingRef.current) {
            startListening();
          }
        }, 300);
      }
    });
    return () => { listener.then(l => l.remove()); };
  }, []);
  const getUiState = () => {
    if (isProcessing) return "PROCESSING";
    if (isSpeaking) return "SPEAKING";
    if (isListening) return "LISTENING";
    return "IDLE";
  };
  
  const uiState = getUiState();

  if (typeof document === "undefined") return null;

  const providerBadgeLabel =
    activeTtsProvider === "elevenlabs"
      ? "ElevenLabs"
      : activeTtsProvider === "google-tts"
      ? "Google TTS"
      : activeTtsProvider === "native-tts"
      ? "Device Voice"
      : null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[200] flex flex-col bg-[#f8fafc] dark:bg-[#000000] text-slate-900 dark:text-[#FFFFFF] origin-center overflow-hidden overscroll-none"
        >
          {/* Top Bar */}
          <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-[calc(env(safe-area-inset-top,0px)+1rem)] relative z-[60] shrink-0">
            <motion.button
              type="button"
              whileHover={{ scale: 1.08, rotate: 90 }}
              whileTap={{ scale: 0.88, rotate: -90 }}
              onClick={handleClose}
              aria-label="Close Voice Mode"
              className="flex items-center justify-center w-11 h-11 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-[0_6px_20px_rgba(244,63,94,0.35)] cursor-pointer relative z-[70] shrink-0"
            >
              <X className="w-5 h-5 stroke-[2.75]" />
            </motion.button>

            {/* Active Voice & TTS Engine Pill */}
            <button
              type="button"
              onClick={openVoiceSettings}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-200/85 hover:bg-slate-300/80 dark:bg-zinc-900/90 dark:hover:bg-zinc-800 border border-slate-300/70 dark:border-zinc-800 text-xs font-medium text-slate-700 dark:text-zinc-200 transition-colors cursor-pointer max-w-[56%] truncate"
              title="Change Voice"
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  uiState === "SPEAKING"
                    ? "bg-rose-500 animate-pulse"
                    : uiState === "LISTENING"
                    ? "bg-emerald-500 animate-pulse"
                    : uiState === "PROCESSING"
                    ? "bg-sky-500 animate-pulse"
                    : "bg-slate-400 dark:bg-zinc-500"
                }`}
              />
              <span className="truncate">
                {activeVoiceInfo?.alias || "Bella"}
                {providerBadgeLabel ? ` · ${providerBadgeLabel}` : ""}
              </span>
            </button>

            <button
              type="button"
              aria-label={voiceEnabled ? "Mute AI Speech" : "Unmute AI Speech"}
              onClick={() => {
                NativeVoiceService.unlockAudio();
                setVoiceEnabled((prev) => {
                  const nextVal = !prev;
                  if (!nextVal) {
                    // Muted: kill actual audio, but let master timeline continue running silently
                    NativeVoiceService.stopSpeaking();
                  } else {
                    // Unmuted: calculate how much text is left, and speak that substring
                    const elapsedMs = Date.now() - speechStartTimeRef.current;
                    const remainingMs = speechTotalDurationRef.current - elapsedMs;

                    if (remainingMs > 0 && isSpeakingRef.current) {
                      const elapsedWords = Math.floor((elapsedMs / 1000) * 2.2);
                      const remainingText = currentUtteranceRef.current.split(/\s+/).slice(elapsedWords).join(" ");
                      if (remainingText) {
                        NativeVoiceService.speak(remainingText, {
                          lang: "en-IN",
                          onProvider: (provider) => setActiveTtsProvider(provider),
                        });
                      }
                    }
                  }
                  return nextVal;
                });
              }}
              className="flex items-center justify-center w-11 h-11 rounded-full bg-slate-200/90 hover:bg-slate-300/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-300/70 dark:border-zinc-800 transition-colors cursor-pointer shrink-0"
            >
              {voiceEnabled ? (
                <Volume2 className="w-5 h-5 text-slate-800 dark:text-[#FFFFFF]" />
              ) : (
                <VolumeX className="w-5 h-5 text-rose-500 dark:text-rose-400" />
              )}
            </button>
          </header>

          {/* Center Content: AI Orb & Transcript */}
          <main className="flex-1 flex flex-col items-center justify-center px-5 py-4 gap-8 lg:gap-14 relative min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

            {/* Dynamic Transcript Area (above orb for visibility) */}
            <div className="w-full max-w-2xl px-4 sm:px-8 text-center min-h-[104px] flex items-end justify-center z-10">
              <AnimatePresence mode="wait">
                {uiState === "LISTENING" && transcript ? (
                  <motion.p
                    key="transcript"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-2xl font-semibold text-slate-950 dark:text-[#FFFFFF] italic"
                  >
                    "{maskProfanity(transcript)}<span className="animate-pulse inline-block ml-[2px] font-light">|</span>"
                  </motion.p>
                ) : uiState === "PROCESSING" ? (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-2.5"
                  >
                    {transcript && (
                      <p className="text-sm text-slate-500 dark:text-zinc-400 italic">
                        Heard: "{maskProfanity(transcript)}"
                      </p>
                    )}
                    <p className="text-xl font-medium text-slate-800 dark:text-zinc-100 animate-pulse">
                      {processingLabel}
                    </p>
                  </motion.div>
                ) : uiState === "SPEAKING" || (cleanedResponseText && !transcript) ? (
                  <motion.div
                    key={`speaking-${speechStartTime}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full flex items-center justify-center"
                  >
                    <CinematicText
                      text={cleanedResponseText}
                      startTime={speechStartTime}
                      durationMs={speechDuration}
                      audioProgressMs={audioProgressMs}
                      audioDurationMs={audioDurationMs}
                      nativeCharIndex={nativeCharIndex}
                      isDone={uiState !== "SPEAKING"}
                    />
                  </motion.div>
                ) : (
                  <motion.p
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`text-lg sm:text-xl tracking-tight ${
                      uiState === "LISTENING"
                        ? "text-slate-900 dark:text-[#FFFFFF] font-medium"
                        : "text-slate-600 dark:text-zinc-300 font-normal"
                    }`}
                  >
                    {uiState === "LISTENING" ? "Hey there, how can I help you today?" : "Tap the microphone to speak"}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Dual-Theme Animated Orb */}
            <AnimatedVoiceOrb uiState={uiState} />

            {/* Pending Action Confirmation Buttons */}
            <AnimatePresence>
              {pendingActionMsgId && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="flex justify-center gap-4 z-30 mt-4 w-full px-6"
                >
                  <button
                    type="button"
                    onClick={() => {
                      NativeVoiceService.unlockAudio();
                      onCancelPendingAction?.(pendingActionMsgId);
                      handleSpeakText("Action cancelled.");
                    }}
                    className="flex-1 max-w-[140px] py-3.5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-[#FFFFFF] border border-slate-300/80 dark:border-zinc-700 transition-colors font-medium tracking-wide cursor-pointer"
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      NativeVoiceService.unlockAudio();
                      onConfirmPendingAction?.(pendingActionMsgId);
                      handleSpeakText("Action confirmed.");
                    }}
                    className="flex-1 max-w-[140px] py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 transition-colors font-semibold tracking-wide cursor-pointer"
                  >
                    Yes
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* Bottom Bar Controls - Compact, overflow-proof pill aligned on 360px+ screens */}
          <footer className="px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] flex justify-center w-full shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-full w-full max-w-md overflow-hidden bg-white dark:bg-[#141720] border border-slate-200/90 dark:border-zinc-700/70 shadow-[0_12px_40px_rgba(15,23,42,0.12)] dark:shadow-2xl">

              {/* Text Input Switch -> Returns to Text Chat */}
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 min-w-0 flex items-center gap-2 pl-3 pr-2 h-11 sm:h-12 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors text-slate-700 dark:text-zinc-200 cursor-pointer"
              >
                <span className="text-lg leading-none font-light shrink-0">+</span>
                <span className="truncate whitespace-nowrap text-sm font-medium">Ask AttendX...</span>
              </button>

              {/* Explicit High-Contrast Stop Conversation Button */}
              <button
                type="button"
                onClick={handleClose}
                className="flex items-center justify-center gap-1.5 px-3 sm:px-3.5 h-11 rounded-full bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-semibold text-xs sm:text-sm transition-colors cursor-pointer shadow-md shrink-0"
                title="Stop Conversation"
              >
                <Square className="w-3.5 h-3.5 fill-current shrink-0" />
                <span className="hidden sm:inline">Stop Conversation</span>
                <span className="sm:hidden">Stop</span>
              </button>

              {/* Center Mic Toggle Button */}
              <button
                type="button"
                onClick={toggleMicMute}
                aria-label={uiState === "LISTENING" ? "Mute Microphone" : "Unmute Microphone"}
                className={`flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 shrink-0 rounded-full transition-colors cursor-pointer ${
                  uiState === "LISTENING"
                    ? "bg-slate-900 dark:bg-[#FFFFFF] ring-2 ring-rose-500/35 shadow-lg"
                    : "bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                }`}
                title={uiState === "LISTENING" ? "Mute Microphone" : "Unmute Microphone"}
              >
                {uiState === "LISTENING" ? (
                  <Mic className="w-5 h-5 text-rose-500 animate-pulse" />
                ) : uiState === "IDLE" ? (
                  <MicOff className="w-5 h-5 text-slate-600 dark:text-zinc-300" />
                ) : (
                  <Mic className="w-5 h-5 text-slate-800 dark:text-[#FFFFFF]" />
                )}
              </button>

              {/* Voice Settings Button (cleanly contained inside the pill) */}
              <button
                type="button"
                onClick={openVoiceSettings}
                aria-label="Voice Settings"
                className="flex items-center justify-center w-11 h-11 shrink-0 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors text-slate-700 dark:text-zinc-200 cursor-pointer"
                title="Voice Settings"
              >
                <Settings className="w-5 h-5" />
              </button>

            </div>
          </footer>

          {/* Voice Settings Bottom Sheet (Dual Light/Dark Contrast & Fixed Header/Footer) */}
          <AnimatePresence>
            {showVoiceSettings && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={closeVoiceSettings}
                  className="fixed inset-0 bg-slate-900/45 dark:bg-zinc-950/75 backdrop-blur-sm z-40"
                />
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 28, stiffness: 260 }}
                  className="fixed bottom-0 left-0 right-0 max-h-[76dvh] bg-white dark:bg-[#16181d] border-t border-slate-200 dark:border-zinc-800 rounded-t-3xl shadow-2xl z-50 flex flex-col overflow-hidden"
                >
                  {/* Fixed Sheet Header */}
                  <div className="shrink-0 px-5 pt-3 pb-3.5 border-b border-slate-200/80 dark:border-zinc-800/90">
                    <div className="w-10 h-1 bg-slate-300 dark:bg-zinc-700 rounded-full mx-auto mb-3" />
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-slate-950 dark:text-[#FFFFFF] leading-tight">
                          Choose Voice
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                          Tap any voice to hear an ElevenLabs preview
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={closeVoiceSettings}
                        aria-label="Close Voice Picker"
                        className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Dedicated Scrollable Voice List (never clipped by header or footer) */}
                  {curatedVoices.length === 0 ? (
                    <p className="text-slate-500 dark:text-zinc-400 text-sm text-center py-10">
                      No voices found on this device.
                    </p>
                  ) : (
                    <div
                      className="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-2.5 overscroll-contain"
                      style={{ scrollbarWidth: "thin" }}
                    >
                      {curatedVoices.map((cv) => {
                        const isSelected = previewVoice === cv.originalIndex;
                        return (
                          <button
                            type="button"
                            key={cv.originalIndex}
                            id={`voice-item-${cv.originalIndex}`}
                            onClick={() => {
                              NativeVoiceService.unlockAudio();
                              previewVoiceRef.current = cv.originalIndex;
                              setPreviewVoice(cv.originalIndex);
                              NativeVoiceService.speak(cv.sample, {
                                voice: cv.originalIndex,
                                pitch: cv.pitch,
                                rate: cv.rate,
                                elevenlabsVoiceId: cv.elevenLabsId,
                                onProvider: (provider) => setActiveTtsProvider(provider),
                              }).catch(console.error);
                            }}
                            className={`w-full text-left p-4 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                              isSelected
                                ? "bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500/40 dark:bg-emerald-500/15 dark:border-emerald-400/80"
                                : "bg-slate-100/95 hover:bg-slate-200/75 border-slate-200/80 dark:bg-[#20232b] dark:hover:bg-[#272b35] dark:border-zinc-800"
                            }`}
                          >
                            <div className="min-w-0">
                              <div
                                className={`text-base font-bold truncate ${
                                  isSelected
                                    ? "text-slate-950 dark:text-[#FFFFFF]"
                                    : "text-slate-900 dark:text-zinc-100"
                                }`}
                              >
                                {cv.alias}
                              </div>
                              <div
                                className={`text-xs mt-0.5 truncate ${
                                  isSelected
                                    ? "text-emerald-800 dark:text-emerald-200/90"
                                    : "text-slate-600 dark:text-zinc-400"
                                }`}
                              >
                                {cv.desc}
                              </div>
                            </div>
                            {isSelected && (
                              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-[#FFFFFF] shrink-0">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Fixed Footer Outside Scroll List */}
                  <div className="shrink-0 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] border-t border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-[#16181d]">
                    <button
                      type="button"
                      onClick={() => {
                        if (previewVoice !== null) {
                          setSelectedVoice(previewVoice);
                          localStorage.setItem("attendx_preferred_voice_index", previewVoice.toString());
                          const selectedCv = curatedVoices.find((v) => v.originalIndex === previewVoice);
                          if (selectedCv) {
                            localStorage.setItem("attendx_elevenlabs_voice_id", selectedCv.elevenLabsId);
                          }
                        }
                        closeVoiceSettings();
                      }}
                      className="w-full py-3.5 rounded-2xl font-semibold text-base bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 transition-colors cursor-pointer shadow-sm"
                    >
                      Confirm Voice
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};




















