import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../../lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { 
  Bot, Loader2, 
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
  Compass,
  Activity,
  AlertTriangle,
  AudioLines,
  Square,
  Radio
} from "lucide-react";
import { FormattedChatMessage } from "./FormattedChatMessage";
import { VoiceModeOverlay } from "./VoiceModeOverlay";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { useAuthStore } from "../../stores/authStore";
import { NativeVoiceService } from "../../services/NativeVoiceService";
import { Capacitor } from "@capacitor/core";
import { useCacheStore } from "../../stores/cacheStore";
import { useThemeStore } from "../../stores/themeStore";
import { useNotificationStore } from "../../stores/notificationStore";
import { NotificationService } from "../../services/NotificationService";
import { useAssignmentStore } from "../../stores/assignmentStore";
import { App } from "@capacitor/app";

interface ActionPayload {
  id?: string;
  type: string;
  category?: "SAFE" | "DESTRUCTIVE";
  isDestructive?: boolean;
  requiresConfirmation?: boolean;
  target?: string;
  description?: string;
  impact?: string;
  payload: any;
}

const DESTRUCTIVE_ACTIONS = new Set<string>([
  "REMOVE_SUBJECT",
  "UPDATE_SUBJECT",
  "DROP_SUBJECT_FROM_TIMETABLE",
  "REMOVE_ATTENDANCE",
  "MARK_FULL_DAY_OFF",
  "SHIFT_TIMETABLE_SLOT",
  "ADD_TIMETABLE_SLOT",
  "REMOVE_TIMETABLE_SLOT",
  "SWAP_TIMETABLE_DAYS",
  "SHIFT_TIMETABLE_DAY",
  "ADD_SUBJECT",
  "CHANGE_TARGET",
  "CHANGE_GLOBAL_TARGET",
  "RESET_SEMESTER_DATA"
]);

interface SimulationPayload {
  subjectId: string;
  subjectName: string;
  skipCount: number;
  currentAttended: number;
  currentTotal: number;
  projectedPercentage: number;
  targetPercentage: number;
}

interface SemesterProjectionPayload {
  skipCountPerSubject: number;
  endDate: string;
  subjects: {
    subjectId: string;
    subjectName: string;
    remainingClasses: number;
    projectedPercentage: number;
    targetPercentage: number;
  }[];
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  timestamp: string;
  pendingActions?: ActionPayload[];
  actionsExecuted?: boolean;
  isExecutingAction?: boolean;
  simulation?: SimulationPayload;
  semesterProjection?: SemesterProjectionPayload;
}



const SEARCH_STAGES = [
  "Searching 47-page IIIT Una Ordinances...",
  "Querying vector embeddings with local offline vector embeddings...",
  "Synthesizing precise regulation citations...",
  "Formatting verified policy response..."
];

export const FloatingChatbot: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const chatTheme = React.useMemo(() => {
    const path = location.pathname;
    if (path.startsWith("/assignments")) return "slate";
    if (path.startsWith("/today")) return "mint";
    if (path.startsWith("/timetable")) return "sage";
    if (path.startsWith("/calendar")) return "lavender";
    if (path.startsWith("/semester")) return "stone";
    if (path.startsWith("/subjects")) return "indigo";
    if (path.startsWith("/settings")) return "amber";
    return "rose";
  }, [location.pathname]);

  const getChatBubbleClasses = () => {
    switch(chatTheme) {
      case "slate": return "bg-slate-200 text-slate-900 border-slate-300";
      case "mint": return "bg-teal-100 text-teal-950 border-teal-200";
      case "sage": return "bg-emerald-100/70 text-emerald-950 border-emerald-200/80";
      case "lavender": return "bg-purple-100 text-purple-950 border-purple-200";
      case "stone": return "bg-stone-200 text-stone-900 border-stone-300";
      case "indigo": return "bg-indigo-100/70 text-indigo-950 border-indigo-200";
      case "amber": return "bg-amber-100/80 text-amber-950 border-amber-200";
      default: return "bg-rose-100 text-rose-950 border-rose-200";
    }
  };

  const getPillClasses = () => {
    switch(chatTheme) {
      case "slate": return "bg-slate-800 text-slate-50 border-slate-700 dark:bg-slate-200 dark:text-slate-900 shadow-slate-900/25";
      case "mint": return "bg-teal-800 text-teal-50 border-teal-700 dark:bg-teal-200 dark:text-teal-950 shadow-teal-900/25";
      case "sage": return "bg-emerald-800 text-emerald-50 border-emerald-700 dark:bg-emerald-200 dark:text-emerald-950 shadow-emerald-900/25";
      case "lavender": return "bg-purple-800 text-purple-50 border-purple-700 dark:bg-purple-200 dark:text-purple-950 shadow-purple-900/25";
      case "stone": return "bg-stone-800 text-stone-50 border-stone-700 dark:bg-stone-200 dark:text-stone-950 shadow-stone-900/25";
      case "indigo": return "bg-indigo-800 text-indigo-50 border-indigo-700 dark:bg-indigo-200 dark:text-indigo-950 shadow-indigo-900/25";
      case "amber": return "bg-amber-700 text-amber-50 border-amber-600 dark:bg-amber-200 dark:text-amber-950 shadow-amber-900/25";
      default: return "bg-rose-800 text-rose-50 border-rose-700 dark:bg-rose-200 dark:text-rose-950 shadow-rose-900/25";
    }
  };

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [searchStageIndex, setSearchStageIndex] = useState(0);
  const [appVersion, setAppVersion] = useState("Unknown");

  const [isServerOnline, setIsServerOnline] = useState(true);

  useEffect(() => {
    const handleOpenVoiceMode = () => setIsVoiceOpen(true);
    window.addEventListener('open-voice-mode', handleOpenVoiceMode);

    if (isVoiceOpen) {
      localStorage.setItem("onboarding_voice_mode", "true");
      api.patch("/users/onboarding-status", { step: "voice_mode" }).catch(() => {});
    }
    
    App.getInfo().then(info => setAppVersion(info.version)).catch(() => {});
    
    // Poll server health
    const checkHealth = async () => {
      try {
        await api.get("/health", { timeout: 8000, silent: true });
        setIsServerOnline(true);
      } catch (e) {
        setIsServerOnline(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);

    // Instantly check health when the app comes to foreground or network reconnects
    const handleOnline = () => checkHealth();
    window.addEventListener('online', handleOnline);
    
    const appStateListener = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) checkHealth();
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('open-voice-mode', handleOpenVoiceMode);
      appStateListener.then(listener => listener.remove());
    };
  }, []);

  const { overallPercentage, targetPercentage, totalAttended, totalClasses, subjects, hasActiveSemester, fetchStats } = useAttendanceStore();
  const user = useAuthStore((state) => state.user);

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('attendx_chat_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const messagesRef = useRef<Message[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('attendx_chat_history', JSON.stringify(messages));
  }, [messages]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastInputMethodRef = useRef<'text' | 'voice'>('text');
  const executeActionRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  const [isHandsFree, setIsHandsFree] = useState(false);
  const [handsFreeStatus, setHandsFreeStatus] = useState<"IDLE" | "LISTENING" | "THINKING" | "SPEAKING">("LISTENING");
  const isHandsFreeRef = useRef(false);
  const handsFreeSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handsFreeAutoSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHandsFreeProcessingRef = useRef(false);
  const handsFreeListenOptionsRef = useRef<any>(null);
  const currentTranscriptRef = useRef<string>("");
  const lastSubmittedVoiceQueryRef = useRef<string>("");
  const handsFreeMicStartTimeRef = useRef<number>(0);

  const resetHandsFreeSilenceTimer = () => {
    if (handsFreeSilenceTimerRef.current) {
      clearTimeout(handsFreeSilenceTimerRef.current);
      handsFreeSilenceTimerRef.current = null;
    }
    if (isHandsFreeRef.current && !isHandsFreeProcessingRef.current) {
      handsFreeSilenceTimerRef.current = setTimeout(() => {
        if (isHandsFreeRef.current && !isHandsFreeProcessingRef.current && !NativeVoiceService.isSpeaking()) {
          stopHandsFreeMode("Hands-free paused due to 20s of inactivity.");
        }
      }, 20000);
    }
  };

  const checkHandsFreeVoiceBreakout = (text: string) => {
    const norm = text.trim().toLowerCase().replace(/[.,!?;:]/g, "");
    const breakoutWords = ["stop", "cancel", "stop conversation", "goodbye", "exit", "quit"];
    if (breakoutWords.includes(norm)) {
      stopHandsFreeMode("Voice breakout command detected: conversation stopped.");
      return true;
    }
    return false;
  };

  const stopHandsFreeMode = (reason?: string) => {
    setIsHandsFree(false);
    isHandsFreeRef.current = false;
    isHandsFreeProcessingRef.current = false;
    if (handsFreeSilenceTimerRef.current) {
      clearTimeout(handsFreeSilenceTimerRef.current);
      handsFreeSilenceTimerRef.current = null;
    }
    if (handsFreeAutoSubmitTimerRef.current) {
      clearTimeout(handsFreeAutoSubmitTimerRef.current);
      handsFreeAutoSubmitTimerRef.current = null;
    }
    if (isLoading) {
      handleStopGeneration();
    }
    NativeVoiceService.stopContinuousLoop();
    setIsListeningMic(false);
    if (reason) {
      console.info("Hands-free stopped:", reason);
    }
  };

  const startHandsFreeMode = async () => {
    if (isHandsFree) {
      stopHandsFreeMode();
      return;
    }

    if (isVoiceOpen) {
      setIsVoiceOpen(false);
    }

    await NativeVoiceService.stopSpeaking();
    await NativeVoiceService.stopListening();

    setInput("");
    currentTranscriptRef.current = "";
    setIsHandsFree(true);
    isHandsFreeRef.current = true;
    setHandsFreeStatus("LISTENING");
    lastInputMethodRef.current = "voice";
    resetHandsFreeSilenceTimer();

    const listenOptions = {
      lang: "en-IN",
      onStart: () => {
        handsFreeMicStartTimeRef.current = Date.now();
      },
      onPartialResult: (text: string) => {
        if (!isHandsFreeRef.current || isHandsFreeProcessingRef.current) return;
        // Anti-Ghost Echo check: Android caches the last phrase. If it repeats exactly within 1.5s of start, ignore it.
        if (text === lastSubmittedVoiceQueryRef.current && (Date.now() - handsFreeMicStartTimeRef.current < 1500)) {
          return;
        }
        setInput(text);
        currentTranscriptRef.current = text;
        resetHandsFreeSilenceTimer();
        if (checkHandsFreeVoiceBreakout(text)) {
          setInput("");
          currentTranscriptRef.current = "";
          return;
        }

        if (handsFreeAutoSubmitTimerRef.current) clearTimeout(handsFreeAutoSubmitTimerRef.current);
        handsFreeAutoSubmitTimerRef.current = setTimeout(() => {
          if (isHandsFreeRef.current && !isHandsFreeProcessingRef.current && text.trim()) {
            triggerHandsFreeSubmit(text.trim());
          }
        }, 5000);
      },
      onFinalResult: (text: string) => {
        if (!isHandsFreeRef.current || isHandsFreeProcessingRef.current) return;
        if (text === lastSubmittedVoiceQueryRef.current && (Date.now() - handsFreeMicStartTimeRef.current < 1500)) {
          return;
        }
        setInput(text);
        currentTranscriptRef.current = text;
        resetHandsFreeSilenceTimer();
        if (checkHandsFreeVoiceBreakout(text)) {
          setInput("");
          currentTranscriptRef.current = "";
          return;
        }

        if (handsFreeAutoSubmitTimerRef.current) clearTimeout(handsFreeAutoSubmitTimerRef.current);
        handsFreeAutoSubmitTimerRef.current = setTimeout(() => {
          if (isHandsFreeRef.current && !isHandsFreeProcessingRef.current && text.trim()) {
            triggerHandsFreeSubmit(text.trim());
          }
        }, 5000);
      },
      onError: (err: any) => {
        console.warn("Hands-free speech recognition error:", err);
        if (err && err.error && err.error !== "no-speech" && err.error !== "aborted") {
          console.warn(`Mic Error: ${err.error}`);
        } else if (err && err.message) {
          console.warn(`Mic Error: ${err.message}`);
        }
        if (isHandsFreeRef.current && !isHandsFreeProcessingRef.current) {
          setHandsFreeStatus("LISTENING");
        }
      },
      onEnd: () => {
        if (isHandsFreeRef.current && !NativeVoiceService.isSpeaking() && !isHandsFreeProcessingRef.current) {
          if (!NativeVoiceService.isListening()) {
             // If there is text in the input box, it means the native Android silence detector 
             // decided the user finished their sentence and turned off the hardware mic.
             // We MUST submit it immediately instead of throwing it away!
                          if (currentTranscriptRef.current.trim()) {
                triggerHandsFreeSubmit(currentTranscriptRef.current.trim());
             } else {
                // The user hasn't said anything, and Android natively turned off the mic.
                // Respect the OS inactivity timeout and break the continuous loop.
                stopHandsFreeMode();
             }
          }
        }
      }
    };

    handsFreeListenOptionsRef.current = listenOptions;
    NativeVoiceService.startContinuousLoop(listenOptions);
    const started = await NativeVoiceService.startListening(listenOptions);
    if (!started && isHandsFreeRef.current) {
      stopHandsFreeMode("Microphone could not be started.");
    }
  };

  const triggerHandsFreeSubmit = async (queryText: string) => {
    if (!queryText.trim() || isHandsFreeProcessingRef.current || !isHandsFreeRef.current) return;
    
    if (handsFreeSilenceTimerRef.current) {
      clearTimeout(handsFreeSilenceTimerRef.current);
      handsFreeSilenceTimerRef.current = null;
    }
    if (handsFreeAutoSubmitTimerRef.current) {
      clearTimeout(handsFreeAutoSubmitTimerRef.current);
      handsFreeAutoSubmitTimerRef.current = null;
    }

    isHandsFreeProcessingRef.current = true;
    setHandsFreeStatus("THINKING");
    lastSubmittedVoiceQueryRef.current = queryText;
    setInput("");
    currentTranscriptRef.current = "";
    await handleSendMessage(queryText, 'voice');
    isHandsFreeProcessingRef.current = false;
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setIsOpen((prev) => {
          if (prev && isHandsFreeRef.current) {
            stopHandsFreeMode();
          }
          return !prev;
        });
      } else if (e.key === "Escape" && isOpen) {
        stopHandsFreeMode();
        NativeVoiceService.stopSpeaking();
        NativeVoiceService.stopListening();
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Synchronize hands-free state when drawer closes
  useEffect(() => {
    if (!isOpen && isHandsFreeRef.current) {
      stopHandsFreeMode();
    }
  }, [isOpen]);

  // Lifecycle cleanup: ensure speech & listening terminate when component unmounts
  useEffect(() => {
    return () => {
      stopHandsFreeMode();
      NativeVoiceService.stopSpeaking();
      NativeVoiceService.stopListening();
    };
  }, []);

  const toggleMic = async () => {
    if (isListeningMic) {
      await NativeVoiceService.stopListening();
      setIsListeningMic(false);
      return;
    }

    setInput("");
    setIsListeningMic(true);
    lastInputMethodRef.current = "voice";

    const started = await NativeVoiceService.startListening({
      lang: "en-IN",
      onPartialResult: (text) => {
        setInput(text);
        lastInputMethodRef.current = "voice";
      },
      onFinalResult: (text) => {
        setInput(text);
        lastInputMethodRef.current = "voice";
      },
      onError: (err: any) => {
        console.warn("Inline mic error:", err);
        if (err && err.error && err.error !== "no-speech" && err.error !== "aborted") {
          console.warn(`Mic Error: ${err.error}`);
        } else if (err && err.message) {
          console.warn(`Mic Error: ${err.message}`);
        }
        setIsListeningMic(false);
      },
      onEnd: () => {
        setIsListeningMic(false);
      },
    });

    if (!started) {
      setIsListeningMic(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSpeakMessage = async (id: string, text: string) => {
    if (speakingId === id) {
      await NativeVoiceService.stopSpeaking();
      setSpeakingId(null);
      return;
    }

    setSpeakingId(id);
    await NativeVoiceService.stopSpeaking();
    const spoken = await NativeVoiceService.speak(text, {
      onEnd: () => setSpeakingId(null),
      onError: () => setSpeakingId(null),
    });
    if (!spoken) {
      setSpeakingId(null);
    }
  };

  const handleResetChat = () => {
    NativeVoiceService.stopSpeaking(); // fire and forget
    setSpeakingId(null);
    setMessages([]);
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  
  // --- EXTRACTED PENDING ACTIONS LOGIC ---
  const executePendingActions = async (msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isExecutingAction: true } : m));
    let globalRefresh = false;
    const targetMsg = messagesRef.current.find(m => m.id === msgId);
    if (!targetMsg || !targetMsg.pendingActions) return;

    for (const action of targetMsg.pendingActions) {
       try {
         const refreshed = await executeActionRef.current(action);
         if (refreshed) globalRefresh = true;
       } catch(e) {
         console.error("Failed to execute pending action:", e);
       }
    }
    if (globalRefresh) {
       window.dispatchEvent(new Event("attendance-updated"));
       window.dispatchEvent(new Event("subject-updated"));
    }
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isExecutingAction: false, actionsExecuted: true } : m));
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isExecutingAction: false, actionsExecuted: true } : m));
  };

  const cancelPendingActions = (msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, pendingActions: undefined, actionsExecuted: false } : m));
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, pendingActions: undefined, actionsExecuted: false } : m));
  };

  useEffect(() => {
    (window as any)._executePendingActions = executePendingActions;
    (window as any)._cancelPendingActions = cancelPendingActions;
  }, []);
  // --- END PENDING ACTIONS LOGIC ---

