import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, VolumeX, X, Bot, Sparkles, Loader2, MessageSquare } from "lucide-react";

interface VoiceModeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: (query: string) => Promise<string | undefined>;
}

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

  // Initialize Speech Recognition & Synthesis
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = "en-IN"; // English (India) for Indian institute context

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

  // When Voice Mode opens, start listening automatically
  useEffect(() => {
    if (isOpen) {
      setTranscript("");
      setLastResponse("I am listening. Ask me any question about your attendance, leaves, or institute regulations.");
      startListening();
    } else {
      stopListening();
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    }
  }, [isOpen]);

  const startListening = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }

    if (recognitionRef.current) {
      try {
        setTranscript("");
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
    
    // Clean text of markdown characters before speech
    const cleanText = text
      .replace(/[#*_`]/g, "")
      .replace(/\[.*?\]/g, "")
      .replace(/Section/gi, "Section")
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.lang = "en-IN";

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
  };

  const handleProcessVoiceInput = async () => {
    if (!transcript.trim() || isProcessing) return;

    const query = transcript.trim();
    stopListening();
    setIsProcessing(true);

    try {
      const response = await onSendMessage(query);
      if (response) {
        setLastResponse(response);
        handleSpeakText(response);
      }
    } catch (err) {
      setLastResponse("I encountered an error connecting to the policy advisor. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // If recognition finishes with text, automatically trigger submit after pause
  useEffect(() => {
    if (!isListening && transcript.trim() && !isProcessing && !isSpeaking) {
      const timer = setTimeout(() => {
        handleProcessVoiceInput();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isListening, transcript]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xl"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="relative w-full max-w-md bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center space-y-6"
        >
          {/* Top Bar */}
          <div className="w-full flex items-center justify-between text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isListening ? "bg-rose-400" : isSpeaking ? "bg-emerald-400" : "bg-primary"} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isListening ? "bg-rose-500" : isSpeaking ? "bg-emerald-500" : "bg-primary"}`}></span>
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                {isListening ? "Listening to you..." : isProcessing ? "Thinking..." : isSpeaking ? "Speaking..." : "Voice Mode Ready"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setVoiceEnabled(!voiceEnabled);
                  if (voiceEnabled && synthRef.current) {
                    synthRef.current.cancel();
                    setIsSpeaking(false);
                  }
                }}
                className="p-2 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title={voiceEnabled ? "Mute audio output" : "Enable audio output"}
              >
                {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-rose-500" />}
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Animated Voice Orb (Inspiration #3 style) */}
          <div className="relative my-4 flex items-center justify-center">
            {/* Ambient Pulsing Aura */}
            <motion.div
              animate={{
                scale: isListening ? [1, 1.35, 1] : isSpeaking ? [1, 1.25, 1] : [1, 1.05, 1],
                opacity: isListening ? [0.4, 0.8, 0.4] : isSpeaking ? [0.3, 0.6, 0.3] : [0.15, 0.3, 0.15]
              }}
              transition={{ repeat: Infinity, duration: isListening ? 1.5 : 2.5, ease: "easeInOut" }}
              className={`absolute w-44 h-44 rounded-full blur-2xl ${
                isListening ? "bg-rose-500/30" : isSpeaking ? "bg-emerald-500/30" : "bg-primary/20"
              }`}
            />

            {/* Glowing Core Ring */}
            <motion.div
              animate={{
                scale: isListening ? [1, 1.12, 1] : isSpeaking ? [1, 1.08, 1] : 1
              }}
              transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
              className={`relative w-28 h-28 rounded-full border-2 flex items-center justify-center shadow-xl backdrop-blur-md transition-colors duration-300 ${
                isListening
                  ? "bg-rose-500/10 border-rose-500 text-rose-500 shadow-rose-500/20"
                  : isSpeaking
                  ? "bg-emerald-500/10 border-emerald-500 text-emerald-500 shadow-emerald-500/20"
                  : isProcessing
                  ? "bg-primary/10 border-primary text-primary shadow-primary/20"
                  : "bg-muted/80 border-border text-foreground"
              }`}
            >
              {isProcessing ? (
                <Loader2 className="w-10 h-10 animate-spin" />
              ) : isListening ? (
                <Mic className="w-10 h-10 animate-pulse" />
              ) : isSpeaking ? (
                <Volume2 className="w-10 h-10 animate-bounce" />
              ) : (
                <Bot className="w-10 h-10" />
              )}
            </motion.div>
          </div>

          {/* Transcript / Subtitle Box */}
          <div className="w-full min-h-[90px] max-h-[140px] overflow-y-auto px-4 py-3 bg-muted/40 rounded-2xl border border-border/80 text-xs text-foreground/90 flex flex-col justify-center">
            {transcript ? (
              <p className="italic font-medium text-foreground">"{transcript}"</p>
            ) : isListening ? (
              <p className="text-muted-foreground animate-pulse">Say something like: "What happens if my attendance is 60%?"</p>
            ) : (
              <p className="line-clamp-4 leading-relaxed text-left text-muted-foreground">{lastResponse}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 w-full">
            <button
              onClick={isListening ? stopListening : startListening}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-semibold transition-all shadow-md cursor-pointer ${
                isListening
                  ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20"
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isListening ? "Stop Listening" : "Tap to Speak"}</span>
            </button>

            <button
              onClick={onClose}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Text Mode</span>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
