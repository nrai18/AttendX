import { toast } from "sonner";
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, VolumeX, X, Menu, Settings, Globe, ChevronLeft, ChevronRight, Square } from "lucide-react";
import { NativeVoiceService } from "../../services/NativeVoiceService";
import { useBackHandlerStore } from "../../stores/backHandlerStore";

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

const CinematicText = ({ text, startTime, durationMs }: { text: string, startTime: number, durationMs: number }) => {
  const [elapsed, setElapsed] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frameId: number;
    const update = () => {
      setElapsed(Date.now() - startTime);
      frameId = requestAnimationFrame(update);
    };
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [startTime]);

  const words = useMemo(() => text.split(/\s+/), [text]);
  const activeIndex = durationMs > 0 
    ? Math.min(words.length - 1, Math.floor((elapsed / durationMs) * words.length))
    : Math.floor((elapsed / 1000) * 2.3);

  useEffect(() => {
    if (activeWordRef.current) {
      activeWordRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex]);

  return (
    <div ref={containerRef} className="max-h-[180px] md:max-h-[260px] overflow-y-auto w-full px-4 scroll-smooth" style={{
      maskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)',
      WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)'
    }}>
      <div className="py-[60px] flex flex-wrap justify-center content-center gap-x-[0.35em] gap-y-2">
        {words.map((word, i) => {
          const isPast = i < activeIndex;
          const isCurrent = i === activeIndex;
          
          return (
            <span
              key={i}
              ref={isCurrent ? activeWordRef : null}
              className={`text-2xl md:text-3xl lg:text-4xl font-semibold tracking-tight transition-all duration-300 ${
                isCurrent ? "text-white opacity-100 scale-105 drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]" :
                isPast ? "text-white/70 opacity-100" :
                "text-white/20 opacity-40 blur-[1px]"
              }`}
            >
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
};

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
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speechDuration, setSpeechDuration] = useState(0);
  const [speechStartTime, setSpeechStartTime] = useState(0);

  // Handle hardware back button to close overlay
  useEffect(() => {
    if (!isOpen) return;

    const unregister = useBackHandlerStore.getState().register(() => {
      handleClose();
      return true;
    });

    return () => unregister();
  }, [isOpen, onClose]);

  // Voice Settings State
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<number>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem("attendx_preferred_voice_index") : null;
    return saved !== null ? parseInt(saved, 10) : 1; // Default to Bella
  });
  const [previewVoice, setPreviewVoice] = useState<number | null>(null);



  useEffect(() => {
    const fetchVoices = async () => {
      const voices = await NativeVoiceService.getVoices();
      setAvailableVoices(voices);
    };
    
    fetchVoices();
    
    // Web Speech API dynamically loads voices asynchronously
    NativeVoiceService.bindVoicesChanged(fetchVoices);
  }, []);

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

  const openVoiceSettings = () => {
    setShowVoiceSettings(true);
    
    // Force stop the microphone so it doesn't transcribe the sample voices!
    if (isListeningRef.current) {
      NativeVoiceService.stopListening();
      setIsListening(false);
    }
    // Stop the AI if it is currently talking
    if (isSpeakingRef.current) {
      NativeVoiceService.stopSpeaking();
      setIsSpeaking(false);
    }
  };

  const handleVoiceScroll = () => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      if (!carouselRef.current) return;
      const scrollLeft = carouselRef.current.scrollLeft;
      const width = carouselRef.current.clientWidth;
      const index = Math.round(scrollLeft / width);
      
      if (curatedVoices[index]) {
        const cv = curatedVoices[index];
        // Compare with a ref to avoid side effects inside setPreviewVoice
        if (previewVoiceRef.current !== cv.originalIndex) {
          previewVoiceRef.current = cv.originalIndex;
          setPreviewVoice(cv.originalIndex);
          NativeVoiceService.speak(cv.sample, { 
            voice: cv.originalIndex, 
            elevenlabsVoiceId: cv.elevenLabsId,
            pitch: cv.pitch,
            rate: cv.rate
          });
        }
      }
    }, 250);
  };
  
  const isOpenRef = useRef(isOpen);
  const voiceEnabledRef = useRef(voiceEnabled);
  const previewVoiceRef = useRef<number | null>(null);

  // Setup when opening settings
  useEffect(() => {
    if (showVoiceSettings) {
      stopListening();
      
      if (curatedVoices.length > 0) {
        // Find the currently selected voice
        const activeIndex = curatedVoices.findIndex(cv => cv.originalIndex === selectedVoice);
        const targetIndex = activeIndex >= 0 ? activeIndex : 0;
        const activeCv = curatedVoices[targetIndex];
        
        if (activeCv) {
          // Set it as the preview voice so it highlights immediately
          previewVoiceRef.current = activeCv.originalIndex;
          setPreviewVoice(activeCv.originalIndex);
          
          // Scroll it into view (vertical list)
          setTimeout(() => {
            const el = document.getElementById(`voice-item-${activeCv.originalIndex}`);
            if (el) {
              el.scrollIntoView({ behavior: 'instant', block: 'center' });
            }
          }, 50); // slight delay for DOM mount
          
          // Force a sample playback for the initial open
          NativeVoiceService.speak(activeCv.sample, { 
            voice: activeCv.originalIndex, 
            elevenlabsVoiceId: activeCv.elevenLabsId,
            pitch: activeCv.pitch,
            rate: activeCv.rate
          }).catch(console.error);
        }
      }
    } else {
      // Reset preview voice when settings close so it will play again if opened
      previewVoiceRef.current = null;
      setPreviewVoice(null);
    }
  }, [showVoiceSettings, curatedVoices, selectedVoice]);
  const isSpeakingRef = useRef(isSpeaking);
  const isProcessingRef = useRef(isProcessing);
  const isListeningRef = useRef(isListening);
  const transcriptRef = useRef(transcript);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const speechStartTimeRef = useRef<number>(0);
  const speechTotalDurationRef = useRef<number>(0);
  const currentUtteranceRef = useRef<string>("");
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetSilenceTimeout = () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    if (isOpenRef.current && !isProcessingRef.current && !isSpeakingRef.current) {
      silenceTimeoutRef.current = setTimeout(() => {
        if (isOpenRef.current && !isProcessingRef.current && !NativeVoiceService.isSpeaking()) {
          toast.info("Hands-free paused due to 20s of inactivity.");
          stopListening();
        }
      }, 20000);
    }
  };

  const checkVoiceBreakout = (text: string) => {
    const norm = text.trim().toLowerCase().replace(/[.,!?;:]/g, "");
    const breakoutWords = ["stop", "cancel", "stop conversation", "goodbye", "exit", "quit"];
    if (breakoutWords.includes(norm)) {
      handleClose();
      return true;
    }
    return false;
  };
  
  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // Stop all active voice operations on unmount
  useEffect(() => {
    return () => {
      NativeVoiceService.stopContinuousLoop();
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    };
  }, []);

  const handleClose = () => {
    isOpenRef.current = false; // Killswitch for TTS
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    NativeVoiceService.stopContinuousLoop();
    onClose();
    setIsSpeaking(false);
    setIsListening(false);
    setIsProcessing(false);
  };

  const getListenOptions = () => ({
    lang: "en-IN",
    onStart: () => {
      if (isOpenRef.current) {
        setIsListening(true);
        setTranscript("");
      }
    },
    onPartialResult: (text: string) => {
      if (!isSpeakingRef.current && !isProcessingRef.current && isOpenRef.current) {
        setTranscript(text);
        resetSilenceTimeout();
        checkVoiceBreakout(text);
      }
    },
    onFinalResult: (text: string) => {
      if (!isSpeakingRef.current && !isProcessingRef.current && isOpenRef.current) {
        setTranscript(text);
        resetSilenceTimeout();
        checkVoiceBreakout(text);
      }
    },
    onError: (err: any) => {
      console.warn("Voice overlay recognition error:", err);
      if (err && err.error && err.error !== "no-speech" && err.error !== "aborted") {
        toast.error(`Mic Error: ${err.error}`);
      } else if (err && err.message) {
        toast.error(`Mic Error: ${err.message}`);
      }
      if (isOpenRef.current) {
        setIsListening(false);
      }
    },
    onEnd: () => {
      if (isOpenRef.current && !NativeVoiceService.isSpeaking() && !isProcessingRef.current) {
        if (transcriptRef.current.trim()) {
           // OS killed mic with text: force submit immediately
           setIsListening(false);
           handleProcessVoiceInput();
        } else {
           // OS killed mic with NO text: restart loop seamlessly ONLY if the app actually intended to be listening
           if (isListeningRef.current) {
             setTimeout(() => {
               if (isOpenRef.current && !NativeVoiceService.isSpeaking() && !isProcessingRef.current) {
                 startListening();
               }
             }, 100);
           }
        }
      }
    },
  });

  const startListening = async () => {
    if (!isOpenRef.current) return;
    await NativeVoiceService.stopSpeaking();
    setIsSpeaking(false);
    setIsProcessing(false);
    setTranscript("");
    transcriptRef.current = "";

    const options = getListenOptions();
    NativeVoiceService.startContinuousLoop(options);
    const started = await NativeVoiceService.startListening(options);
    if (!started && isOpenRef.current) {
      setIsListening(false);
    }
  };

  const stopListening = async () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    setIsListening(false);
    NativeVoiceService.stopContinuousLoop();
  };

  const handleSpeakText = async (text: string) => {
    if (!isOpenRef.current) return; // Abort if closed

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    const cleanText = NativeVoiceService.cleanTextForSpeech(text);
    if (!cleanText) {
      if (isOpenRef.current) {
        startListening();
      }
      return;
    }

    currentUtteranceRef.current = cleanText;
    const wordCount = cleanText.split(/\s+/).length;
    // Assume ~2.3 words per second for speech rate 1.05 with punctuation pauses
    const expectedDurationMs = (wordCount / 2.3) * 1000 + 1000;
    
    // DO NOT set speechStartTimeRef.current to Date.now() here!
    // This allows the uiState to remain PROCESSING while the native TTS engine boots up and downloads audio.
    // We only want the UI to transition to SPEAKING once the audio actually starts playing.
    speechStartTimeRef.current = 0; 
    setSpeechStartTime(0);
    speechTotalDurationRef.current = expectedDurationMs;
    setSpeechDuration(expectedDurationMs);

    if (voiceEnabledRef.current) {
      await NativeVoiceService.stopSpeaking();
      await NativeVoiceService.speak(cleanText, {
        lang: "en-IN",
        autoResumeListening: true,
        listenOptions: getListenOptions(),
        onDuration: (durationMs) => {
          // If speech already started, adjust the startTime so the cursor doesn't jump
          if (speechStartTimeRef.current > 0) {
            const oldDuration = speechTotalDurationRef.current;
            const now = Date.now();
            const elapsed = now - speechStartTimeRef.current;
            const ratio = elapsed / oldDuration;
            
            const newElapsed = ratio * durationMs;
            const newStartTime = now - newElapsed;
            
            speechStartTimeRef.current = newStartTime;
            setSpeechStartTime(newStartTime);
          }
          
          speechTotalDurationRef.current = durationMs;
          setSpeechDuration(durationMs);
        },
        onStart: () => {
          // Now the audio has physically started playing.
          speechStartTimeRef.current = Date.now();
          setSpeechStartTime(Date.now());
          setIsSpeaking(true);
        },
        onEnd: () => {
          setIsSpeaking(false);
          // Restart the 20s global inactivity timer now that the AI has finished answering
          resetSilenceTimeout();
        },
        onError: () => {
          setIsSpeaking(false);
          if (isOpenRef.current) {
            startListening();
          }
        }
      });
    } else {
      setIsSpeaking(false);
      if (isOpenRef.current) {
        startListening();
      }
    }
  };

  const handleProcessVoiceInput = async () => {
    if (!transcript.trim() || isProcessing) return;

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    const query = transcript.trim();
    if (checkVoiceBreakout(query)) {
      return;
    }
    
    // On native, we must stop the mic to avoid feedback loops and crashes.
    // IMPORTANT: Only pause the mic session — do NOT kill the continuous loop flag
    // so that handlePlaybackEnd can auto-resume listening after TTS finishes.
    if (Capacitor.isNativePlatform()) {
      setIsListening(false);
      isListeningRef.current = false;
      await NativeVoiceService.stopListening();
    }
    
    setIsProcessing(true);
    isProcessingRef.current = true;

    if (pendingActionMsgId) {
      const cleanQuery = query.trim().toLowerCase().replace(/[.,!]/g, '');
      const isConfirming = /^(yes|yeah|yep|do it|confirm|execute|sure|ok|okay|yes please|sure do it|yeah do it|yes yes do it|proceed)/.test(cleanQuery);
      const isCanceling = /^(no|nope|cancel|abort|stop|don't|do not|no thanks|no do not cancel)/.test(cleanQuery);

      if (isConfirming) {
        onConfirmPendingAction?.(pendingActionMsgId);
        setTranscript("");
        setIsProcessing(false);
        await handleSpeakText("Action confirmed.");
        return;
      } else if (isCanceling) {
        onCancelPendingAction?.(pendingActionMsgId);
        setTranscript("");
        setIsProcessing(false);
        await handleSpeakText("Action cancelled.");
        return;
      }
    }

    // Visually show we are processing, but do not block with spoken filler audio
    const randomFiller = VISUAL_FILLER_PHRASES[Math.floor(Math.random() * VISUAL_FILLER_PHRASES.length)];
    setLastResponse(randomFiller);

    try {
      const response = await onSendMessage(query, 'voice_overlay');
      // When the actual response is ready, stop any ongoing filler speech first
      await NativeVoiceService.stopSpeaking();
      if (response && isOpenRef.current) {
        setIsProcessing(false); // Stop processing state so onEnd can trigger listening
        setTranscript("");
        setLastResponse(response);
        await handleSpeakText(response);
      } else {
        setIsProcessing(false);
        setTranscript("");
        if (isOpenRef.current) {
          if (Capacitor.isNativePlatform() || !isListeningRef.current) {
            startListening();
          }
        }
      }
    } catch (err) {
      await NativeVoiceService.stopSpeaking();
      setIsProcessing(false);
      setTranscript("");
      if (isOpenRef.current) {
        setLastResponse("I encountered an error connecting to the policy advisor. Please try again.");
        await handleSpeakText("I encountered an error. Please try again.");
      }
    }
  };

  // Auto-submit after silence or when manually stopped
  useEffect(() => {
    if (transcript.trim() && !isProcessing && !isSpeaking) {
      const delay = isListening ? 5000 : 700;
      const timer = setTimeout(() => {
        handleProcessVoiceInput();
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [isListening, transcript, isProcessing, isSpeaking]);

  // When Voice Mode opens, we immediately start listening
  useEffect(() => {
    if (isOpen) {
      setTranscript("");
      setIsProcessing(false);
      setIsSpeaking(false);
      
      const greeting = "Hey there, how can I help you today?";
      setLastResponse(greeting);
      
      // Start listening instantly for better UX instead of waiting for a TTS greeting
      setTimeout(() => {
        if (isOpenRef.current) {
          startListening();
        }
      }, 100);
    } else {
      stopListening();
      NativeVoiceService.stopSpeaking();
    }
  }, [isOpen]);

  // Stop mic immediately if app is minimized
  useEffect(() => {
    const listener = App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive && isOpenRef.current) {
        stopListening();
        NativeVoiceService.stopSpeaking();
      }
    });
    return () => { listener.then(l => l.remove()); };
  }, []);

  if (!isOpen) return null;

  const getUiState = () => {
    if (isProcessing) return "PROCESSING";
    if (isSpeaking) return "SPEAKING";
    if (isListening) return "LISTENING";
    return "IDLE";
  };
  
  const uiState = getUiState();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 1.1, filter: "blur(15px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.95, filter: "blur(15px)" }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="chatbot-window fixed inset-0 z-[100] flex flex-col bg-black text-white origin-center"
        >
          {/* Top Bar - Mimicking ChatGPT layout */}
          <header className="flex items-center justify-between p-6 pt-safe-8 relative z-[60]">
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.85, rotate: -90 }}
              onClick={handleClose}
              className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] cursor-pointer relative z-[70]"
            >
              <X className="w-6 h-6 stroke-[3]" />
            </motion.button>
            <button
              onClick={() => {
                setVoiceEnabled((prev) => {
                  const nextVal = !prev;
                  if (!nextVal) {
                    // Muted: kill actual audio, but let master timeline continue running silently
                    NativeVoiceService.stopSpeaking();
                  } else {
                    // Unmuted: calculate how much text is left, and speak that substring!
                    const elapsedMs = Date.now() - speechStartTimeRef.current;
                    const remainingMs = speechTotalDurationRef.current - elapsedMs;
                    
                    if (remainingMs > 0 && isSpeakingRef.current) {
                        const elapsedWords = Math.floor((elapsedMs / 1000) * 2.3);
                        const remainingText = currentUtteranceRef.current.split(/\s+/).slice(elapsedWords).join(" ");
                        if (remainingText) {
                            NativeVoiceService.speak(remainingText, {
                              lang: "en-IN"
                            });
                        }
                    }
                  }
                  return nextVal;
                });
              }}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
            >
              {voiceEnabled ? <Volume2 className="w-5 h-5 text-white/80" /> : <VolumeX className="w-5 h-5 text-rose-400" />}
            </button>
          </header>

          {/* Center Content: AI Orb & Transcript */}
          <main className="flex-1 flex flex-col items-center justify-center p-6 gap-10 lg:gap-16 relative min-h-0 overflow-y-auto">
            
            {/* Dynamic Transcript Area (above orb for visibility) */}
            <div className="w-full max-w-2xl px-8 text-center min-h-[100px] flex items-end justify-center z-10">
               <AnimatePresence mode="wait">
                  {uiState === "LISTENING" && transcript ? (
                    <motion.p key="transcript" initial={{opacity:0, y: 10}} animate={{opacity:1, y: 0}} exit={{opacity:0}} className="text-2xl font-medium text-white/90 italic">
                      "{transcript}<span className="animate-pulse inline-block ml-[2px] font-light">|</span>"
                    </motion.p>
                  ) : uiState === "PROCESSING" ? (
                     <motion.div key="processing" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex flex-col items-center gap-3">
                        <p className="text-sm text-white/50 italic">Heard: "{transcript}"</p>
                        <p className="text-xl text-white/80 animate-pulse">{lastResponse}</p>
                     </motion.div>
                   ) : uiState === "SPEAKING" ? (
                      <motion.div 
                        key="speaking" 
                        initial={{opacity:0}} 
                        animate={{opacity:1}} 
                        exit={{opacity:0}}
                        className="w-full flex items-center justify-center"
                      >
                        <CinematicText 
                          text={NativeVoiceService.cleanTextForSpeech(lastResponse)} 
                          startTime={speechStartTime} 
                          durationMs={speechDuration}
                        />
                      </motion.div>
                   ) : (
                     <motion.p key="idle" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="text-lg text-white/50 font-light">
                       {uiState === "LISTENING" ? "Listening..." : "Tap the microphone to speak"}
                     </motion.p>
                  )}
               </AnimatePresence>
            </div>

            {/* The Animated ChatGPT-style Orb (Restored Beautiful Gradients) */}
            <div className="relative flex items-center justify-center w-64 h-64 mt-12">
               {/* Ambient Glow */}
               <motion.div
                  animate={{
                    scale: uiState === "LISTENING" ? [1, 1.2, 1] : uiState === "SPEAKING" ? [1, 1.4, 1.1, 1.3, 1] : uiState === "PROCESSING" ? [1, 1.1, 1] : [1, 1.05, 1],
                    opacity: uiState === "LISTENING" ? [0.3, 0.6, 0.3] : uiState === "SPEAKING" ? [0.4, 0.8, 0.4] : [0.2, 0.4, 0.2]
                  }}
                  transition={{ repeat: Infinity, duration: uiState === "SPEAKING" ? 1.5 : 2, ease: "easeInOut" }}
                  className={`absolute w-56 h-56 rounded-full blur-3xl ${
                    uiState === "LISTENING" ? "bg-white/40" : uiState === "SPEAKING" ? "bg-pink-500/50" : uiState === "PROCESSING" ? "bg-cyan-500/30" : "bg-white/10"
                  }`}
               />
               
               {/* Core Solid Orb */}
               <motion.div
                  animate={{
                    scale: uiState === "LISTENING" ? [1, 1.05, 1] : uiState === "SPEAKING" ? [1, 1.15, 0.95, 1.05, 1] : uiState === "PROCESSING" ? [1, 1.08, 1] : [1, 1.02, 1],
                  }}
                  transition={{ repeat: Infinity, duration: uiState === "SPEAKING" ? 1.2 : 2, ease: "easeInOut" }}
                  className={`relative z-10 w-36 h-36 sm:w-44 sm:h-44 rounded-full shadow-2xl transition-colors duration-700 bg-gradient-to-tr ${
                    uiState === "LISTENING" 
                      ? "from-gray-100 to-white shadow-white/40" 
                      : uiState === "SPEAKING" 
                      ? "from-pink-300 via-rose-400 to-white shadow-pink-500/50" 
                      : uiState === "PROCESSING" 
                      ? "from-cyan-100 to-cyan-300 shadow-cyan-500/40" 
                      : "from-gray-300 to-gray-400 shadow-white/20"
                  }`}
               />
            </div>

            {/* Pending Action Confirmation Buttons */}
            <AnimatePresence>
              {pendingActionMsgId && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="flex justify-center gap-4 z-30 mt-8 w-full px-6"
                >
                  <button
                    onClick={() => {
                      onCancelPendingAction?.(pendingActionMsgId);
                      handleSpeakText("Action cancelled.");
                    }}
                    className="flex-1 max-w-[140px] py-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white/90 border border-white/10 transition-colors backdrop-blur-md font-medium tracking-wide cursor-pointer"
                  >
                    No
                  </button>
                  <button
                    onClick={() => {
                      onConfirmPendingAction?.(pendingActionMsgId);
                      handleSpeakText("Action confirmed.");
                    }}
                    className="flex-1 max-w-[140px] py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 transition-colors font-semibold tracking-wide cursor-pointer"
                  >
                    Yes
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* Bottom Bar Controls - Mimicking ChatGPT layout with explicit Stop Conversation */}
          <footer className="p-6 pb-12 flex justify-center w-full">
            <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-xl p-2 rounded-[2rem] w-full max-w-md border border-slate-700/50 shadow-2xl">
              
              {/* Fake Text Input -> Returns to Text Chat */}
              <button
                onClick={handleClose}
                className="flex-1 flex items-center px-4 h-14 rounded-full hover:bg-white/5 transition-colors text-white/50 text-sm sm:text-base cursor-pointer"
              >
                <span className="text-xl mr-3 font-light">+</span> Ask AttendX...
              </button>

              {/* Explicit High-Contrast Stop Conversation Button (R3) */}
              <button
                type="button"
                onClick={handleClose}
                className="flex items-center gap-1.5 px-3.5 h-12 rounded-full bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-medium text-xs sm:text-sm transition-colors cursor-pointer shadow-md shrink-0"
                title="Stop Conversation"
              >
                <Square className="w-4 h-4 fill-current" />
                <span className="hidden sm:inline">Stop Conversation</span>
                <span className="sm:hidden">Stop</span>
              </button>

              {/* Center Mic Button */}
              <button
                onClick={uiState === "LISTENING" ? stopListening : startListening}
                className={`flex items-center justify-center w-14 h-14 shrink-0 rounded-full transition-colors cursor-pointer ${
                   uiState === "LISTENING" ? "bg-white text-black hover:bg-gray-200 shadow-[0_0_15px_rgba(255,255,255,0.5)]" : "bg-white/20 text-white hover:bg-white/30"
                }`}
                title={uiState === "LISTENING" ? "Mute Microphone" : "Unmute Microphone"}
              >
                {uiState === "LISTENING" ? (
                  <Mic className="w-6 h-6 text-rose-500 animate-pulse" />
                ) : uiState === "IDLE" ? (
                  <MicOff className="w-6 h-6 text-white/60" />
                ) : (
                  <Mic className="w-6 h-6 text-white/80" />
                )}
              </button>

              {/* Voice Settings Button */}
              <button
                onClick={openVoiceSettings}
                className="flex items-center justify-center w-14 h-14 shrink-0 rounded-full hover:bg-white/5 transition-colors text-white/50 cursor-pointer ml-auto"
                title="Voice Settings"
              >
                <Settings className="w-5 h-5" />
              </button>

            </div>
          </footer>

          {/* Voice Settings Modal (ChatGPT Style) */}
          <AnimatePresence>
            {showVoiceSettings && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowVoiceSettings(false)}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40"
                />
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="absolute bottom-0 left-0 right-0 bg-[#1e1e1e] rounded-t-3xl p-6 shadow-2xl z-50 flex flex-col gap-6"
                >
                  <div className="w-10 h-1 bg-white/20 rounded-full mx-auto -mt-2 mb-2" />
                  
                  {curatedVoices.length === 0 ? (
                    <p className="text-white/40 text-sm text-center py-8">No voices found on this device.</p>
                  ) : (
                    <div className="w-full relative max-h-[50vh] overflow-y-auto pr-2" style={{ scrollbarWidth: "thin" }}><div className="flex flex-col gap-2">{curatedVoices.map((cv, i) => (<div key={i} id={`voice-item-${cv.originalIndex}`} className={`p-4 rounded-xl flex flex-col cursor-pointer transition-all ${previewVoice === cv.originalIndex ? "bg-white/20 border border-white/30" : "bg-white/5 hover:bg-white/10 border border-transparent"}`} onClick={() => {setPreviewVoice(cv.originalIndex); NativeVoiceService.speak(cv.sample, {voice: cv.originalIndex, pitch: cv.pitch, rate: cv.rate, elevenlabsVoiceId: cv.elevenLabsId}).catch(console.error);}}><h2 className={`text-lg font-bold transition-colors ${previewVoice === cv.originalIndex ? "text-white" : "text-white/60"}`}>{cv.alias}</h2><p className="text-xs text-white/50 mt-1">{cv.desc}</p></div>))}</div><button onClick={() => {if (previewVoice !== null) {setSelectedVoice(previewVoice); localStorage.setItem("attendx_preferred_voice_index", previewVoice.toString()); const selectedCv = curatedVoices.find(v => v.originalIndex === previewVoice); if (selectedCv) {localStorage.setItem("attendx_elevenlabs_voice_id", selectedCv.elevenLabsId);}} setShowVoiceSettings(false);}} className="w-full bg-white text-black font-semibold rounded-2xl py-3 mt-6 hover:bg-gray-200 transition-colors cursor-pointer sticky bottom-0 z-10 shadow-[0_-20px_20px_-10px_rgba(30,30,30,0.9)]">Confirm Voice</button></div>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>

        </motion.div>
      )}
    </AnimatePresence>
  );
};




















