import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, VolumeX, X, Menu, Settings2 } from "lucide-react";

interface VoiceModeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: (query: string) => Promise<string | undefined>;
}

const FILLER_PHRASES = [
  "Let me look that up for you...",
  "Checking the institute ordinances...",
  "I'm analyzing your request...",
  "Let me check the regulations for that...",
  "Looking into the policies right now..."
];

export const VoiceModeOverlay: React.FC<VoiceModeOverlayProps> = ({
  isOpen,
  onClose,
  onSendMessage,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [transcript, setTranscript] = useState("");
  const [lastResponse, setLastResponse] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = "en-IN";

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          let currentTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTranscript(currentTranscript);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.onerror = (event: any) => {
          console.warn("Speech recognition error:", event.error);
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }

      synthRef.current = window.speechSynthesis;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);



  const startListening = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
    if (recognitionRef.current) {
      try {
        setTranscript("");
        setIsProcessing(false);
        recognitionRef.current.start();
      } catch (err) {
        console.warn("Recognition already started or error:", err);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn("Recognition stop error:", err);
      }
    }
  };

  const handleSpeakText = (text: string) => {
    if (!voiceEnabled || !synthRef.current) return;

    synthRef.current.cancel();
    
    const cleanText = text
      .replace(/[#*_`]/g, "")
      .replace(/\[.*?\]/g, "")
      .replace(/Section/gi, "Section")
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "en-IN";
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    const voices = synthRef.current.getVoices();
    const femaleIndianVoice = voices.find(v => v.lang.includes("en-IN") && v.name.includes("Female"));
    if (femaleIndianVoice) {
      utterance.voice = femaleIndianVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      // BUGFIX: Only restart listening if we aren't currently waiting for a network response
      setTimeout(() => {
        setIsProcessing(prevIsProcessing => {
          if (!prevIsProcessing && isOpen) {
            startListening();
          }
          return prevIsProcessing;
        });
      }, 500);
    };
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
  };

  const handleProcessVoiceInput = async () => {
    if (!transcript.trim() || isProcessing) return;

    const query = transcript.trim();
    stopListening();
    setIsProcessing(true);

    const randomFiller = FILLER_PHRASES[Math.floor(Math.random() * FILLER_PHRASES.length)];
    setLastResponse(randomFiller);
    handleSpeakText(randomFiller);

    try {
      const response = await onSendMessage(query);
      if (response) {
        setIsProcessing(false); // Stop processing state so onend can trigger listening
        setLastResponse(response);
        handleSpeakText(response);
      }
    } catch (err) {
      setIsProcessing(false);
      setLastResponse("I encountered an error connecting to the policy advisor. Please try again.");
      handleSpeakText("I encountered an error. Please try again.");
    }
  };

  useEffect(() => {
    if (!isListening && transcript.trim() && !isProcessing && !isSpeaking) {
      const timer = setTimeout(() => {
        handleProcessVoiceInput();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isListening, transcript]);

  // When Voice Mode opens, we immediately start listening!
  useEffect(() => {
    if (isOpen) {
      setTranscript("");
      setIsProcessing(false);
      setIsSpeaking(false);
      
      const greeting = "Hey there, how can I help you today?";
      setLastResponse(greeting);
      handleSpeakText(greeting);
      // Listening will start automatically after the greeting finishes via utterance.onend
    } else {
      stopListening();
      if (synthRef.current) {
        synthRef.current.cancel();
      }
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
          className="fixed inset-0 z-[100] flex flex-col bg-black text-white"
        >
          {/* Top Bar - Mimicking ChatGPT layout */}
          <header className="flex items-center justify-between p-6 pt-safe-8">
            <button 
              onClick={onClose}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5 text-white/80" />
            </button>
            <button
              onClick={() => {
                setVoiceEnabled(!voiceEnabled);
                if (voiceEnabled && synthRef.current) {
                  synthRef.current.cancel();
                  setIsSpeaking(false);
                }
              }}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
            >
              {voiceEnabled ? <Settings2 className="w-5 h-5 text-white/80" /> : <VolumeX className="w-5 h-5 text-rose-400" />}
            </button>
          </header>

          {/* Center Content: AI Orb & Transcript */}
          <main className="flex-1 flex flex-col items-center justify-center p-6 relative">
            
            {/* Dynamic Transcript Area (above orb for visibility) */}
            <div className="absolute top-1/4 w-full px-8 text-center min-h-[80px] flex items-end justify-center">
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
                     <motion.p key="speaking" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="text-lg text-white/80 line-clamp-4">
                       {lastResponse}
                     </motion.p>
                  ) : (
                     <motion.p key="idle" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="text-lg text-white/40">
                       {uiState === "LISTENING" ? "Listening..." : ""}
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
                    uiState === "LISTENING" ? "bg-white/40" : uiState === "SPEAKING" ? "bg-blue-500/50" : uiState === "PROCESSING" ? "bg-white/20" : "bg-white/10"
                  }`}
               />
               
               {/* Core Solid Orb */}
               <motion.div
                  animate={{
                    scale: uiState === "LISTENING" ? [1, 1.05, 1] : uiState === "SPEAKING" ? [1, 1.15, 0.95, 1.05, 1] : [1, 1.02, 1],
                  }}
                  transition={{ repeat: Infinity, duration: uiState === "SPEAKING" ? 1.2 : 2, ease: "easeInOut" }}
                  className={`relative z-10 w-36 h-36 sm:w-44 sm:h-44 rounded-full shadow-2xl transition-colors duration-700 bg-gradient-to-tr ${
                    uiState === "LISTENING" 
                      ? "from-gray-100 to-white shadow-white/40" 
                      : uiState === "SPEAKING" 
                      ? "from-cyan-200 via-blue-400 to-white shadow-blue-500/50" 
                      : uiState === "PROCESSING" 
                      ? "from-gray-300 to-gray-400 shadow-white/20" 
                      : "from-gray-600 to-gray-400"
                  }`}
               />
            </div>
          </main>

          {/* Bottom Bar Controls - Mimicking ChatGPT layout */}
          <footer className="p-6 pb-12 flex justify-center w-full">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xl p-2 rounded-[2rem] w-full max-w-md border border-white/5 shadow-2xl">
              
              {/* Fake Text Input -> Returns to Text Chat */}
              <button
                onClick={onClose}
                className="flex-1 flex items-center px-4 h-14 rounded-full hover:bg-white/5 transition-colors text-white/50 text-sm sm:text-base cursor-pointer"
              >
                <span className="text-xl mr-3 font-light">+</span> Ask AttendX...
              </button>

              {/* Center Mic Button */}
              <button
                onClick={uiState === "LISTENING" ? stopListening : startListening}
                className={`flex items-center justify-center w-14 h-14 shrink-0 rounded-full transition-colors cursor-pointer ${
                   uiState === "LISTENING" ? "bg-white text-black" : "bg-white/20 text-white hover:bg-white/30"
                }`}
              >
                {uiState === "LISTENING" ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>

              {/* Explicit Exit/Close Button */}
              <button
                onClick={onClose}
                className="flex items-center justify-center w-14 h-14 shrink-0 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors mr-1 cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>

            </div>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
