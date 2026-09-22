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
  AlertTriangle
} from "lucide-react";
import { FormattedChatMessage } from "./FormattedChatMessage";
import { VoiceModeOverlay } from "./VoiceModeOverlay";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { useAuthStore } from "../../stores/authStore";
import { NativeVoiceService } from "../../services/NativeVoiceService";
import { Capacitor } from "@capacitor/core";
import { useCacheStore } from "../../stores/cacheStore";
import { NotificationService } from "../../services/NotificationService";
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
  "DROP_SUBJECT_FROM_TIMETABLE",
  "REMOVE_ATTENDANCE",
  "MARK_FULL_DAY_OFF",
  "SHIFT_TIMETABLE_SLOT",
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
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [searchStageIndex, setSearchStageIndex] = useState(0);
  const [appVersion, setAppVersion] = useState("Unknown");

  useEffect(() => {
    App.getInfo().then(info => setAppVersion(info.version)).catch(() => {});
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
        NativeVoiceService.stopSpeaking();
        NativeVoiceService.stopListening();
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Lifecycle cleanup: ensure speech & listening terminate when component unmounts
  useEffect(() => {
    return () => {
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
      onError: (err) => {
        console.warn("Inline mic error:", err);
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

  const handleSendMessage = async (textToSend?: string, inputMethod?: 'text' | 'voice'): Promise<string | undefined> => {
    const effectiveInputMethod = inputMethod || lastInputMethodRef.current;
    // Reset tracker back to default 'text' for subsequent interactions
    lastInputMethodRef.current = 'text';

    const query = textToSend || input.trim();
    if (!query || isLoading) return;

    // Immediately stop any currently playing speech to prevent audio clash
    await NativeVoiceService.stopSpeaking();
    setSpeakingId(null);

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
        history_logs: currentLogs.slice(0, 150),
        calendar_events: currentEvents.slice(0, 50)
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
        localTime: new Date().toISOString(),
        history,
        student_context: studentContext
      });

      const data = res.data;

      // Requirement R2: TTS must ONLY trigger automatically if the user's prompt came from voice
      // and VoiceModeOverlay is not open (overlay handles its own speech)
      const textToSpeak = data.response || data.reply;
      if (effectiveInputMethod === 'voice' && !isVoiceOpen && textToSpeak) {
        await NativeVoiceService.stopSpeaking();
        await NativeVoiceService.speak(textToSpeak);
      } else {
        // When inputMethod === 'text', mute automatic TTS and explicitly ensure any audio is stopped
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
        } else if (action.type === 'DROP_SUBJECT_FROM_TIMETABLE') {
          await api.delete(`/timetable/semester/${action.payload.semesterId}/subject/${action.payload.subjectId}/slots`);
          refresh = true;
        } else if (action.type === 'SHARE_APP') {
          const appLink = "https://drive.google.com/file/d/1XZBMJBfY8YMGaY82k3FTBHtHmymWggF1/view?usp=sharing";
          if (navigator.share) {
            navigator.share({
              title: "Smart Attendance Manager",
              text: "Download AttendX to manage your academic attendance easily!",
              url: appLink,
            }).catch(() => {});
          } else {
            navigator.clipboard.writeText(appLink);
          }
        } else if (action.type === 'CHANGE_REMINDER_FREQUENCY') {
          const rawFreq = action.payload.frequency || 'daily';
          let capFreq: 'Never'|'Daily'|'Weekly'|'Monthly'|'Yearly' = 'Daily';
          if (rawFreq.toLowerCase() === 'never') capFreq = 'Never';
          if (rawFreq.toLowerCase() === 'weekly') capFreq = 'Weekly';
          if (rawFreq.toLowerCase() === 'monthly') capFreq = 'Monthly';
          if (rawFreq.toLowerCase() === 'yearly') capFreq = 'Yearly';
          
          const freqData = { type: capFreq };
          useCacheStore.getState().setReminderFrequency(freqData);
          NotificationService.scheduleAcademicUpdates(freqData);
          toast.success(`Reminder frequency updated to ${capFreq}`);
        } else if (action.type === 'SHIFT_TIMETABLE_SLOT') {
          // Fetch timetable to find the slot
          const ttRes = await api.get(`/timetable/${action.payload.semesterId}`);
          const timetable = ttRes.data;
          // Find the slot matching subjectId and dayOfWeek
          let targetSlotId = null;
          for (const day of Object.values(timetable.weeklySchedule) as any[]) {
            const slot = day.find((s: any) => s.subject.id === action.payload.subjectId && s.dayOfWeek === action.payload.dayOfWeek);
            if (slot) {
              targetSlotId = slot.id;
              break;
            }
          }
          if (targetSlotId) {
            await api.patch(`/timetable/slots/${targetSlotId}`, {
              startTime: action.payload.newStartTime,
              endTime: action.payload.newEndTime
            });
            refresh = true;
          } else {
            console.error("Could not find timetable slot to shift.");
          }
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
          onClick={() => setIsOpen(prev => !prev)}
          className="chatbot-btn group relative flex items-center gap-2.5 bg-primary text-white px-4 py-3 rounded-full shadow-xl shadow-primary/25 border border-white/20 transition-all cursor-pointer text-xs font-semibold"
          aria-label="Open AttendX AI"
        >
          <div className="relative">
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-none bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-none h-2 w-2 bg-emerald-400"></span>
            </span>
          </div>
          <span className="font-bold tracking-wide">AttendX AI</span>
          <span className="hidden sm:inline-block text-[10px] text-white/80 bg-white/20 px-1.5 py-0.5 rounded-none font-mono">
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
      />

      {/* Main Chat Drawer with Fluid Spring Opening Animation */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 35 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 25 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            className={`fixed z-50 flex flex-col bg-card border border-primary/20 dark:border-primary/30 shadow-2xl shadow-primary/20 overflow-hidden text-foreground ${
              isExpanded
                ? "bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-[680px] h-[88vh] max-h-[780px] rounded-none"
                : "bottom-24 md:bottom-20 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-[440px] h-[80vh] max-h-[620px] rounded-none"
            }`}
          >
            {/* Header with Frosted Glass Top Bar */}
            <div className="px-5 py-3.5 border-b border-primary/10 dark:border-black dark:border-white bg-white/70 dark:bg-[#11172a]/70 backdrop-blur-md flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                {messages.length > 0 && (
                  <button
                    onClick={() => setMessages([])}
                    className="p-1.5 rounded-none hover:bg-primary/10 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="New Chat"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
                <div className="relative">
                  <div className="w-8 h-8 rounded-none bg-primary flex items-center justify-center text-white font-bold shadow-md shadow-primary/20">
                    <Bot className="w-4 h-4" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-none bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-none h-2.5 w-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
                  </span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold tracking-tight text-foreground flex items-center gap-1.5">
                    AttendX Policy AI
                    
                  </h3>
                  
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 text-muted-foreground">
                {/* Voice Call Mode Button */}
                <button
                  onClick={() => setIsVoiceOpen(true)}
                  className="flex items-center gap-1 text-[11px] font-bold bg-primary/15 hover:bg-primary/25 text-primary dark:text-primary-foreground border border-primary/30 px-2.5 py-1 rounded-none transition-all cursor-pointer shadow-xs"
                  title="Talk with AI using voice"
                >
                  <Mic className="w-3.5 h-3.5 text-fuchsia-500 animate-pulse" />
                  <span className="hidden sm:inline">Voice Mode</span>
                </button>

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
                  <div className="w-16 h-16 bg-blue-500/10 rounded-none flex items-center justify-center mb-2">
                    <Bot className="w-8 h-8 text-blue-500" />
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
                        // User Message: Soft yellow/gold pill in light mode or high-contrast in dark mode
                        <div className="max-w-[85%] rounded-none rounded-tr-xs bg-amber-100/90 dark:bg-primary text-amber-950 dark:text-primary-foreground border border-amber-300/60 dark:border-primary/40 px-4 py-2.5 text-[13px] font-medium shadow-sm">
                          <FormattedChatMessage content={msg.content} isUser={true} />
                          <div className="text-right text-[9px] opacity-70 mt-1 font-mono">{msg.timestamp}</div>
                        </div>
                      ) : (
                        // Assistant Message: Crisp elevated card with soft border & citation badges
                        <div className="w-full space-y-2">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span className="font-bold text-foreground flex items-center gap-1.5">
                              <div className="w-4 h-4 rounded-none bg-primary/20 text-primary dark:text-primary flex items-center justify-center">
                                <Bot className="w-2.5 h-2.5" />
                              </div>
                              AttendX AI
                            </span>
                            <span className="text-[10px] font-mono opacity-70">{msg.timestamp}</span>
                          </div>

                          <div className="p-4 rounded-none bg-white/90 dark:bg-[#151b2e]/90 border border-black dark:border-black dark:border-white text-foreground/90 leading-relaxed shadow-sm">
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
                                    If you skip <span className="font-bold">{msg.simulation.skipCount}</span> class(es) of <span className="font-bold">{msg.simulation.subjectName}</span>:
                                  </p>
                                  <div className="flex items-center justify-between p-2 rounded-none bg-white/50 dark:bg-black/20 text-xs">
                                    <div>
                                      <div className="text-muted-foreground mb-1">New Attendance</div>
                                      <div className="font-mono">{msg.simulation.currentAttended} / {msg.simulation.currentTotal + msg.simulation.skipCount}</div>
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
                                    If you {msg.semesterProjection.skipCountPerSubject > 0 ? `skip ${msg.semesterProjection.skipCountPerSubject} classes` : 'attend all remaining classes'} per subject until {msg.semesterProjection.endDate}:
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

            {/* Bottom Composer Bar */}
            <div className="p-3.5 border-t border-primary/10 dark:border-black dark:border-white bg-white/80 dark:bg-[#11172a]/80 backdrop-blur-md">
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
                  className={`w-9 h-9 rounded-none flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-xs ${
                    isListeningMic
                      ? "bg-rose-500 text-white animate-pulse shadow-rose-500/30"
                      : "bg-primary/10 hover:bg-primary/20 text-primary dark:text-primary-foreground border border-primary/20"
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
                    onChange={(e) => {
                      setInput(e.target.value);
                      lastInputMethodRef.current = 'text';
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') {
                        lastInputMethodRef.current = 'text';
                      }
                    }}
                    
                    className="w-full bg-muted/50 border border-primary/20 focus:border-primary focus:outline-none rounded-none pl-3.5 pr-10 py-2.5 text-xs text-foreground transition-all shadow-inner"
                    disabled={isLoading}
                  />

                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-none bg-primary hover:opacity-90 disabled:opacity-30 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs"
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
