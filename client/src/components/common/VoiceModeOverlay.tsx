import { toast } from "sonner";
import { Capacitor } from '@capacitor/core';
import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, VolumeX, X, Menu, Settings, Globe, ChevronLeft, ChevronRight } from "lucide-react";
import { NativeVoiceService } from "../../services/NativeVoiceService";

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

  // Voice Settings State
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<number>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem("attendx_preferred_voice_index") : null;
    return saved !== null ? parseInt(saved, 10) : -1;
  });
  const [previewVoice, setPreviewVoice] = useState<number | null>(null);



  useEffect(() => {
    const fetchVoices = async () => {
      const voices = await NativeVoiceService.getVoices();
      setAvailableVoices(voices);
    };
    
    fetchVoices();
    
    // Web Speech API dynamically loads voices asynchronously
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = fetchVoices;
    }
  }, []);

  const curatedVoices = useMemo(() => {
    const englishVoices = availableVoices.filter(v => v.lang.startsWith('en'));
    const isWeb = !Capacitor.isNativePlatform();

    const aliases = [
       { name: "Nova", desc: "Female (Clear & Professional)", gender: "female", sample: "This is a sample voice. I am Nova, clear and professional.", pitch: 1.5, rate: 1.1 },
       { name: "Echo", desc: "Male (Calm & Affirming)", gender: "male", sample: "This is a sample voice. I am Echo, calm and affirming.", pitch: 0.8, rate: 0.9 },
       { name: "Breeze", desc: "Female (Animated & Earnest)", gender: "female", sample: "This is a sample voice. I am Breeze, animated and earnest.", pitch: 1.2, rate: 1.2 },
       { name: "Cove", desc: "Male (Deep & Composed)", gender: "male", sample: "This is a sample voice. I am Cove, deep and composed.", pitch: 0.6, rate: 0.85 },
       { name: "Sky", desc: "Female (Bright & Clear)", gender: "female", sample: "This is a sample voice. I am Sky, bright and clear.", pitch: 1.8, rate: 1.0 }
    ];

    const getGender = (vName: string) => {
        const name = (vName || "").toLowerCase();
        if (name.includes('female') || name.includes('zira') || name.includes('samantha') || name.includes('karen') || name.includes('victoria') || name.includes('tessa') || name.includes('ava') || name.includes('moira') || name.includes('susan') || name.includes('fiona')) return 'female';
        if (name.includes(' male') || name.includes('-male') || name.includes('david') || name.includes('daniel') || name.includes('mark') || name.includes('george') || name.includes('alex') || name.includes('tom') || name.includes('oliver') || name.includes('rishi') || name.includes('arthur')) return 'male';
        return 'unknown';
    };

    const selected: any[] = [];
    const usedIndices = new Set<number>();

    // For Web, intelligently pick voices matching the required alias gender
    for (const alias of aliases) {
      let matchedVoice = null;
      if (isWeb) {
        matchedVoice = englishVoices.find((v, idx) => !usedIndices.has(idx) && getGender(v.name) === alias.gender);
      }
      // Fallback 1: Just get one from a distinct region
      if (!matchedVoice) {
        const regions = ['en-US', 'en-GB', 'en-AU', 'en-IN', 'en-IE'];
        for (const region of regions) {
          const regionVoice = englishVoices.find((v, idx) => !usedIndices.has(idx) && v.lang.toLowerCase().includes(region.toLowerCase()));
          if (regionVoice) {
            matchedVoice = regionVoice;
            break;
          }
        }
      }
      // Fallback 2: Pick anything available
      if (!matchedVoice) {
        matchedVoice = englishVoices.find((v, idx) => !usedIndices.has(idx));
      }
      
      if (matchedVoice) {
        selected.push(matchedVoice);
        usedIndices.add(englishVoices.indexOf(matchedVoice));
      } else {
        break; // No more voices available
      }
    }

    return selected.map((v, i) => {
      const alias = aliases[i % aliases.length];
      
      // On Web (laptop), browsers already have distinct, high-quality male/female voices.
      // Extreme pitch shifting ruins them. We use a much milder modifier on Web.
      const finalPitch = isWeb 
        ? 1.0 + (alias.pitch - 1.0) * 0.2 // Shrinks [0.6, 1.8] to [0.92, 1.16]
        : alias.pitch;
        
      const finalRate = isWeb
        ? 1.0 + (alias.rate - 1.0) * 0.5 // Milder speed tweaks on Web
        : alias.rate;

      return {
        originalIndex: availableVoices.indexOf(v),
        voice: v,
        alias: alias.name,
        desc: alias.desc,
        sample: alias.sample,
        pitch: finalPitch,
        rate: finalRate
      };
    });
  }, [availableVoices]);

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
            lang: cv.voice.lang,
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

  // Sync scroll position when opening settings
  useEffect(() => {
    if (showVoiceSettings && carouselRef.current && curatedVoices.length > 0) {
      const activeIndex = curatedVoices.findIndex(cv => cv.originalIndex === selectedVoice);
      const targetIndex = activeIndex >= 0 ? activeIndex : 0;
      
      // Delay slightly for Framer Motion to mount the DOM element with dimensions
      setTimeout(() => {
        if (carouselRef.current) {
          carouselRef.current.scrollTo({ left: targetIndex * carouselRef.current.clientWidth, behavior: 'instant' });
          
          // Force a sample playback for the initial open, regardless of whether a scroll event fired
          const activeCv = curatedVoices[targetIndex];
          if (activeCv) {
            if (previewVoiceRef.current !== activeCv.originalIndex) {
              previewVoiceRef.current = activeCv.originalIndex;
              setPreviewVoice(activeCv.originalIndex);
              NativeVoiceService.speak(activeCv.sample, { 
                voice: activeCv.originalIndex, 
                lang: activeCv.voice.lang,
                pitch: activeCv.pitch,
                rate: activeCv.rate
              });
            }
          }
        }
      }, 100);
    } else if (!showVoiceSettings) {
      // Reset preview voice when settings close so it will play again if opened
      previewVoiceRef.current = null;
      setPreviewVoice(null);
    }
  }, [showVoiceSettings, curatedVoices, selectedVoice]);
  const isSpeakingRef = useRef(isSpeaking);
  const isProcessingRef = useRef(isProcessing);
  const isListeningRef = useRef(isListening);

  const speechStartTimeRef = useRef<number>(0);
  const speechTotalDurationRef = useRef<number>(0);
  const speechSimulatedTimeoutRef = useRef<any>(null);
  const currentUtteranceRef = useRef<string>("");
  
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
      NativeVoiceService.stopSpeaking();
      NativeVoiceService.stopListening();
      if (speechSimulatedTimeoutRef.current) clearTimeout(speechSimulatedTimeoutRef.current);
    };
  }, []);

  const handleClose = async () => {
    isOpenRef.current = false; // Killswitch for TTS
    await NativeVoiceService.stopSpeaking();
    await NativeVoiceService.stopListening();
    setIsSpeaking(false);
    setIsListening(false);
    setIsProcessing(false);
    onClose();
  };

  const listenSessionRef = useRef<number>(0);

  const startListening = async () => {
    await NativeVoiceService.stopSpeaking();
    setIsSpeaking(false);
    setTranscript("");
    setIsProcessing(false);
    setIsListening(true);
    
    const currentSession = Date.now();
    listenSessionRef.current = currentSession;

    const started = await NativeVoiceService.startListening({
      lang: "en-IN",
      onPartialResult: (text) => {
        if (!isSpeakingRef.current && !isProcessingRef.current && listenSessionRef.current === currentSession) {
          setTranscript(text);
        }
      },
      onFinalResult: (text) => {
        if (!isSpeakingRef.current && !isProcessingRef.current && listenSessionRef.current === currentSession) {
          setTranscript(text);
        }
      },
      onError: (err: any) => {
        console.warn("Voice overlay recognition error:", err);
        if (err && err.error && err.error !== "no-speech" && err.error !== "aborted") {
          toast.error(`Mic Error: ${err.error}`);
        }
        if (listenSessionRef.current === currentSession) {
          setIsListening(false);
        }
      },
      onEnd: () => {
        if (listenSessionRef.current === currentSession) {
          setIsListening(false);
        }
      },
    });

    if (!started && listenSessionRef.current === currentSession) {
      setIsListening(false);
    }
  };

  const stopListening = async () => {
    setIsListening(false);
    await NativeVoiceService.stopListening();
  };

  const handleSpeakText = async (text: string) => {
    if (!isOpenRef.current) return; // Abort if closed

    const triggerListen = () => {
      setTimeout(() => {
        setIsProcessing(prevIsProcessing => {
          if (!prevIsProcessing && isOpenRef.current) {
            if (Capacitor.isNativePlatform() || !isListeningRef.current) {
              startListening();
            }
          }
          return prevIsProcessing;
        });
      }, 500);
    };

    const cleanText = NativeVoiceService.cleanTextForSpeech(text);
    if (!cleanText) {
      triggerListen();
      return;
    }

    currentUtteranceRef.current = cleanText;
    const wordCount = cleanText.split(/\s+/).length;
    // Assume ~2.3 words per second for speech rate 1.05 with punctuation pauses
    const expectedDurationMs = (wordCount / 2.3) * 1000 + 1000;
    
    speechStartTimeRef.current = Date.now();
    speechTotalDurationRef.current = expectedDurationMs;

    setIsSpeaking(true);
    
    if (speechSimulatedTimeoutRef.current) {
        clearTimeout(speechSimulatedTimeoutRef.current);
    }
    
    // The master timeline that opens the mic when the AI finishes, whether audio is playing or silently skipped
    speechSimulatedTimeoutRef.current = setTimeout(() => {
        setIsSpeaking(false);
        triggerListen();
    }, expectedDurationMs);

    if (voiceEnabledRef.current) {
      await NativeVoiceService.stopSpeaking();
      // We don't await speak or pass onEnd because the master timeline controls state now
      NativeVoiceService.speak(cleanText, {
        lang: "en-IN"
      });
    }
  };

  const handleProcessVoiceInput = async () => {
    if (!transcript.trim() || isProcessing) return;

    const query = transcript.trim();
    
    // On native, we must stop the mic to avoid feedback loops and crashes.
    // On Web, stopping and restarting the mic programmatically is blocked by browsers (requires user gesture).
    // Instead, we leave it running (it ignores input while isProcessing is true).
    if (Capacitor.isNativePlatform()) {
      await stopListening();
    }
    
    setIsProcessing(true);

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
      const delay = isListening ? 2000 : 700;
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
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="chatbot-window fixed inset-0 z-[100] flex flex-col bg-black text-white"
        >
          {/* Top Bar - Mimicking ChatGPT layout */}
          <header className="flex items-center justify-between p-6 pt-safe-8">
            <button
              onClick={handleClose}
              className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 transition-all cursor-pointer"
            >
              <X className="w-6 h-6 stroke-[3]" />
            </button>
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
          <main className="flex-1 flex flex-col items-center justify-center p-6 gap-10 lg:gap-16 relative">
            
            {/* Dynamic Transcript Area (above orb for visibility) */}
            <div className="w-full max-w-2xl px-8 text-center min-h-[100px] flex items-end justify-center z-10">
               <AnimatePresence mode="wait">
                  {uiState === "LISTENING" && transcript ? (
                    <motion.p key="transcript" initial={{opacity:0, y: 10}} animate={{opacity:1, y: 0}} exit={{opacity:0}} className="text-2xl font-medium text-white/90 italic">
                      "{transcript}"
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
                       className="max-h-[160px] md:max-h-[220px] overflow-y-auto w-full px-2"
                       style={{
                         maskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
                         WebkitMaskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)'
                       }}
                     >
                       <p className="text-xl md:text-2xl font-medium text-white/90 leading-relaxed text-center pb-8 drop-shadow-md">
                         {NativeVoiceService.cleanTextForSpeech(lastResponse)}
                       </p>
                     </motion.div>
                  ) : (
                     <motion.p key="idle" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="text-lg text-white/50 font-light">
                       {uiState === "LISTENING" ? "Listening..." : "Tap the microphone to speak"}
                     </motion.p>
                  )}
               </AnimatePresence>
            </div>

            {/* The Animated ChatGPT-style Orb */}
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
                      : "from-gray-600 to-gray-400"
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

          {/* Bottom Bar Controls - Mimicking ChatGPT layout */}
          <footer className="p-6 pb-12 flex justify-center w-full">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xl p-2 rounded-[2rem] w-full max-w-md border border-white/5 shadow-2xl">
              
              {/* Fake Text Input -> Returns to Text Chat */}
              <button
                onClick={handleClose}
                className="flex-1 flex items-center px-4 h-14 rounded-full hover:bg-white/5 transition-colors text-white/50 text-sm sm:text-base cursor-pointer"
              >
                <span className="text-xl mr-3 font-light">+</span> Ask AttendX...
              </button>

              {/* Center Mic Button */}
              <button
                onClick={uiState === "LISTENING" ? stopListening : startListening}
                className={`flex items-center justify-center w-14 h-14 shrink-0 rounded-full transition-colors cursor-pointer ${
                   uiState === "LISTENING" ? "bg-white text-black hover:bg-gray-200 shadow-[0_0_15px_rgba(255,255,255,0.5)]" : "bg-white/20 text-white hover:bg-white/30"
                }`}
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
                    <div className="w-full relative">
                      {/* Left Arrow */}
                      <button 
                        onClick={() => carouselRef.current?.scrollBy({ left: -300, behavior: 'smooth' })}
                        className="absolute left-0 top-1/2 -translate-y-1/2 p-2 text-white/50 hover:text-white transition-colors cursor-pointer z-10 hidden sm:block"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>

                      <div 
                        ref={carouselRef} 
                        onScroll={handleVoiceScroll}
                        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide py-4 items-center"
                      >
                        {curatedVoices.map((cv, i) => (
                          <div 
                            key={i} 
                            className="min-w-[100%] shrink-0 snap-center flex flex-col items-center justify-center cursor-pointer select-none"
                            onClick={() => {
                              if (carouselRef.current) {
                                carouselRef.current.scrollTo({ left: i * carouselRef.current.clientWidth, behavior: 'smooth' });
                              }
                            }}
                          >
                            <h2 className={`text-2xl font-bold transition-colors ${previewVoice === cv.originalIndex ? "text-white" : "text-white/40"}`}>
                              {cv.alias}
                            </h2>
                            <p className="text-sm text-white/50 mt-1">{cv.desc}</p>
                          </div>
                        ))}
                      </div>

                      {/* Right Arrow */}
                      <button 
                        onClick={() => carouselRef.current?.scrollBy({ left: 300, behavior: 'smooth' })}
                        className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-white/50 hover:text-white transition-colors cursor-pointer z-10 hidden sm:block"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>
                      
                      {/* Dots */}
                      <div className="flex justify-center gap-2 mt-4">
                        {curatedVoices.map((cv, i) => (
                          <div 
                            key={i} 
                            className={`w-1.5 h-1.5 rounded-full transition-colors ${previewVoice === cv.originalIndex ? "bg-white" : "bg-white/20"}`} 
                          />
                        ))}
                      </div>
                      
                      {/* Confirm Button */}
                      <button 
                        onClick={() => {
                          if (previewVoice !== null) {
                            setSelectedVoice(previewVoice);
                            localStorage.setItem("attendx_preferred_voice_index", previewVoice.toString());
                            
                            const selectedCv = curatedVoices.find(v => v.originalIndex === previewVoice);
                            if (selectedCv) {
                                localStorage.setItem("attendx_preferred_voice_pitch", selectedCv.pitch.toString());
                                localStorage.setItem("attendx_preferred_voice_rate", selectedCv.rate.toString());
                            }
                          }
                          setShowVoiceSettings(false);
                        }}
                        className="w-full bg-white text-black font-semibold rounded-2xl py-3 mt-6 hover:bg-gray-200 transition-colors cursor-pointer"
                      >
                        Confirm Voice
                      </button>
                    </div>
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