const handleSendMessage = async (textToSend?: string, inputMethod?: 'text' | 'voice' | 'voice_overlay'): Promise<string | undefined> => {
    const effectiveInputMethod = inputMethod || lastInputMethodRef.current;
    const wasHandsFree = isHandsFreeRef.current;
    // Reset tracker back to default 'text' for subsequent interactions
    lastInputMethodRef.current = 'text';

    const query = textToSend || input.trim();
    if (!query || isLoading) return;

    // Immediately stop any currently playing speech to prevent audio clash
    await NativeVoiceService.stopSpeaking();
    setSpeakingId(null);

    // Voice/Text Confirmation Intercept for Pending Actions
    const cleanQuery = query.trim().toLowerCase().replace(/[.,!]/g, '');
    const isConfirming = /(yes|yeah|yep|do it|confirm|execute|sure|ok|okay|yes please|sure do it|yeah do it|yes yes do it|proceed)/.test(cleanQuery);
    const isCanceling = /(no|nope|cancel|abort|stop|don't|do not|no thanks|no do not cancel)/.test(cleanQuery);

    if (isConfirming || isCanceling) {
      const lastAssistantMsg = messagesRef.current.slice().reverse().find(m => m.role === 'assistant');
      if (lastAssistantMsg && lastAssistantMsg.pendingActions && !lastAssistantMsg.actionsExecuted) {
        if (isConfirming && (window as any)._executePendingActions) {
          (window as any)._executePendingActions(lastAssistantMsg.id);
          if (effectiveInputMethod.includes('voice')) {
            NativeVoiceService.speak("Action confirmed.", {
              autoResumeListening: isHandsFreeRef.current,
              listenOptions: handsFreeListenOptionsRef.current,
              onEnd: () => { if (isHandsFreeRef.current) setHandsFreeStatus("LISTENING"); }
            });
          }
          setInput("");
          return;
        } else if (isCanceling && (window as any)._cancelPendingActions) {
          (window as any)._cancelPendingActions(lastAssistantMsg.id);
          if (effectiveInputMethod.includes('voice')) {
            NativeVoiceService.speak("Action cancelled.", {
              autoResumeListening: isHandsFreeRef.current,
              listenOptions: handsFreeListenOptionsRef.current,
              onEnd: () => { if (isHandsFreeRef.current) setHandsFreeStatus("LISTENING"); }
            });
          }
          setInput("");
          return;
        }
      }
    }

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
      abortControllerRef.current = new AbortController();
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
      const timetableSlots = useCacheStore.getState().timetable?.slots || [];
      const today = new Date();
      const pad2 = (n: number) => String(n).padStart(2, "0");
      const localTodayStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

      // --- TIER 0 & TIER 1: CLIENT-SIDE 0ms DETERMINISTIC FAST-PATH ---
      const tryClientFastPath = (): { reply: string; simulation?: SimulationPayload; semesterProjection?: SemesterProjectionPayload } | null => {
        const lower = query.trim().toLowerCase().replace(/[?!.]+$/g, "").trim();

        // 1. Abusive / Toxic Language Guardrail (0ms)
        const TOXIC_PATTERN =
          /\b(fuck|fucking|fucker|shit|bullshit|bitch|bitching|asshole|dick|dickhead|cunt|slut|whore|bastard|motherfucker|stfu|dumbass|idiot|retard|fag|nigger|nigga|madarchod|mc|behenchod|bhenchod|bc|bhosdike|bhosdiwale|bhosda|chutiya|chutiye|gaand|gandu|gandwe|lavde|laude|lodu|lode|lund|jhantu|harami|kamina|kamine|saala|saale|randi|raand|tatte|jhaat|bakchod|bakchodi|gaandmara|gandmara)\b|[\u0900-\u097F]*(?:चूतिया|मादरचोद|बहनचोद|भोसड़ीके|भोसड़ीवाले|गांडू|गांड|लौड़े|लवड़े|लंड|हरामी|कमीना|रंडी|झांट|बकचोद|चूत|गाली)[\u0900-\u097F]*/i;
        if (TOXIC_PATTERN.test(lower)) {
          return { reply: "I'm here to help you manage your attendance, timetable, assignments, and academic queries for AttendX. Please keep our conversation respectful so I can assist you effectively." };
        }

        // Pre-compute General Context Digest
        const pGlobal = currentTarget / 100;
        const overallSafeBunks = currentTotal > 0 && pGlobal > 0 ? Math.max(0, Math.floor((currentAttended - pGlobal * currentTotal) / pGlobal)) : 0;
        const overallNeeded = currentTotal > 0 && pGlobal < 1 ? Math.max(0, Math.ceil((pGlobal * currentTotal - currentAttended) / (1 - pGlobal))) : 0;
        const overallStatus = currentOverall >= currentTarget ? "Safe" : currentOverall >= currentTarget - 5 ? "Warning" : "Danger";

        const todayDayIndex = (today.getDay() + 6) % 7;
        const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        const subjectNameById: Record<string, string> = {};
        for (const s of currentSubjects as any[]) subjectNameById[s.id] = s.name;

        const todayClasses = timetableSlots
          .filter((slot: any) => Number(slot.dayOfWeek) === todayDayIndex)
          .sort((a: any, b: any) => String(a.startTime || "").localeCompare(String(b.startTime || "")))
          .map((slot: any) => ({
            startTime: slot.startTime || "09:00",
            endTime: slot.endTime || "09:50",
            subjectName: slot.subject?.name || subjectNameById[slot.subjectId] || "Scheduled Class",
            room: slot.room || "TBD",
            slotType: slot.type || slot.slotType || "Lecture",
          }));

        const currentHHMM = `${pad2(today.getHours())}:${pad2(today.getMinutes())}`;
        let nextUpcomingClass: { subjectName: string; dayName: string; startTime: string; endTime: string; room: string } | null = null;
        const remainingToday = todayClasses.filter((c: any) => c.startTime >= currentHHMM);
        if (remainingToday.length > 0) {
          nextUpcomingClass = { ...remainingToday[0], dayName: "Today" };
        } else {
          for (let offset = 1; offset <= 7; offset++) {
            const checkDay = (todayDayIndex + offset) % 7;
            const daySlots = timetableSlots
              .filter((slot: any) => Number(slot.dayOfWeek) === checkDay)
              .sort((a: any, b: any) => String(a.startTime || "").localeCompare(String(b.startTime || "")));
            if (daySlots.length > 0) {
              const first = daySlots[0];
              nextUpcomingClass = {
                subjectName: first.subject?.name || subjectNameById[first.subjectId] || "Scheduled Class",
                dayName: offset === 1 ? `Tomorrow (${dayNames[checkDay]})` : dayNames[checkDay],
                startTime: first.startTime || "09:00",
                endTime: first.endTime || "09:50",
                room: first.room || "TBD",
              };
              break;
            }
          }
        }

        // 2. Greetings & Identity (0ms)
        const greetingPattern =
          /^(hi+|he+y+|hello+|heya|howdy|sup|yo|namaste|greetings|good\s+(morning|afternoon|evening|day|night)|how\s+(are|r)\s+(you|u|ya)|how('s|\s+is)\s+it\s+going|what('s|\s+is)\s+up|whats\s+up|who\s+(are|r)\s+(you|u)|what\s+is\s+your\s+name|what('s|\s+is)\s+your\s+name|who\s+(made|created|built|developed)\s+(you|u)|what\s+can\s+you\s+do|help|thank(s|\s+you|\s+u|\s+you\s+so\s+much)?|thx|bye(\s+bye)?|goodbye|see\s+(you|ya))$/i;
        if (greetingPattern.test(lower)) {
          const uName = user?.name || "Student";
          if (/\b(who (made|created|built|developed) (you|u))\b/i.test(lower)) {
            return { reply: `I am AttendX AI Copilot, created and engineered by **Naman Rai** as your intelligent academic companion and policy advisor for IIIT Una.` };
          }
          if (/\b(what can you do|help)\b/i.test(lower)) {
            return { reply: `I can instantly check your attendance & safe bunks, simulate leaves, switch light/dark themes, navigate across the app, tell you your next class or upcoming holiday, swap timetable slots, and email your weekly or monthly attendance reports!` };
          }
          if (/^(thank|thx)/i.test(lower)) {
            return { reply: `You're welcome, ${uName}! Let me know anytime you need help with your attendance or schedule.` };
          }
          if (/^(bye|goodbye|see)/i.test(lower)) {
            return { reply: `See you later, ${uName}! Stay on top of your ${currentTarget}% attendance goal!` };
          }
          let reply = `Hey ${uName}! Your overall attendance is **${Number(currentOverall).toFixed(1)}%** (${currentAttended}/${currentTotal} classes — **${overallStatus}** vs your ${currentTarget}% target).`;
          if (nextUpcomingClass) {
            reply += ` Your next class is **${nextUpcomingClass.subjectName}** (${nextUpcomingClass.dayName} at ${nextUpcomingClass.startTime}).`;
          }
          reply += ` How can I help you today?`;
          return { reply };
        }

        // 3. Theme Switching (0ms)
        const themeMatch =
          lower.match(/^(?:please\s+)?(?:switch|change|set|turn|enable|toggle|go|use)?\s*(?:to\s+|on\s+)?(dark|light)\s*(?:mode|theme)?$/i) ||
          lower.match(/\b(?:switch|change|set|turn)\s+(?:the\s+)?(?:app\s+)?(?:theme|mode)\s+to\s+(dark|light)\b/i);
        if (themeMatch) {
          const targetTheme = themeMatch[1].toLowerCase() as "dark" | "light";
          useThemeStore.getState().setTheme(targetTheme);
          return { reply: `Switched your app appearance to **${targetTheme} mode**.` };
        }

        // 3.5. Timetable Alerts & Notification Settings (0ms)
        const alertUpdates: Partial<any> = {};
        const alertNotes: string[] = [];

        // Class reminder lead time (Off, 5, 10, 15)
        const reminderLeadMatch =
          lower.match(/\b(?:switch|set|change|turn|make)?\s*(?:the\s+)?(?:class\s+reminders?|lecture\s+alerts?|reminder\s+offset|time\s+before\s+class)\s*(?:to\s+|as\s+)?(5|10|15|off|never|none|disable)\s*(?:min(?:ute)?s?)?\b/i) ||
          lower.match(/\b(?:switch|change)\s+(?:from\s+)?\d+\s*(?:min(?:ute)?s?)?\s+(?:to\s+|into\s+)(5|10|15|off|never|none)\s*(?:min(?:ute)?s?)?\b/i) ||
          lower.match(/\b(?:remind|notify)\s+me\s+(5|10|15)\s*(?:minutes?|mins?)\s+before\b/i) ||
          lower.match(/\b(5|10|15)\s*(?:minutes?|mins?)\s+(?:before\s+class|class\s+reminder)\b/i) ||
          lower.match(/\b(?:turn\s+off|disable|stop|no)\s+(?:class\s+reminders?|lecture\s+alerts?)\b/i);

        if (reminderLeadMatch) {
          const rawVal = (reminderLeadMatch[1] || "off").toLowerCase();
          if (/^(off|never|none|disable)$/.test(rawVal) || /turn\s+off|disable|stop|no/.test(reminderLeadMatch[0])) {
            alertUpdates.classReminderOffset = -1;
            alertNotes.push("turned **OFF** class reminders (no pre-lecture alerts)");
          } else {
            const mins = parseInt(rawVal, 10);
            if ([5, 10, 15].includes(mins)) {
              alertUpdates.classReminderOffset = mins;
              alertNotes.push(`set class reminder lead time to **${mins} minutes before class**`);
            }
          }
        }

        // Show location in notifications
        if (
          /\b(?:don'?t|do\s+not|stop|hide|remove|disable|turn\s+off|no|without|not)\s+(?:include|including|show|showing|display|displaying)?\s*(?:the\s+)?(?:room|location|classroom)\b/i.test(lower) ||
          /\b(?:hide|remove|disable)\s+(?:room|location)\s+(?:in\s+notifications?|in\s+alerts?)?\b/i.test(lower)
        ) {
          alertUpdates.showLocation = false;
          alertNotes.push("configured notifications to **hide room location**");
        } else if (
          /\b(?:include|including|show|showing|display|displaying|add|adding|enable|turn\s+on|with)\s+(?:the\s+)?(?:room|location|classroom)\s+(?:in|on)\s+(?:the\s+)?(?:notifications?|alerts?)\b/i.test(lower) ||
          /\b(?:turn\s+on\s+show\s+location|show\s+room|include\s+location)\b/i.test(lower)
        ) {
          alertUpdates.showLocation = true;
          alertNotes.push("configured notifications to **include room location**");
        }

        // Next class heads-up
        if (
          /\b(?:don'?t|do\s+not|stop|disable|turn\s+off|no|i\s+do\s+not\s+want|without)\s+(?:want\s+)?(?:the\s+)?(?:next\s+class\s+)?heads[\s-]*up\b/i.test(lower) ||
          /\b(?:don'?t|do\s+not|stop)\s+notify(?:ing)?\s+(?:me\s+)?when\s+(?:current\s+)?class\s+ends\b/i.test(lower)
        ) {
          alertUpdates.notifyNextClassOnEnd = false;
          alertNotes.push("turned **OFF** the Next Class Heads-up alert");
        } else if (
          /\b(?:enable|turn\s+on|activate|start|i\s+want)\s+(?:the\s+)?(?:next\s+class\s+)?heads[\s-]*up\b/i.test(lower) ||
          /\bnotify\s+(?:me\s+)?when\s+(?:current\s+)?class\s+ends\b/i.test(lower)
        ) {
          alertUpdates.notifyNextClassOnEnd = true;
          alertNotes.push("turned **ON** the Next Class Heads-up alert");
        }

        // End of day summary
        if (
          /\b(?:don'?t|do\s+not|stop|disable|turn\s+off|no|i\s+do\s+not\s+want|without)\s+(?:the\s+)?(?:end\s+of\s+day\s+summary|done\s+for\s+the\s+day\s+alert|daily\s+completion\s+alert)\b/i.test(lower)
        ) {
          alertUpdates.endOfDaySummary = false;
          alertNotes.push("turned **OFF** the End of Day Summary alert");
        } else if (
          /\b(?:enable|turn\s+on|activate|start|i\s+want)\s+(?:the\s+)?(?:end\s+of\s+day\s+summary|done\s+for\s+the\s+day\s+alert)\b/i.test(lower)
        ) {
          alertUpdates.endOfDaySummary = true;
          alertNotes.push("turned **ON** the End of Day Summary alert");
        }

        if (Object.keys(alertUpdates).length > 0) {
          useNotificationStore.getState().updateConfig(alertUpdates);
          NotificationService.autoScheduleFromTimetable().catch(() => {});
          return { reply: `Done! I have ${alertNotes.join(" and ")}. Your alarms and local notifications have been rescheduled immediately.` };
        }

        // 4. Direct App Navigation (0ms)
        const navMatch = lower.match(
          /^(?:please\s+)?(?:navigate(?:\s+to)?|open(?:\s+up)?|go\s+to|take\s+me\s+to|show(?:\s+me)?(?:\s+my)?|view(?:\s+my)?)\s+(?:the\s+)?(timetable|schedule|routine|settings|preferences|reports?|analytics|calendar|forecast|predictive|prediction|today(?:'s\s+agenda)?|agenda|dashboard|subjects?|courses?|assignments?|tasks?|semester(?:\s+overview|\s+hub)?|overview|timeline|holidays?|countdowns?|events?|profile|edit\s+profile|linked\s+devices|devices|sessions|peer\s+sync|changelog|update\s+history|feedback|contact(?:\s+us)?|faq|classrooms?)(?:\s+page|\s+screen|\s+tab|\s+view)?$/i
        );
        if (navMatch) {
          const targetKey = navMatch[1].toLowerCase();
          let path = "/today";
          let title = "Today's Agenda";
          if (/(timetable|schedule|routine)/.test(targetKey)) { path = "/timetable"; title = "Timetable"; }
          else if (/(edit\s+profile|profile)/.test(targetKey)) { path = "/settings/profile"; title = "Edit Profile"; }
          else if (/(device|devices|sessions)/.test(targetKey)) { path = "/settings/devices"; title = "Linked Devices"; }
          else if (/(peer\s+sync)/.test(targetKey)) { path = "/settings/peer-sync"; title = "Peer Sync"; }
          else if (/(contact)/.test(targetKey)) { path = "/settings/contact"; title = "Contact Us"; }
          else if (/(feedback)/.test(targetKey)) { path = "/settings/feedback"; title = "Send Feedback"; }
          else if (/(changelog|update\s+history)/.test(targetKey)) { path = "/settings/changelog"; title = "Update History"; }
          else if (/(faq)/.test(targetKey)) { path = "/settings/faq"; title = "FAQ"; }
          else if (/(setting|preferences)/.test(targetKey)) { path = "/settings"; title = "Settings"; }
          else if (/(report|analytics)/.test(targetKey)) { path = "/report"; title = "Analytics Reports"; }
          else if (/(forecast|predictive|prediction)/.test(targetKey)) { path = "/predictive"; title = "Forecast Engine"; }
          else if (/(holiday)/.test(targetKey)) { path = "/semester/holidays"; title = "Semester Holidays"; }
          else if (/(countdown)/.test(targetKey)) { path = "/semester/countdowns"; title = "Semester Countdowns"; }
          else if (/^events?$/.test(targetKey)) { path = "/semester/events"; title = "Semester Events"; }
          else if (/(semester|overview|timeline)/.test(targetKey)) { path = "/semester"; title = "Semester Overview"; }
          else if (/(calendar)/.test(targetKey)) { path = "/calendar"; title = "Calendar"; }
          else if (/(subject|course)/.test(targetKey)) { path = "/subjects"; title = "Subjects"; }
          else if (/(assignment|task)/.test(targetKey)) { path = "/assignments"; title = "Assignments"; }
          else if (/(classroom)/.test(targetKey)) { path = "/classrooms"; title = "Classrooms"; }
          navigate(path);
          return { reply: `Opening **${title}**.` };
        }

        // 5. Next Upcoming Event / Holiday / Exam & Next Class / Today's Schedule (0ms)
        if (
          /^(what('s|\s+is)\s+(my\s+)?)?(next|upcoming)\s+(event|events|holiday|vacation|break|exam|midsem|endsem|milestone|festival|fest)s?$/i.test(lower) ||
          /\b(when\s+is\s+(the\s+)?next\s+(event|holiday|exam|break|vacation)|tell\s+me\s+(the\s+)?next\s+upcoming\s+event|upcoming\s+events?|next\s+holiday)\b/i.test(lower)
        ) {
          const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
          const upcoming = (currentEvents || [])
            .map((e: any) => {
              const rawStart = e.date || e.startDate;
              const rawEnd = e.endDate || rawStart;
              const dStr = rawStart ? String(rawStart).split("T")[0] : "";
              const endStr = rawEnd ? String(rawEnd).split("T")[0] : dStr;
              const startObj = dStr ? new Date(`${dStr}T00:00:00`) : new Date(NaN);
              const endObj = endStr ? new Date(`${endStr}T23:59:59`) : startObj;
              const daysUntil = !isNaN(startObj.getTime())
                ? Math.max(0, Math.round((startObj.getTime() - todayMidnight) / (1000 * 60 * 60 * 24)))
                : 999;
              return {
                title: e.title || e.name || "Academic Event",
                date: dStr,
                endDate: endStr !== dStr ? endStr : undefined,
                daysUntil,
                endMs: !isNaN(endObj.getTime()) ? endObj.getTime() : 0,
                eventType: String(e.eventType || "other").toLowerCase(),
              };
            })
            .filter((e: any) => e.date && e.endMs >= todayMidnight)
            .sort((a: any, b: any) => a.date.localeCompare(b.date));

          const wantsHoliday = /\b(holiday|vacation|break)\b/i.test(lower);
          const wantsExam = /\b(exam|midsem|endsem|ct|quiz|test)\b/i.test(lower);
          const filtered = upcoming.filter((e: any) => {
            if (wantsHoliday) return e.eventType.includes("holiday") || e.eventType.includes("vacation") || /holiday|vacation|jayanti|diwali|holi/i.test(e.title);
            if (wantsExam) return e.eventType.includes("exam") || e.eventType.includes("sem") || e.eventType.includes("ct") || /exam|mid|end|test|quiz/i.test(e.title);
            return true;
          });
          const list = filtered.length > 0 ? filtered : upcoming;
          if (list.length === 0) {
            return { reply: `You don't have any upcoming events or holidays recorded in your active semester calendar yet.` };
          }
          const top = list[0];
          const countdownText = top.daysUntil === 0 ? "today" : top.daysUntil === 1 ? "tomorrow (in 1 day)" : `in **${top.daysUntil} days**`;
          const moreList = list
            .slice(1, 4)
            .map((e: any) => `• **${e.title}** — ${e.date}${e.endDate ? ` to ${e.endDate}` : ""} (${e.daysUntil === 0 ? "Today" : `in ${e.daysUntil}d`})`)
            .join("\n");
          return {
            reply: `Your next upcoming ${wantsHoliday ? "holiday" : wantsExam ? "exam" : "event"} is **${top.title}** on **${top.date}${top.endDate ? ` – ${top.endDate}` : ""}** (${countdownText}).${moreList ? `\n\n**Following up:**\n${moreList}` : ""}`,
          };
        }

        if (/^(what('s|\s+is)\s+(my\s+)?)?(next\s+(class|lecture|lab)|classes\s+today|my\s+(classes|schedule|timetable)\s+today|today('s)?\s+(classes|schedule|timetable|agenda))$/i.test(lower)) {
          const todayDayName = dayNames[todayDayIndex];
          if (/next\s+(class|lecture|lab)/i.test(lower)) {
            if (nextUpcomingClass) {
              return {
                reply: `Your next class is **${nextUpcomingClass.subjectName}** (${nextUpcomingClass.dayName}, **${nextUpcomingClass.startTime} – ${nextUpcomingClass.endTime}**${nextUpcomingClass.room && nextUpcomingClass.room !== "TBD" ? `, Room ${nextUpcomingClass.room}` : ""}).`,
              };
            }
            return { reply: `You have no upcoming classes found in your weekly timetable.` };
          }
          if (todayClasses.length === 0) {
            return {
              reply: `You have **no classes scheduled today (${todayDayName})**!${nextUpcomingClass ? ` Your next class is **${nextUpcomingClass.subjectName}** on ${nextUpcomingClass.dayName} at ${nextUpcomingClass.startTime}.` : ""}`,
            };
          }
          const formatted = todayClasses
            .map((c: any) => `• **${c.startTime} – ${c.endTime}**: ${c.subjectName} (${c.slotType}${c.room && c.room !== "TBD" ? `, ${c.room}` : ""})`)
            .join("\n");
          return { reply: `Here is your schedule for **today (${todayDayName})** (${todayClasses.length} session${todayClasses.length !== 1 ? "s" : ""}):\n${formatted}` };
        }

        // 6. Current Attendance & Safe Bunks Query (0ms)
        const isDirectAttendanceQuery =
          /^(what('s|\s+is)\s+(my\s+)?)?(current\s+|overall\s+|total\s+)?attendance(\s+status|\s+percentage|\s+right\s+now|\s+summary)?$/i.test(lower) ||
          /^(show(\s+me)?\s+(my\s+)?|check(\s+my)?\s+|tell(\s+me)?\s+(my\s+)?)?(current\s+|overall\s+)?attendance(\s+in\s+.+)?$/i.test(lower) ||
          /^(am\s+i\s+safe|how\s+many\s+(classes|lectures|bunks)\s+(can\s+i\s+(bunk|miss|skip)|do\s+i\s+need(\s+to\s+attend)?))(\s+in\s+.+)?$/i.test(lower);

        if (isDirectAttendanceQuery && !/\b(if\s+i|next\s+week|from\s+|between\s+|tomorrow|monday|tuesday|wednesday|thursday|friday)\b/i.test(lower)) {
          const matchedSub = (currentSubjects as any[]).find(
            (s) =>
              (s.name && lower.includes(s.name.toLowerCase())) ||
              (s.code && s.code.length >= 2 && new RegExp(`\\b${s.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lower))
          );

          if (matchedSub) {
            const att = Number(matchedSub.attended || 0);
            const tot = Number(matchedSub.total || 0);
            const tgt = Number(matchedSub.target ?? currentTarget);
            const pct = matchedSub.percentage !== undefined ? Number(matchedSub.percentage) : tot > 0 ? (att / tot) * 100 : 100;
            const p = tgt / 100;
            const safeBunksLeft = tot > 0 && p > 0 ? Math.max(0, Math.floor((att - p * tot) / p)) : 0;
            const classesNeeded = tot > 0 && p < 1 ? Math.max(0, Math.ceil((p * tot - att) / (1 - p))) : 0;
            const bufferMsg =
              pct >= tgt
                ? safeBunksLeft > 0
                  ? `You can safely miss **${safeBunksLeft}** consecutive class${safeBunksLeft !== 1 ? "es" : ""} and stay above ${tgt}%.`
                  : `You are right on the edge of ${tgt}% — missing the next class will drop you below target.`
                : `You need to attend the next **${classesNeeded}** consecutive class${classesNeeded !== 1 ? "es" : ""} to reach ${tgt}%.`;
            const skipCount = pct >= tgt ? Math.max(1, safeBunksLeft) : -classesNeeded;
            const projTot = tot + Math.abs(skipCount);
            const projAtt = skipCount < 0 ? att + Math.abs(skipCount) : att;
            return {
              reply: `In **${matchedSub.name}${matchedSub.code ? ` (${matchedSub.code})` : ""}**, your current attendance is **${pct.toFixed(1)}%** (${att}/${tot} classes, Target: ${tgt}%). ${bufferMsg}`,
              simulation: {
                subjectId: matchedSub.id,
                subjectName: matchedSub.name,
                skipCount,
                currentAttended: att,
                currentTotal: tot,
                projectedPercentage: projTot > 0 ? Math.round((projAtt / projTot) * 1000) / 10 : 100,
                targetPercentage: tgt,
              },
            };
          }

          const overallBuffer =
            currentOverall >= currentTarget
              ? `You are **Safe** (+${(currentOverall - currentTarget).toFixed(1)}% above ${currentTarget}%) with an overall buffer of **${overallSafeBunks}** class${overallSafeBunks !== 1 ? "es" : ""}.`
              : `You are below your ${currentTarget}% target and need **${overallNeeded}** consecutive classes overall.`;
          const subjectLines = (currentSubjects as any[])
            .map((s) => {
              const att = Number(s.attended || 0);
              const tot = Number(s.total || 0);
              const tgt = Number(s.target ?? currentTarget);
              const pct = s.percentage !== undefined ? Number(s.percentage) : tot > 0 ? (att / tot) * 100 : 100;
              const p = tgt / 100;
              const bunks = tot > 0 && p > 0 ? Math.max(0, Math.floor((att - p * tot) / p)) : 0;
              const need = tot > 0 && p < 1 ? Math.max(0, Math.ceil((p * tot - att) / (1 - p))) : 0;
              const tag = pct >= tgt ? (bunks > 0 ? `Safe: can miss ${bunks}` : `On edge (0 bunks)`) : `Attend next ${need}`;
              return `• **${s.name}**: **${pct.toFixed(1)}%** (${att}/${tot}) — *${tag}*`;
            })
            .join("\n");
          return {
            reply: `Your overall attendance is **${Number(currentOverall).toFixed(1)}%** (${currentAttended}/${currentTotal} classes). ${overallBuffer}${subjectLines ? `\n\n**Subject Breakdown:**\n${subjectLines}` : ""}`,
          };
        }

        // 7. Single-Subject Simulation (0ms)
        const singleSimMatch = lower.match(
          /^(?:what\s+if\s+i|if\s+i|simulate)\s+(miss|skip|bunk|attend|attending)\s+(?:the\s+)?(?:next\s+)?(\d+)\s+(?:classes|lectures|sessions|labs)?\s*(?:of|in|for)?\s+(.+)$/i
        );
        if (singleSimMatch && !/\b(week|month|semester|days|monday|tuesday|wednesday|thursday|friday)\b/i.test(singleSimMatch[3])) {
          const isMiss = /miss|skip|bunk/.test(singleSimMatch[1].toLowerCase());
          const count = Math.max(1, parseInt(singleSimMatch[2], 10));
          const subQ = singleSimMatch[3].trim().toLowerCase();
          const matchedSub = (currentSubjects as any[]).find(
            (s) => (s.name && s.name.toLowerCase().includes(subQ)) || (s.code && s.code.toLowerCase() === subQ)
          );
          if (matchedSub) {
            const att = Number(matchedSub.attended || 0);
            const tot = Number(matchedSub.total || 0);
            const tgt = Number(matchedSub.target ?? currentTarget);
            const pct = tot > 0 ? (att / tot) * 100 : 100;
            const projTot = tot + count;
            const projAtt = isMiss ? att : att + count;
            const projPct = projTot > 0 ? (projAtt / projTot) * 100 : 100;
            const p = tgt / 100;
            let reply = "";
            if (isMiss) {
              reply = `If you miss **${count}** class${count !== 1 ? "es" : ""} of **${matchedSub.name}**, your attendance moves from **${pct.toFixed(1)}%** to **${projPct.toFixed(1)}%** (${projAtt}/${projTot} classes). `;
              if (projPct >= tgt) {
                const bunksAfter = Math.max(0, Math.floor((projAtt - p * projTot) / p));
                reply += `You remain **safe** above your ${tgt}% target with **${bunksAfter}** safe bunk${bunksAfter !== 1 ? "s" : ""} remaining.`;
              } else {
                const recoverNeeded = p < 1 ? Math.max(0, Math.ceil((p * projTot - projAtt) / (1 - p))) : 0;
                reply += `Warning: This drops you **below your ${tgt}% target**! You would need to attend **${recoverNeeded}** consecutive classes to recover.`;
              }
            } else {
              reply = `If you attend the next **${count}** class${count !== 1 ? "es" : ""} of **${matchedSub.name}**, your attendance rises from **${pct.toFixed(1)}%** to **${projPct.toFixed(1)}%** (${projAtt}/${projTot} classes).`;
            }
            return {
              reply,
              simulation: {
                subjectId: matchedSub.id,
                subjectName: matchedSub.name,
                skipCount: isMiss ? count : -count,
                currentAttended: att,
                currentTotal: tot,
                projectedPercentage: Math.round(projPct * 10) / 10,
                targetPercentage: tgt,
              },
            };
          }
        }

        return null;
      };

      const fastLocalResult = tryClientFastPath();
      if (fastLocalResult) {
        const textToSpeak = fastLocalResult.reply.replace(/\*\*/g, "").replace(/\*/g, "");
        if (isHandsFreeRef.current && textToSpeak) {
          setHandsFreeStatus("SPEAKING");
          await NativeVoiceService.stopSpeaking();
          NativeVoiceService.speak(textToSpeak, {
            autoResumeListening: true,
            listenOptions: handsFreeListenOptionsRef.current,
            onStart: () => { if (isHandsFreeRef.current) setHandsFreeStatus("SPEAKING"); },
            onEnd: () => {
              if (isHandsFreeRef.current) {
                setHandsFreeStatus("LISTENING");
                resetHandsFreeSilenceTimer();
              }
            }
          });
        } else if (effectiveInputMethod === "voice" && textToSpeak) {
          await NativeVoiceService.stopSpeaking();
          NativeVoiceService.speak(textToSpeak);
        }

        const botResponse: Message = {
          id: String(Date.now() + 1),
          role: "assistant",
          content: fastLocalResult.reply,
          citations: [],
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          simulation: fastLocalResult.simulation,
          semesterProjection: fastLocalResult.semesterProjection,
        };
        setMessages((prev) => [...prev, botResponse]);
        setIsLoading(false);
        return fastLocalResult.reply;
      }
      // --- END CLIENT-SIDE 0ms FAST-PATH ---

      const needsHistoryLogs = /\b(when was i|history|log|logs|past|last week|yesterday|marked on|absent on|present on|did i attend|did i miss|extra class)\b/i.test(query);

      const studentContext = {
        user_id: user?.id,
        user_name: user?.name || "Student",
        user_email: user?.email,
        user_birthday: user?.birthday || "Not set",
        app_version: appVersion,
        app_developer: "Naman Rai",
        attendance_rule: "Refer to official Institute Ordinances for attendance thresholds.",
        current_date: localTodayStr,
        has_active_semester: currentSubjects.length > 0 || currentLogs.length > 0 || currentTotal > 0,
        active_semester_id: useAttendanceStore.getState().activeSemesterId,
        active_semester_start_date: useAttendanceStore.getState().simulationBounds?.startDate,
        active_semester_end_date: useAttendanceStore.getState().simulationBounds?.endDate,
        overall_percentage: currentOverall,
        target_percentage: currentTarget,
        total_attended: currentAttended,
        total_classes: currentTotal,
        subjects: currentSubjects,
        timetable_slots: timetableSlots,
        history_logs: needsHistoryLogs ? currentLogs.slice(0, 30) : [],
        calendar_events: currentEvents
          .filter(e => {
            const eventDate = new Date(e.endDate || e.date);
            const monthAgo = new Date();
            monthAgo.setDate(monthAgo.getDate() - 30);
            return eventDate >= monthAgo;
          })
          .slice(0, 40),
        assignments: useAssignmentStore.getState().assignments || []
      };

      const selectedItems: any[] = [];
      const searchParams = new URLSearchParams(location.search);
      const queryDate = searchParams.get("date");
      const querySubjectId = searchParams.get("subjectId");
      if (queryDate) selectedItems.push({ type: "date", value: queryDate });
      if (querySubjectId) selectedItems.push({ type: "subjectId", value: querySubjectId });
      if (location.pathname.startsWith("/subjects/")) {
        const subIdFromPath = location.pathname.split("/")[2];
        if (subIdFromPath) selectedItems.push({ type: "subjectId", value: subIdFromPath });
      }

      const res = await api.post(`/ai/chat`, {
        text: query,
        message: query,
        currentRoute: location.pathname,
        selectedItems,
        localTime: new Date().toString(),
        history,
        student_context: studentContext
      }, { signal: abortControllerRef.current?.signal });

      const data = res.data;

      // Requirement R2: TTS must ONLY trigger automatically if the user's prompt came from voice
      // The overlay handles its own speech (voice_overlay), so we only speak if it's the inline mic ('voice')
      const textToSpeak = data.response || data.reply;
      if (isHandsFreeRef.current && textToSpeak) {
        setHandsFreeStatus("SPEAKING");
        await NativeVoiceService.stopSpeaking();
        NativeVoiceService.speak(textToSpeak, {
          autoResumeListening: true,
          listenOptions: handsFreeListenOptionsRef.current,
          onStart: () => {
            if (isHandsFreeRef.current) setHandsFreeStatus("SPEAKING");
          },
          onEnd: () => {
            if (isHandsFreeRef.current) {
              setHandsFreeStatus("LISTENING");
              resetHandsFreeSilenceTimer();
            }
          }
        });
      } else if (effectiveInputMethod === 'voice' && textToSpeak) {
        if (wasHandsFree && !isHandsFreeRef.current) {
          // User stopped hands-free while waiting for response: do NOT speak aloud
          await NativeVoiceService.stopSpeaking();
        } else {
          await NativeVoiceService.stopSpeaking();
          NativeVoiceService.speak(textToSpeak);
        }
      } else {
        // Mute automatic TTS and explicitly ensure any audio is stopped
        await NativeVoiceService.stopSpeaking();
      }
    
      
      executeActionRef.current = async (action: any) => {
        let refresh = false;
        const activeSemesterId =
          action.payload?.semesterId ||
          useAttendanceStore.getState().activeSemesterId ||
          useCacheStore.getState().timetable?.activeSemester?.id;

        if (action.type === 'NAVIGATE' && action.payload?.path) {
          let targetPath = action.payload.path;
          if (targetPath === '/reports') targetPath = '/report';
          navigate(targetPath);
        } else if (action.type === 'MARK_ATTENDANCE') {
          await api.post("/attendance/mark", action.payload);
          navigate(`/today?date=${action.payload.date}`);
          refresh = true;
        } else if (action.type === 'ADD_EXTRA_CLASS') {
          await api.post("/timetable/extra-class", action.payload);
          navigate(`/today?date=${action.payload.date}`);
          refresh = true;
        } else if (action.type === 'REMOVE_ATTENDANCE') {
          const startDate = new Date(action.payload.date);
          const endDate = action.payload.endDate ? new Date(action.payload.endDate) : startDate;
          let curr = new Date(startDate);
          
          while(curr <= endDate) {
            const dateStr = `${curr.getFullYear()}-${String(curr.getMonth()+1).padStart(2,'0')}-${String(curr.getDate()).padStart(2,'0')}`;
            if (action.payload.subjectId) {
              await api.post("/attendance/mark", {
                subjectId: action.payload.subjectId,
                date: dateStr,
                status: "not_marked"
              });
            } else {
              const agendaRes = await api.get(`/attendance/today?date=${dateStr}`);
              for (const item of agendaRes.data) {
                if (item.status !== "not_marked" || item.type === "override" || item.isExtra) {
                   await api.post("/attendance/mark", {
                     subjectId: item.subject.id,
                     date: dateStr,
                     status: "not_marked"
                   });
                }
              }
            }
            curr.setDate(curr.getDate() + 1);
          }
          navigate(`/today?date=${action.payload.date}`);
          refresh = true;
        } else if (action.type === 'MARK_FULL_DAY_OFF') {
          const startDate = new Date(action.payload.date);
          const endDate = action.payload.endDate ? new Date(action.payload.endDate) : startDate;
          const excludeIds = action.payload.excludeSubjectIds || [];
          
          let curr = new Date(startDate);
          while(curr <= endDate) {
            const dateStr = `${curr.getFullYear()}-${String(curr.getMonth()+1).padStart(2,'0')}-${String(curr.getDate()).padStart(2,'0')}`;
            const agendaRes = await api.get(`/attendance/today?date=${dateStr}`);
            const agenda = agendaRes.data;
            for (const item of agenda) {
              if (!excludeIds.includes(item.subject.id) && item.status !== "off" && item.status !== "cancelled") {
                await api.post("/attendance/mark", {
                  subjectId: item.subject.id,
                  date: dateStr,
                  status: "off",
                  timetableSlotId: item.type === "slot" ? item.id : undefined,
                  overrideId: item.type === "override" ? item.id : undefined,
                });
              }
            }
            curr.setDate(curr.getDate() + 1);
          }
          navigate(`/today?date=${action.payload.date}`);
          refresh = true;
        } else if (action.type === 'CHANGE_TARGET') {
          await api.patch(`/subjects/${action.payload.subjectId}`, { targetAttendance: action.payload.target });
          refresh = true;
        } else if (action.type === 'CHANGE_GLOBAL_TARGET') {
          const res = await api.patch(`/users/me`, { targetAttendance: action.payload.target });
          useAuthStore.getState().setUser(res.data);
          refresh = true;
        } else if (action.type === 'ADD_SUBJECT') {
          await api.post("/subjects", action.payload);
          refresh = true;
        } else if (action.type === 'REMOVE_SUBJECT') {
          await api.delete(`/subjects/${action.payload.subjectId}`);
          refresh = true;
        } else if (action.type === 'UPDATE_SUBJECT') {
          await api.patch(`/subjects/${action.payload.subjectId}`, action.payload.updates);
          refresh = true;
        } else if (action.type === 'DROP_SUBJECT_FROM_TIMETABLE') {
          await api.delete(`/timetable/semester/${action.payload.semesterId}/subject/${action.payload.subjectId}/slots`);
          refresh = true;
        } else if (action.type === 'SHARE_APP') {
          let appLink = "https://www.attendx.tech"; try { const res = await api.get("/system/config"); if (res.data && res.data.appDownloadLink) appLink = res.data.appDownloadLink; } catch (e) {}
          const shareText = `Download AttendX to manage your academic attendance easily!\n\n${appLink}`;
          try {
            const { Capacitor } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
              const { Share } = await import("@capacitor/share");
              await Share.share({ title: "Smart Attendance Manager", text: shareText, dialogTitle: "Share AttendX" });
            } else if (navigator.share) {
              await navigator.share({ title: "Smart Attendance Manager", text: shareText });
            } else {
              navigator.clipboard.writeText(shareText);
            }
          } catch (e) {
            console.warn("Share failed", e);
          }
        } else if (action.type === 'CHANGE_REMINDER_FREQUENCY') {
          const rawFreq = String(action.payload.frequency || 'daily');
          let capFreq: 'Never'|'Daily'|'Weekly'|'Monthly'|'Yearly' = 'Daily';
          let subValue: string | undefined = action.payload.subValue;

          if (/never|none|off|false|disable/i.test(rawFreq)) capFreq = 'Never';
          else if (/weekly/i.test(rawFreq)) { capFreq = 'Weekly'; if (!subValue) subValue = 'Sun'; }
          else if (/monthly/i.test(rawFreq)) { capFreq = 'Monthly'; if (!subValue) subValue = '1'; }
          else if (/yearly/i.test(rawFreq)) { capFreq = 'Yearly'; if (!subValue) subValue = 'Jan'; }
          else if (/daily/i.test(rawFreq)) capFreq = 'Daily';
          
          const freqData = { type: capFreq, subValue };
          useCacheStore.getState().setReminderFrequency(freqData);
          NotificationService.scheduleAcademicUpdates(freqData);
          const subLabel = subValue ? ` (${subValue})` : '';
          // Confirmed via AI chat message
        } else if (action.type === 'SWITCH_THEME') {
          const theme = action.payload.theme || 'system';
          useThemeStore.getState().setTheme(theme);
        } else if (action.type === 'CHANGE_SUMMARY_TIME') {
          // Use model-specified bracket if given, otherwise fall back to the stored active frequency
          const bracket = action.payload.bracket || useCacheStore.getState().reminderFrequency?.type || 'Daily';
          if (bracket === 'Weekly') useNotificationStore.getState().updateConfig({ weeklySummaryTime: action.payload.time });
          else if (bracket === 'Monthly') useNotificationStore.getState().updateConfig({ monthlySummaryTime: action.payload.time });
          else if (bracket === 'Yearly') useNotificationStore.getState().updateConfig({ yearlySummaryTime: action.payload.time });
          else useNotificationStore.getState().updateConfig({ summaryTime: action.payload.time });
          // Confirmed via AI chat message
        } else if (action.type === 'CHANGE_CLASS_REMINDER_OFFSET') {
          const mins = Number(action.payload.offsetMinutes ?? 10);
          useNotificationStore.getState().updateConfig({ classReminderOffset: mins });
          NotificationService.autoScheduleFromTimetable().catch(() => {});
        } else if (action.type === 'UPDATE_TIMETABLE_ALERTS' || action.type === 'UPDATE_NOTIFICATION_CONFIG') {
          const updates: any = {};
          if (action.payload.classReminderOffset !== undefined) {
            updates.classReminderOffset = Number(action.payload.classReminderOffset);
          }
          if (action.payload.showLocation !== undefined) {
            updates.showLocation = Boolean(action.payload.showLocation);
          }
          if (action.payload.notifyNextClassOnEnd !== undefined) {
            updates.notifyNextClassOnEnd = Boolean(action.payload.notifyNextClassOnEnd);
          }
          if (action.payload.endOfDaySummary !== undefined) {
            updates.endOfDaySummary = Boolean(action.payload.endOfDaySummary);
          }
          useNotificationStore.getState().updateConfig(updates);
          NotificationService.autoScheduleFromTimetable().catch(() => {});
        } else if (action.type === 'ADD_TIMETABLE_SLOT') {
          await api.post(`/timetable/slots`, {
            semesterId: activeSemesterId,
            subjectId: action.payload.subjectId,
            dayOfWeek: action.payload.dayOfWeek,
            startTime: action.payload.startTime,
            endTime: action.payload.endTime,
            room: action.payload.room || "TBD",
            slotType: action.payload.slotType || "LECTURE"
          });
          refresh = true;
        } else if (action.type === 'REMOVE_TIMETABLE_SLOT') {
          const ttRes = await api.get(`/timetable/${activeSemesterId}`);
          const timetable = ttRes.data;
          let targetSlotId = null;
          const slot = timetable.find((s: any) => s.subject.id === action.payload.subjectId && s.dayOfWeek === action.payload.dayOfWeek && s.startTime === action.payload.startTime);
          if (slot) {
            targetSlotId = slot.id;
          }
          if (targetSlotId) {
            await api.delete(`/timetable/slots/${targetSlotId}`);
            refresh = true;
          } else {
            console.error("Could not find timetable slot to remove.");
          }
        } else if (action.type === 'SHIFT_TIMETABLE_SLOT') {
          // Fetch timetable to find the slot
          const targetSemesterId = action.payload.semesterId || activeSemesterId;
          const ttRes = await api.get(`/timetable/${targetSemesterId}`);
          const timetable = ttRes.data;
          // Find the slot matching subjectId and dayOfWeek
          let targetSlotId = null;
          const slot = timetable.find((s: any) => s.subject.id === action.payload.subjectId && s.dayOfWeek === action.payload.dayOfWeek);
          if (slot) {
            targetSlotId = slot.id;
          }
          if (targetSlotId) {
            await api.patch(`/timetable/slots/${targetSlotId}`, {
              dayOfWeek: action.payload.newDayOfWeek !== undefined ? action.payload.newDayOfWeek : undefined,
              startTime: action.payload.newStartTime,
              endTime: action.payload.newEndTime
            });
            refresh = true;
          } else {
            console.error("Could not find timetable slot to shift.");
          }
        } else if (action.type === 'SWAP_TIMETABLE_DAYS') {
          await api.post(`/timetable/days/swap`, {
            semesterId: activeSemesterId,
            dayA: action.payload.dayA,
            dayB: action.payload.dayB
          });
          refresh = true;
        } else if (action.type === 'SHIFT_TIMETABLE_DAY') {
          await api.post(`/timetable/days/shift`, {
            semesterId: activeSemesterId,
            sourceDay: action.payload.sourceDay,
            targetDay: action.payload.targetDay
          });
          refresh = true;
        } else if (action.type === 'ADD_ASSIGNMENT') {
          // Bug Fix: AI hallucinates the 'Z' on local times. Strip it and parse as local time to convert correctly.
          let safeDeadline = action.payload.deadline;
          if (safeDeadline) {
             safeDeadline = safeDeadline.replace("Z", ""); // Force local time parsing
             safeDeadline = new Date(safeDeadline).toISOString();
          }
          await api.post(`/assignments`, {
            title: action.payload.title,
            description: action.payload.description || "",
            deadline: safeDeadline,
            subjectId: action.payload.subjectId || null,
            priority: action.payload.priority || "medium"
          });
          // Refresh assignments via store
          await useAssignmentStore.getState().fetchAssignments();
          navigate('/assignments');
          refresh = true;
        } else if (action.type === 'MARK_ASSIGNMENT_COMPLETED') {
          if (action.payload.assignmentId) {
             await api.post(`/assignments/${action.payload.assignmentId}/toggle`);
          } else if (action.payload.title) {
             const assignments = useAssignmentStore.getState().assignments;
             const target = assignments.find(a => a.title.toLowerCase().includes(action.payload.title.toLowerCase()));
             if (target) await api.post(`/assignments/${target.id}/toggle`);
          }
          await useAssignmentStore.getState().fetchAssignments();
        } else if (action.type === 'DELETE_ASSIGNMENT') {
          if (action.payload.assignmentId) {
             await api.delete(`/assignments/${action.payload.assignmentId}`);
          } else if (action.payload.title) {
             const assignments = useAssignmentStore.getState().assignments;
             const target = assignments.find(a => a.title.toLowerCase().includes(action.payload.title.toLowerCase()));
             if (target) await api.delete(`/assignments/${target.id}`);
          }
          await useAssignmentStore.getState().fetchAssignments();
        }
        return refresh;
      };
      
      let shouldRefresh = false;
      const pendingActions: ActionPayload[] = [];
      let simulation: SimulationPayload | undefined = undefined;
      let semesterProjection: SemesterProjectionPayload | undefined = undefined;
      const botResponseId = String(Date.now() + 1);
      
      if (data.actions && Array.isArray(data.actions)) {
        for (const rawAction of data.actions) {
          // Enforce code-level security: check DESTRUCTIVE_ACTIONS set
          const isDestructive =
            DESTRUCTIVE_ACTIONS.has(rawAction.type) ||
            Boolean(rawAction.isDestructive) ||
            Boolean(rawAction.requiresConfirmation);

          const action: ActionPayload = {
            id: rawAction.id || `act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            type: rawAction.type,
            category: isDestructive ? "DESTRUCTIVE" : "SAFE",
            isDestructive,
            requiresConfirmation: isDestructive,
            target: rawAction.target || rawAction.payload?.subjectName || rawAction.payload?.subjectId || rawAction.payload?.date || "Academic Data",
            description: rawAction.description || `Execute ${rawAction.type}`,
            impact: rawAction.impact || (isDestructive ? "Destructive change to attendance or timetable data." : "Safe non-destructive action."),
            payload: rawAction.payload || {}
          };

          if (action.requiresConfirmation) {
            // HALT automatic execution for destructive actions
            pendingActions.push(action);
          } else {
            // Safe actions execute immediately
            try {
              const refreshed = await executeActionRef.current(action);
              if (refreshed) shouldRefresh = true;
            } catch (actionErr) {
              console.error(`Error executing AI action ${action.type}:`, actionErr);
            }
          }
        }
      }

      if (shouldRefresh) {
        window.dispatchEvent(new Event("attendance-updated"));
        window.dispatchEvent(new Event("subject-updated"));
      }

      if (data.simulation) {
        simulation = data.simulation;
      }
      if (data.semesterProjection) {
        semesterProjection = data.semesterProjection;
      }

      const botResponse: Message = {
        id: botResponseId,
        role: "assistant",
        content: data.response || data.reply || "No response received from ordinance model.",
        citations: data.citations || [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        pendingActions: pendingActions.length > 0 ? pendingActions : undefined,
        actionsExecuted: false,
        simulation,
        semesterProjection
      };

      setMessages(prev => [...prev, botResponse]);
      
      

      return data.response || data.reply;
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        console.log("AI Chat generation stopped by user.");
        return;
      }
      console.error("AI Chat error:", err);
      const errorMessage: Message = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: "I am currently offline or unable to reach the AI service. Please check your internet connection.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Stop all active listening when app is minimized/backgrounded
  useEffect(() => {
    const listener = App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        if (isHandsFreeRef.current) {
          stopHandsFreeMode("App backgrounded.");
        }
        if (isVoiceOpen) {
          setIsVoiceOpen(false);
          NativeVoiceService.stopListening();
          NativeVoiceService.stopSpeaking();
          NativeVoiceService.stopContinuousLoop();
        }
      }
    });
    return () => { listener.then(l => l.remove()); };
  }, [isVoiceOpen]);

  return (
    <>
      {/* Floating Trigger Dock with Ambient Glow */}
      <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 right-6 z-40">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setIsOpen(prev => {
              if (prev && isHandsFreeRef.current) {
                stopHandsFreeMode();
              }
              return !prev;
            });
          }}
          className={`chatbot-btn group relative flex items-center gap-2.5 px-4 py-3 rounded-full shadow-xl transition-all cursor-pointer text-xs font-semibold ${getPillClasses()}`}
          aria-label="Open AttendX AI"
        >
          <div className="relative">
            <Sparkles className="w-4 h-4 text-current animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-50"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
            </span>
          </div>
          <span className="font-bold tracking-wide">AttendX AI</span>
          <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.5 rounded-md font-mono border border-current opacity-70">
            Ctrl+/
          </span>
        </motion.button>
      </div>

      {/* Voice Mode Fullscreen Overlay */}
      <VoiceModeOverlay 
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        onSendMessage={async (q, inputMethod = 'voice') => {
          return await handleSendMessage(q, inputMethod);
        }}
        pendingActionMsgId={(function(){ const lastMsg = messages[messages.length - 1]; return (lastMsg && lastMsg.role === 'assistant' && lastMsg.pendingActions && !lastMsg.actionsExecuted && !lastMsg.isExecutingAction) ? lastMsg.id : undefined; })()}
        onConfirmPendingAction={(id) => {
           if ((window as any)._executePendingActions) {
              (window as any)._executePendingActions(id);
           }
        }}
        onCancelPendingAction={(id) => {
           if ((window as any)._cancelPendingActions) {
              (window as any)._cancelPendingActions(id);
           }
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
            className={`chatbot-window fixed z-50 flex flex-col bg-card dark:bg-black border border-primary/20 dark:border-primary/30 shadow-2xl shadow-primary/20 overflow-hidden text-foreground ${
              isExpanded
                ? "bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-[680px] h-[88vh] max-h-[780px] rounded-none"
                : "bottom-24 md:bottom-20 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-[440px] h-[80vh] max-h-[620px] rounded-none"
            }`}
          >
            {/* Header with Frosted Glass Top Bar */}
            <div className="px-5 py-3.5 border-b border-primary/10 dark:border-white/10 bg-white/70 dark:bg-black/70 backdrop-blur-md flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">

                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 font-bold shadow-sm border border-blue-500/20">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                    {isServerOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 border-2 border-white dark:border-slate-900 ${isServerOnline ? 'bg-emerald-500' : 'bg-yellow-500'}`}></span>
                  </span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold tracking-tight text-foreground flex items-center gap-1.5">
                    AttendX AI
                    
                  </h3>
                  
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 text-muted-foreground">

                {messages.length > 0 && (
                  <button
                    onClick={handleResetChat}
                    className="p-1.5 rounded-none hover:bg-primary/10 hover:text-foreground transition-colors cursor-pointer"
                    title="Clear conversation"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={() => setIsExpanded(prev => !prev)}
                  className="hidden sm:inline-flex p-1.5 rounded-none hover:bg-primary/10 hover:text-foreground transition-colors cursor-pointer"
                  title={isExpanded ? "Collapse view" : "Expand view"}
                >
                  {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={() => {
                    stopHandsFreeMode();
                    NativeVoiceService.stopSpeaking();
                    NativeVoiceService.stopListening();
                    setIsOpen(false);
                  }}
                  className="p-1.5 rounded-none hover:bg-primary/10 hover:text-foreground transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Offline Banner */}
            {!isServerOnline && (
              <div className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-4 py-2 flex items-center gap-2 text-xs border-b border-yellow-500/20">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span><strong>Offline Mode:</strong> Connecting to AttendX AI failed. Chat and voice features are temporarily unavailable.</span>
              </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto">
              {messages.length === 0 ? (
                <motion.div 
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: { opacity: 1 }
                  }}
                  className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4"
                >
                  <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-2 shadow-sm border border-blue-500/20">
                    <Sparkles className="w-8 h-8 text-blue-500" />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    Hey {user?.name?.split(" ")[0] || "there"},<br/>how can I help you today?
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-[250px]">
                    Ask me anything about your attendance or institute policies.
                  </p>
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
                        // User Message: Light pink theme with max contrast text
                        <div className={`max-w-[85%] rounded-none rounded-tr-xs px-4 py-2.5 text-[13px] font-medium shadow-sm ${getChatBubbleClasses()}`}>
                          <FormattedChatMessage content={msg.content} isUser={true} />
                          <div className="text-right text-[9px] mt-1 font-mono opacity-70 mix-blend-multiply">{msg.timestamp}</div>
                        </div>
                      ) : (
                        // Assistant Message: Crisp elevated card with soft border & citation badges
                        <div className="w-full space-y-2">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span className="font-bold text-foreground flex items-center gap-1.5">
                              <div className="w-4 h-4 rounded-full bg-blue-500/10 text-blue-500 dark:text-blue-500 flex items-center justify-center border border-blue-500/20">
                                <Sparkles className="w-2.5 h-2.5" />
                              </div>
                              AttendX AI
                            </span>
                            <span className="text-[10px] font-mono opacity-70">{msg.timestamp}</span>
                          </div>

                          <div className="p-4 rounded-none bg-white/90 dark:bg-black/90 border border-black dark:border-black dark:border-white text-foreground/90 leading-relaxed shadow-sm">
                            <FormattedChatMessage content={msg.content} isUser={false} />

                            {/* Simulation Sandbox Card */}
                            {msg.simulation && (
                              <div className="mt-3.5 pt-3 border-t border-blue-500/30">
                                <div className="p-3 rounded-none bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-100">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Activity className="w-4 h-4 text-blue-500" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Simulation Complete</span>
                                  </div>
                                  <p className="text-[13px] font-medium mb-3">
                                    If you {msg.simulation.skipCount < 0 ? `attend ${Math.abs(msg.simulation.skipCount)}` : `skip ${msg.simulation.skipCount}`} class(es) of <span className="font-bold">{msg.simulation.subjectName}</span>:
                                  </p>
                                  <div className="flex items-center justify-between p-2 rounded-none bg-white/50 dark:bg-black/20 text-xs">
                                    <div>
                                      <div className="text-muted-foreground mb-1">New Attendance</div>
                                      <div className="font-mono">{msg.simulation.skipCount < 0 ? msg.simulation.currentAttended + Math.abs(msg.simulation.skipCount) : msg.simulation.currentAttended} / {msg.simulation.currentTotal + Math.abs(msg.simulation.skipCount)}</div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-muted-foreground mb-1">Projected %</div>
                                      <div className={`font-bold text-lg ${msg.simulation.projectedPercentage < msg.simulation.targetPercentage ? 'text-rose-500' : 'text-emerald-500'}`}>
                                        {msg.simulation.projectedPercentage.toFixed(2)}%
                                      </div>
                                    </div>
                                  </div>
                                  {msg.simulation.projectedPercentage < msg.simulation.targetPercentage && (
                                    <div className="mt-2 text-[11px] text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1.5">
                                      <AlertTriangle className="w-3.5 h-3.5" /> This will drop you below your {msg.simulation.targetPercentage}% target!
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* Semester Projection Sandbox Card */}
                            {msg.semesterProjection && (
                              <div className="mt-3.5 pt-3 border-t border-primary/30">
                                <div className="p-3 rounded-none bg-primary/10 border border-primary/20 text-foreground dark:text-purple-100">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Activity className="w-4 h-4 text-primary" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-primary dark:text-primary">Semester Projection</span>
                                  </div>
                                  <p className="text-[13px] font-medium mb-3">
                                    If you {msg.semesterProjection.skipCountPerSubject === 0 ? 'attend all remaining classes' : (msg.semesterProjection.skipCountPerSubject === -1 ? 'miss all remaining classes' : `skip ${msg.semesterProjection.skipCountPerSubject} classes`)} per subject until {new Date(msg.semesterProjection.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}:
                                  </p>
                                  <div className="space-y-2">
                                    {msg.semesterProjection.subjects.map((sub, idx) => (
                                      <div key={idx} className="flex items-center justify-between p-2 rounded-none bg-white/50 dark:bg-black/20 text-xs">
                                        <div className="flex-1 truncate pr-2">
                                          <div className="font-bold truncate" title={sub.subjectName}>{sub.subjectName}</div>
                                          <div className="text-muted-foreground text-[10px]">{sub.remainingClasses} classes left</div>
                                        </div>
                                        <div className="text-right whitespace-nowrap">
                                          <div className={`font-bold text-sm ${sub.projectedPercentage < sub.targetPercentage ? 'text-rose-500' : 'text-emerald-500'}`}>
                                            {sub.projectedPercentage.toFixed(1)}%
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Itemized Action Confirmation Card */}
                            {msg.pendingActions && msg.pendingActions.length > 0 && !msg.actionsExecuted && (
                              <div className="mt-3.5 pt-3 border-t border-rose-500/30">
                                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-foreground">
                                  <div className="flex items-center gap-2 mb-2 text-rose-600 dark:text-rose-400">
                                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Action Confirmation Required</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-3 font-medium">
                                    The Copilot staged destructive modifications to your academic data. Review the pending actions below:
                                  </p>

                                  {/* Itemized action list */}
                                  <div className="space-y-2 mb-3">
                                    {msg.pendingActions.map((act, actIdx) => (
                                      <div
                                        key={act.id || actIdx}
                                        className="p-2.5 rounded-lg bg-background/80 border border-border/80 text-xs flex flex-col gap-1 shadow-xs"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-600 dark:text-rose-400">
                                            {act.type}
                                          </span>
                                          {act.target && (
                                            <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[160px]" title={act.target}>
                                              {act.target}
                                            </span>
                                          )}
                                        </div>
                                        {act.description && (
                                          <p className="font-semibold text-foreground text-xs mt-0.5">
                                            {act.description}
                                          </p>
                                        )}
                                        {act.impact && (
                                          <div className="flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                                            <AlertTriangle className="w-3 h-3 shrink-0" />
                                            <span>{typeof act.impact === 'string' ? act.impact : 'Destructive modification to academic records.'}</span>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => {
                                        if ((window as any)._executePendingActions) {
                                          (window as any)._executePendingActions(msg.id);
                                        }
                                      }}
                                      disabled={msg.isExecutingAction}
                                      className={`px-3 py-1.5 text-white rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer ${
                                        msg.isExecutingAction ? "bg-rose-500/50 cursor-not-allowed" : "bg-rose-600 hover:bg-rose-700"
                                      }`}
                                    >
                                      {msg.isExecutingAction ? (
                                        <><Loader2 className="w-3 h-3 animate-spin" /> Executing...</>
                                      ) : (
                                        <><Check className="w-3 h-3" /> Confirm Action</>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => {
                                        if ((window as any)._cancelPendingActions) {
                                          (window as any)._cancelPendingActions(msg.id);
                                        }
                                      }}
                                      disabled={msg.isExecutingAction}
                                      className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                            {msg.pendingActions && msg.actionsExecuted && (
                              <div className="mt-3.5 pt-3 border-t border-emerald-500/30">
                                <div className="p-2 rounded-none bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-2 text-xs font-bold">
                                  <Check className="w-4 h-4" /> Action Executed Successfully
                                </div>
                              </div>
                            )}

                            {/* Action Bar (Audio Read-Aloud, Copy) */}
                            <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleSpeakMessage(msg.id, msg.content)}
                                  className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-none hover:bg-primary/10 transition-colors cursor-pointer ${
                                    speakingId === msg.id ? "text-emerald-500 font-bold" : "hover:text-foreground"
                                  }`}
                                  title={speakingId === msg.id ? "Stop listening" : "Listen to answer (Voice)"}
                                >
                                  <Volume2 className={`w-3.5 h-3.5 ${speakingId === msg.id ? "animate-pulse" : ""}`} />
                                  <span className="text-[10px]">{speakingId === msg.id ? "Speaking..." : "Listen"}</span>
                                </button>

                                <button
                                  onClick={() => handleCopy(msg.id, msg.content)}
                                  className="inline-flex items-center gap-1 text-[11px] hover:text-foreground px-2 py-1 rounded-none hover:bg-primary/10 transition-colors cursor-pointer"
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

                              
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}

                  {/* Animated Policy Searching / Loading State */}
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="px-4 py-3 bg-muted/40 rounded-none rounded-tl-sm max-w-[fit-content] mr-auto"
                    >
                      <div className="flex items-center gap-1.5 h-4">
                        <span className="w-1.5 h-1.5 rounded-none bg-foreground/40 animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-1.5 h-1.5 rounded-none bg-foreground/40 animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-1.5 h-1.5 rounded-none bg-foreground/40 animate-bounce"></span>
                      </div>
                    </motion.div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Gemini-style Bottom Composer Pill */}
            <div className="p-3 bg-gradient-to-t from-background/90 to-transparent pb-4">

              <AnimatePresence>
                {isHandsFree && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: 10, height: 0 }}
                    className="mb-3 mx-1 bg-black/90 backdrop-blur-md rounded-[20px] border border-white/10 p-3 shadow-lg flex items-center justify-between overflow-hidden"
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${
                          handsFreeStatus === 'LISTENING' ? 'bg-emerald-500 animate-pulse' :
                          handsFreeStatus === 'SPEAKING' ? 'bg-blue-500 animate-pulse' :
                          'bg-amber-500 animate-pulse'
                        }`} />
                        <span className="text-white font-bold text-xs tracking-wider">HANDS-FREE<br/>MODE</span>
                        <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full ml-1 font-medium">
                          {handsFreeStatus === 'LISTENING' ? 'Listening...' :
                           handsFreeStatus === 'SPEAKING' ? 'Speaking...' :
                           'Thinking...'}
                        </span>
                      </div>
                      <span className="text-[10px] text-white/50 mt-1">Say "stop" or tap Stop Conv...</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => stopHandsFreeMode()}
                      className="bg-[#ff004d] hover:bg-rose-500 text-white text-[11px] font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Square className="w-3 h-3 fill-current" />
                      Stop Conversation
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="relative flex items-center gap-2 bg-slate-100 dark:bg-black rounded-[24px] px-2 py-1.5 shadow-sm dark:shadow-[0_0_15px_rgba(0,0,0,0.5)] mx-1 border border-slate-200 dark:border-white/10"
              >
                <div className="flex-1 pl-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    placeholder="Ask AttendX AI"
                    onChange={(e) => {
                      setInput(e.target.value);
                      lastInputMethodRef.current = 'text';
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') {
                        lastInputMethodRef.current = 'text';
                      }
                    }}
                    className="w-full bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none placeholder:text-slate-500 dark:placeholder:text-gray-400 py-2"
                    disabled={isLoading}
                  />
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-1 pr-1">
                  {isLoading ? (
                    <button
                      type="button"
                      onClick={handleStopGeneration}
                      className="w-9 h-9 rounded-full bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white flex items-center justify-center hover:bg-slate-300 dark:hover:bg-white/20 transition-colors cursor-pointer"
                      title="Stop generation"
                    >
                      <div className="w-3.5 h-3.5 bg-current rounded-[2px]"></div>
                    </button>
                  ) : input.trim() ? (
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-9 h-9 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center hover:bg-blue-500/30 transition-colors cursor-pointer"
                      title="Send"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={startHandsFreeMode}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                          isHandsFree ? 'bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10'
                        }`}
                        title={isHandsFree ? "Stop Hands-Free Mode" : "Start Hands-Free Mode"}
                      >
                        <Radio className="w-4.5 h-4.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsVoiceOpen(true);
                        }}
                        className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/10 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors cursor-pointer"
                        title="Live Voice Mode"
                      >
                        <AudioLines className="w-4.5 h-4.5" />
                      </button>
                    </>
                  )}
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};





