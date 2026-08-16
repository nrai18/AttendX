import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Bot, 
  X, 
  Send, 
  BookOpen, 
  GraduationCap, 
  Clock, 
  Utensils, 
  FileText,
  Copy, 
  Check, 
  RotateCcw, 
  Maximize2, 
  Minimize2, 
  Sparkles,
  ArrowUpRight,
  Mic,
  Volume2,
  VolumeX,
  ArrowLeft,
  ChevronRight,
  Search,
  Compass
} from "lucide-react";
import { FormattedChatMessage } from "./FormattedChatMessage";
import { VoiceModeOverlay } from "./VoiceModeOverlay";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { useAuthStore } from "../../stores/authStore";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  timestamp: string;
}

const FEATURE_CARDS = [
  {
    title: "Talk with AI (Voice Mode)",
    subtitle: "Real-time interactive voice conversation",
    icon: <Mic className="w-5 h-5 text-fuchsia-500" />,
    gradient: "from-fuchsia-500/20 via-pink-500/15 to-purple-500/20 border-fuchsia-500/30 hover:border-fuchsia-500/50 hover:shadow-fuchsia-500/10",
    iconBg: "bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-300",
    isVoice: true,
    query: ""
  },
  {
    title: "75% Attendance & Shortage",
    subtitle: "55%–75% 'L' Grade vs <55% 'R' Grade rules",
    icon: <Clock className="w-5 h-5 text-amber-500" />,
    gradient: "from-amber-500/20 via-orange-500/15 to-yellow-500/20 border-amber-500/30 hover:border-amber-500/50 hover:shadow-amber-500/10",
    iconBg: "bg-amber-500/20 text-amber-600 dark:text-amber-300",
    isVoice: false,
    query: "What are the rules, consequences, and makeup class procedure if attendance is between 55% and 75% under Section 6.4 of IIITUGORD02?"
  },
  {
    title: "9-Day Medical Leave & OD",
    subtitle: "HoD denominator deductions & On-Duty",
    icon: <FileText className="w-5 h-5 text-emerald-500" />,
    gradient: "from-emerald-500/20 via-teal-500/15 to-cyan-500/20 border-emerald-500/30 hover:border-emerald-500/50 hover:shadow-emerald-500/10",
    iconBg: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300",
    isVoice: false,
    query: "How does the short duration 9-day leave rule work under Section 6.5, and how is On-Duty counted under Section 6.8?"
  },
  {
    title: "Mess Rebate (N - 2) & Curfews",
    subtitle: "Fee reduction formula & 1st-year rules",
    icon: <Utensils className="w-5 h-5 text-indigo-500" />,
    gradient: "from-indigo-500/20 via-violet-500/15 to-blue-500/20 border-indigo-500/30 hover:border-indigo-500/50 hover:shadow-indigo-500/10",
    iconBg: "bg-indigo-500/20 text-indigo-600 dark:text-indigo-300",
    isVoice: false,
    query: "How do I apply for hostel mess reduction under Section 11.17, and what are the 1st year hostel timings under Section 14?"
  }
];

const RECENT_PROMPTS = [
  "What is my current attendance?",
  "What are my current subjects?",
  "What is the mandatory 30% passing mark in End-Semester exams?",
  "Can I get B.Tech with Honors and what is the CGPA cutoff?"
];

const SEARCH_STAGES = [
  "Searching 47-page IIIT Una Ordinances...",
  "Querying vector embeddings with gemini-embedding-2...",
  "Synthesizing precise regulation citations...",
  "Formatting verified policy response..."
];

