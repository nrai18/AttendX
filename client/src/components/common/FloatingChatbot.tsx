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
    
    App.getInfo().then(info => setAppVersion(info.version)).catch(() => {});
    
    // Poll server health
    const checkHealth = async () => {
      try {
        await api.get("/health", { timeout: 3000 });
        setIsServerOnline(true);
      } catch (e) {
        setIsServerOnline(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 15000);

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
      toast.info(reason);
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
      onPartialResult: (text: string) => {
        if (!isHandsFreeRef.current || isHandsFreeProcessingRef.current) return;
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
          toast.error(`Mic Error: ${err.error}`);
        } else if (err && err.message) {
          toast.error(`Mic Error: ${err.message}`);
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
                // The user hasn't said anything yet, but Android natively turned off the mic.
                // Restart it silently to honor our 20s total inactivity timeout.
                NativeVoiceService.startListening(handsFreeListenOptionsRef.current);
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
          toast.error(`Mic Error: ${err.error}`);
        } else if (err && err.message) {
          toast.error(`Mic Error: ${err.message}`);
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
    const isConfirming = /^(yes|yeah|yep|do it|confirm|execute|sure|ok|okay|yes please|sure do it|yeah do it|yes yes do it|proceed)/.test(cleanQuery);
    const isCanceling = /^(no|nope|cancel|abort|stop|don't|do not|no thanks|no do not cancel)/.test(cleanQuery);

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
      const today = new Date();
      const localTodayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

      const studentContext = {
        user_id: user?.id,
        user_name: user?.name || "Student",
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
        timetable_slots: useCacheStore.getState().timetable?.slots || [],
        history_logs: currentLogs.slice(0, 150),
        calendar_events: currentEvents.slice(0, 50),
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
    
      
      const executeAction = async (action: any) => {
        let refresh = false;
        if (action.type === 'NAVIGATE' && action.payload?.path) {
          navigate(action.payload.path);
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
          const appLink = import.meta.env.VITE_APP_DOWNLOAD_LINK || "https://attendx.app";
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
          toast.success(`Reminder frequency updated to ${capFreq}${subLabel}`);
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
          toast.success(`${bracket} briefing time updated to ${action.payload.time}`);
        } else if (action.type === 'CHANGE_CLASS_REMINDER_OFFSET') {
          useNotificationStore.getState().updateConfig({ classReminderOffset: action.payload.offsetMinutes });
          toast.success(`Class reminders set to ${action.payload.offsetMinutes} mins before`);
        } else if (action.type === 'ADD_TIMETABLE_SLOT') {
          await api.post(`/timetable/slots`, {
            semesterId: studentContext.active_semester_id,
            subjectId: action.payload.subjectId,
            dayOfWeek: action.payload.dayOfWeek,
            startTime: action.payload.startTime,
            endTime: action.payload.endTime,
            room: action.payload.room || "TBD",
            slotType: action.payload.slotType || "LECTURE"
          });
          refresh = true;
        } else if (action.type === 'REMOVE_TIMETABLE_SLOT') {
          const ttRes = await api.get(`/timetable/${studentContext.active_semester_id}`);
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
          const targetSemesterId = action.payload.semesterId || studentContext.active_semester_id;
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
            semesterId: studentContext.active_semester_id,
            dayA: action.payload.dayA,
            dayB: action.payload.dayB
          });
          refresh = true;
        } else if (action.type === 'SHIFT_TIMETABLE_DAY') {
          await api.post(`/timetable/days/shift`, {
            semesterId: studentContext.active_semester_id,
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
             await api.post(`/assignments/${action.payload.assignmentId}/complete`);
          } else if (action.payload.title) {
             const assignments = useAssignmentStore.getState().assignments;
             const target = assignments.find(a => a.title.toLowerCase().includes(action.payload.title.toLowerCase()));
             if (target) await api.post(`/assignments/${target.id}/complete`);
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
              const refreshed = await executeAction(action);
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
      
      // Expose execute function to global window so the UI button can call it
      (window as any)._executePendingActions = async (msgId: string) => {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isExecutingAction: true } : m));
        let globalRefresh = false;
        const targetMsg = messagesRef.current.find(m => m.id === msgId);
        const actionsToRun = (targetMsg?.pendingActions && targetMsg.pendingActions.length > 0) ? targetMsg.pendingActions : pendingActions;

        for (const action of actionsToRun) {
           try {
             const refreshed = await executeAction(action);
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
        toast.success("Action confirmed and executed successfully.");
      };

      (window as any)._cancelPendingActions = (msgId: string) => {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, pendingActions: undefined, actionsExecuted: false } : m));
        toast.info("Action cancelled by user.");
      };

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
        pendingActionMsgId={messages.slice().reverse().find(m => m.role === 'assistant' && m.pendingActions && !m.actionsExecuted && !m.isExecutingAction)?.id}
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
            <div className="px-5 py-3.5 border-b border-primary/10 dark:border-black dark:border-white bg-white/70 dark:bg-black/70 backdrop-blur-md flex items-center justify-between">
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