export const FloatingChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [searchStageIndex, setSearchStageIndex] = useState(0);

  const { overallPercentage, targetPercentage, totalAttended, totalClasses, subjects, hasActiveSemester, fetchStats } = useAttendanceStore();
  const user = useAuthStore((state) => state.user);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Cycling search status animations
  useEffect(() => {
    let interval: any;
    if (isLoading) {
      setSearchStageIndex(0);
      interval = setInterval(() => {
        setSearchStageIndex((prev) => (prev + 1) % SEARCH_STAGES.length);
      }, 1200);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Always fetch latest telemetry on open
  useEffect(() => {
    if (isOpen) {
      fetchStats();
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isLoading]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Setup inline microphone speech recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = "en-IN";

        rec.onstart = () => setIsListeningMic(true);
        rec.onresult = (e: any) => {
          let text = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            text += e.results[i][0].transcript;
          }
          setInput(text);
        };
        rec.onend = () => setIsListeningMic(false);
        rec.onerror = () => setIsListeningMic(false);
        recognitionRef.current = rec;
      }
    }
  }, []);

  const toggleMic = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    if (isListeningMic) {
      recognitionRef.current.stop();
    } else {
      setInput("");
      recognitionRef.current.start();
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSpeakMessage = (id: string, text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[#*_`]/g, "").replace(/\[.*?\]/g, "").trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "en-IN";
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  const handleResetChat = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeakingId(null);
    setMessages([]);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || input.trim();
    if (!query || isLoading) return;

    const userMessage: Message = {
      id: String(Date.now()),
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const mlApiUrl = import.meta.env.VITE_ML_API_URL || "http://localhost:8000";
      
      const history = messages.slice(-4).map(m => ({
        role: m.role,
        content: m.content
      }));

      // Snapshot latest attendance store state with full history logs & calendar
      const state = useAttendanceStore.getState();
      const currentSubjects = state.subjects && state.subjects.length > 0 ? state.subjects : subjects;
      const currentOverall = state.overallPercentage || overallPercentage;
      const currentTarget = state.targetPercentage || targetPercentage || 75;
      const currentAttended = state.totalAttended || totalAttended;
      const currentTotal = state.totalClasses || totalClasses;
      const currentLogs = state.historyLogs || [];
      const currentEvents = state.events || [];

      const studentContext = {
        has_active_semester: currentSubjects.length > 0 || currentLogs.length > 0 || currentTotal > 0,
        overall_percentage: currentOverall,
        target_percentage: currentTarget,
        total_attended: currentAttended,
        total_classes: currentTotal,
        subjects: currentSubjects,
        history_logs: currentLogs.slice(0, 150),
        calendar_events: currentEvents.slice(0, 50)
      };

      const res = await fetch(`${mlApiUrl}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          history: history,
          student_context: studentContext
        })
      });

      if (!res.ok) {
        throw new Error(`ML server returned error ${res.status}`);
      }

      const data = await res.json();
      const botResponse: Message = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: data.response || "No response received from ordinance model.",
        citations: data.citations || [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };

      setMessages(prev => [...prev, botResponse]);
      return data.response;
    } catch (err: any) {
      console.error("AI Chat error:", err);
      const errorMessage: Message = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: "Unable to connect to the AttendX Policy Engine. Please ensure the Python ML server is running.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Dock with Ambient Glow */}
      <div className="fixed bottom-20 md:bottom-6 right-6 z-40">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(prev => !prev)}
          className="group relative flex items-center gap-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white px-4 py-3 rounded-full shadow-xl shadow-purple-500/25 border border-white/20 transition-all cursor-pointer text-xs font-semibold"
          aria-label="Open AttendX AI"
        >
          <div className="relative">
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
          </div>
          <span className="font-bold tracking-wide">Ordinance AI</span>
          <span className="hidden sm:inline-block text-[10px] text-white/80 bg-white/20 px-1.5 py-0.5 rounded-full font-mono">
            Ctrl+/
          </span>
        </motion.button>
      </div>

      {/* Voice Mode Fullscreen Overlay */}
      <VoiceModeOverlay 
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        onSendMessage={async (q) => {
          return await handleSendMessage(q);
        }}
      />

      {/* Main Chat Drawer with Fluid Spring Opening Animation */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 35 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 25 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            className={`fixed z-50 flex flex-col bg-gradient-to-b from-[#f7f5ff] via-[#fdfdff] to-[#f4f1fa] dark:from-[#0d1222] dark:via-[#090d18] dark:to-[#120f21] border border-purple-500/20 dark:border-indigo-500/30 shadow-2xl shadow-purple-950/20 overflow-hidden text-foreground ${
              isExpanded
                ? "bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-[680px] h-[88vh] max-h-[780px] rounded-3xl"
                : "bottom-24 md:bottom-20 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-[440px] h-[80vh] max-h-[620px] rounded-3xl"
            }`}
          >
            {/* Header with Frosted Glass Top Bar */}
            <div className="px-5 py-3.5 border-b border-purple-500/10 dark:border-white/10 bg-white/70 dark:bg-[#11172a]/70 backdrop-blur-md flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                {messages.length > 0 && (
                  <button
                    onClick={() => setMessages([])}
                    className="p-1.5 rounded-xl hover:bg-purple-500/10 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="Back to menu"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <div className="relative">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white font-bold shadow-md shadow-purple-500/20">
                    <Bot className="w-4 h-4" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
                  </span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold tracking-tight text-foreground flex items-center gap-1.5">
                    AttendX Policy AI
                    <span className="text-[9px] font-mono font-bold text-purple-700 dark:text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded-full border border-purple-500/20">
                      IIITUGORD02
                    </span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Institute Ordinances & Policy Advisor
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 text-muted-foreground">
                {/* Voice Call Mode Button */}
                <button
                  onClick={() => setIsVoiceOpen(true)}
                  className="flex items-center gap-1 text-[11px] font-bold bg-gradient-to-r from-fuchsia-500/15 to-purple-500/15 hover:from-fuchsia-500/25 hover:to-purple-500/25 text-purple-700 dark:text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-full transition-all cursor-pointer shadow-xs"
                  title="Talk with AI using voice"
                >
                  <Mic className="w-3.5 h-3.5 text-fuchsia-500 animate-pulse" />
                  <span className="hidden sm:inline">Voice Mode</span>
                </button>

                {messages.length > 0 && (
                  <button
                    onClick={handleResetChat}
                    className="p-1.5 rounded-xl hover:bg-purple-500/10 hover:text-foreground transition-colors cursor-pointer"
                    title="Clear conversation"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={() => setIsExpanded(prev => !prev)}
                  className="hidden sm:inline-flex p-1.5 rounded-xl hover:bg-purple-500/10 hover:text-foreground transition-colors cursor-pointer"
                  title={isExpanded ? "Collapse view" : "Expand view"}
                >
                  {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-purple-500/10 hover:text-foreground transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto">
              {messages.length === 0 ? (
                // Welcome Screen (Smoothly staggered animated cards)
                <motion.div 
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: { staggerChildren: 0.06 }
                    }
                  }}
                  className="p-5 space-y-5"
                >
                  {/* Greeting Headline */}
                  <motion.div 
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      visible: { opacity: 1, y: 0 }
                    }}
                    className="space-y-1"
                  >
                    <p className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                      Good Day, {user?.name?.split(" ")[0] || "Student"} 👋
                    </p>
                    <h2 className="text-xl font-extrabold tracking-tight text-foreground">
                      How can I help you today?
                    </h2>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Instant, cited answers grounded in IIIT Una's official 47-page UG Ordinances.
                    </p>
                  </motion.div>

                  {/* Feature Action Grid (Pastel Glossy Cards) */}
                  <div className="space-y-2.5">
                    {FEATURE_CARDS.map((card, idx) => (
                      <motion.button
                        key={idx}
                        variants={{
                          hidden: { opacity: 0, y: 12 },
                          visible: { opacity: 1, y: 0 }
                        }}
                        onClick={() => {
                          if (card.isVoice) {
                            setIsVoiceOpen(true);
                          } else {
                            handleSendMessage(card.query);
                          }
                        }}
                        className={`w-full text-left p-3.5 rounded-2xl bg-gradient-to-r ${card.gradient} border shadow-xs transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-between group cursor-pointer`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl ${card.iconBg} flex items-center justify-center shrink-0 shadow-xs`}>
                            {card.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                              {card.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {card.subtitle}
                            </p>
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-xl bg-white/60 dark:bg-black/20 flex items-center justify-center text-muted-foreground group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors shrink-0 shadow-2xs">
                          <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </div>
                      </motion.button>
                    ))}
                  </div>

                  {/* Frequently Referenced Policies List */}
                  <motion.div 
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      visible: { opacity: 1, y: 0 }
                    }}
                    className="space-y-2 pt-1"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-purple-500" /> Common Inquiries
                    </p>
                    <div className="space-y-1.5">
                      {RECENT_PROMPTS.map((promptText, i) => (
                        <motion.button
                          key={i}
                          variants={{
                            hidden: { opacity: 0, x: -8 },
                            visible: { opacity: 1, x: 0 }
                          }}
                          onClick={() => handleSendMessage(promptText)}
                          className="w-full text-left px-3.5 py-2.5 rounded-xl bg-white/70 dark:bg-[#161c30]/70 hover:bg-white dark:hover:bg-[#1c243e] border border-purple-500/10 dark:border-white/5 text-xs text-foreground/90 hover:text-foreground transition-all flex items-center justify-between group cursor-pointer shadow-2xs"
                        >
                          <span className="truncate pr-2">{promptText}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-purple-500 transition-transform group-hover:translate-x-0.5 shrink-0" />
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              ) : (
                // Chat Message Stream
                <div className="p-4 space-y-4 text-xs">
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15 }}
                      className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                    >
                      {msg.role === "user" ? (
                        // User Message: Soft yellow/gold pill in light mode or high-contrast in dark mode
                        <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-amber-100/90 dark:bg-primary text-amber-950 dark:text-primary-foreground border border-amber-300/60 dark:border-primary/40 px-4 py-2.5 text-[13px] font-medium shadow-sm">
                          <FormattedChatMessage content={msg.content} isUser={true} />
                          <div className="text-right text-[9px] opacity-70 mt-1 font-mono">{msg.timestamp}</div>
                        </div>
                      ) : (
                        // Assistant Message: Crisp elevated card with soft border & citation badges
                        <div className="w-full space-y-2">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span className="font-bold text-foreground flex items-center gap-1.5">
                              <div className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                                <Bot className="w-2.5 h-2.5" />
                              </div>
                              AttendX AI
                            </span>
                            <span className="text-[10px] font-mono opacity-70">{msg.timestamp}</span>
                          </div>

                          <div className="p-4 rounded-2xl bg-white/90 dark:bg-[#151b2e]/90 border border-purple-500/15 dark:border-white/10 text-foreground/90 leading-relaxed shadow-sm">
                            <FormattedChatMessage content={msg.content} isUser={false} />

                            {/* Verified Citations */}
                            {msg.citations && msg.citations.length > 0 && (
                              <div className="mt-3.5 pt-2.5 border-t border-border/60 flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-bold">
                                  <BookOpen className="w-3 h-3 text-purple-500" /> Official Clauses:
                                </span>
                                {msg.citations.map((cite, i) => (
                                  <span
                                    key={i}
                                    className="text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded-md font-mono font-semibold"
                                  >
                                    {cite}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Action Bar (Audio Read-Aloud, Copy) */}
                            <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleSpeakMessage(msg.id, msg.content)}
                                  className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg hover:bg-purple-500/10 transition-colors cursor-pointer ${
                                    speakingId === msg.id ? "text-emerald-500 font-bold" : "hover:text-foreground"
                                  }`}
                                  title={speakingId === msg.id ? "Stop listening" : "Listen to answer (Voice)"}
                                >
                                  <Volume2 className={`w-3.5 h-3.5 ${speakingId === msg.id ? "animate-pulse" : ""}`} />
                                  <span className="text-[10px]">{speakingId === msg.id ? "Speaking..." : "Listen"}</span>
                                </button>

                                <button
                                  onClick={() => handleCopy(msg.id, msg.content)}
                                  className="inline-flex items-center gap-1 text-[11px] hover:text-foreground px-2 py-1 rounded-lg hover:bg-purple-500/10 transition-colors cursor-pointer"
                                  title="Copy answer"
                                >
                                  {copiedId === msg.id ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-500" />
                                      <span className="text-emerald-500 text-[10px]">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span className="text-[10px]">Copy</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              <span className="text-[10px] text-muted-foreground font-mono">IIITUGORD02 Grounded</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}

                  {/* Animated Policy Searching / Loading State */}
                  {isLoading && (
                    <motion.div 
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-2xl bg-white/80 dark:bg-[#151b2e]/80 border border-purple-500/20 shadow-xs space-y-2"
                    >
                      {/* Bouncing Animation Dots */}
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                          <Bot className="w-3 h-3" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-purple-600 animate-bounce [animation-delay:-0.3s]"></span>
                          <span className="w-2 h-2 rounded-full bg-pink-500 animate-bounce [animation-delay:-0.15s]"></span>
                          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"></span>
                        </div>
                      </div>

                      {/* Dynamic Cycling Search Stage */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium pl-1">
                        <Search className="w-3.5 h-3.5 text-purple-500 animate-spin" />
                        <span className="italic">{SEARCH_STAGES[searchStageIndex]}</span>
                      </div>
                    </motion.div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Bottom Composer Bar */}
            <div className="p-3.5 border-t border-purple-500/10 dark:border-white/10 bg-white/80 dark:bg-[#11172a]/80 backdrop-blur-md">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="relative flex items-center gap-2"
              >
                {/* Voice Dictation Mic Button */}
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-xs ${
                    isListeningMic
                      ? "bg-rose-500 text-white animate-pulse shadow-rose-500/30"
                      : "bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/20"
                  }`}
                  title={isListeningMic ? "Listening... click to stop" : "Speak to AI (Microphone)"}
                >
                  <Mic className="w-4 h-4" />
                </button>

                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder=""
                    className="w-full bg-muted/50 border border-purple-500/20 focus:border-purple-500 focus:outline-none rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-foreground transition-all shadow-inner"
                    disabled={isLoading}
                  />

                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 disabled:opacity-30 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs"
                    title="Send"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
