import React, { useState, useEffect, useRef, useCallback } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, isAfter, startOfDay, differenceInDays } from "date-fns";
import { ChevronLeft, ChevronRight, Upload, Calendar as CalendarIcon, Loader2, Sparkles, AlertTriangle, ListFilter, AlignLeft, CalendarDays, Timer, CheckCircle2, Plus, Trash2, Palmtree, GraduationCap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../lib/api";
import { hapticMedium } from "../../utils/haptics";
import { EventWizardModal } from "./EventWizardModal";
import { AddEventModal } from "./AddEventModal";
import { CreateSemesterModal } from "../../components/semester/CreateSemesterModal";
import { SemesterTransitionModal } from "../../components/semester/SemesterTransitionModal";
import { CalendarImportModal } from "../../components/calendar/CalendarImportModal";
import { HolidayListTab } from "./HolidayListTab";
import { Link, useSearchParams, useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { useCacheStore } from "../../stores/cacheStore";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { useBackHandlerStore } from "../../stores/backHandlerStore";
import { DiscreteTabs } from "../../components/ui/discrete-tabs";
import { toast } from "sonner";
import { TimedUndoAction } from "../../components/ui/timed-undo-action";
import { PeakpathRays } from "../../components/ui/peakpath-rays";
import { ScrollToTopButton } from "../../components/common/ScrollToTopButton";

interface AppEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  endDate?: string;
  eventType: "ct" | "midsem" | "endsem" | "holiday" | "restricted_holiday" | "vacation" | "fest" | "institute" | "other";
  allDay: boolean;
  isHolidayList?: boolean;
}

interface Semester {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

const parseLocalDate = (dateStr: string | Date) => {
  if (!dateStr) return new Date();
  const dStr = typeof dateStr === 'string' ? dateStr : dateStr.toISOString();
  const [year, month, day] = dStr.split('T')[0].split('-');
  return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
};

const normalizeEventsList = (raw: any): AppEvent[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => e && e.date)
    .map((e) => ({
      ...e,
      eventType: (e.eventType || e.type || "other") as AppEvent["eventType"],
      title: e.title || "Untitled Event",
    }))
    .sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());
};

interface TrashTossAnim {
  key: number;
  event: AppEvent;
  startX: number;
  startY: number;
}

const playTrashWhooshSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // 1. Multi-burst paper crumple rustles while card folds (0.0s - 1.15s)
    const rustleTimes = [0.02, 0.28, 0.56, 0.85];
    rustleTimes.forEach((offset, idx) => {
      const bufferSize = Math.floor(ctx.sampleRate * 0.22);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.45));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.setValueAtTime(1100 + idx * 240, now + offset);
      noiseFilter.Q.setValueAtTime(1.4, now + offset);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.16, now + offset);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.21);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(now + offset);
    });

    // 2. Long parabolic arc aerodynamic whoosh (1.15s - 3.10s)
    const whooshDuration = 1.95;
    const whooshBufferSize = Math.floor(ctx.sampleRate * whooshDuration);
    const whooshBuffer = ctx.createBuffer(1, whooshBufferSize, ctx.sampleRate);
    const wData = whooshBuffer.getChannelData(0);
    for (let i = 0; i < whooshBufferSize; i++) {
      wData[i] = Math.random() * 2 - 1;
    }
    const whooshSource = ctx.createBufferSource();
    whooshSource.buffer = whooshBuffer;
    const whooshFilter = ctx.createBiquadFilter();
    whooshFilter.type = "bandpass";
    whooshFilter.frequency.setValueAtTime(320, now + 1.15);
    whooshFilter.frequency.exponentialRampToValueAtTime(920, now + 2.05);
    whooshFilter.frequency.exponentialRampToValueAtTime(150, now + 3.08);
    whooshFilter.Q.setValueAtTime(3.0, now + 1.15);
    const whooshGain = ctx.createGain();
    whooshGain.gain.setValueAtTime(0.005, now + 1.15);
    whooshGain.gain.linearRampToValueAtTime(0.22, now + 2.05);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 3.10);
    whooshSource.connect(whooshFilter);
    whooshFilter.connect(whooshGain);
    whooshGain.connect(ctx.destination);
    whooshSource.start(now + 1.15);

    // 3. Trash bag catch thud + confirmation pop chime (3.10s - 3.65s)
    const osc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(165, now + 3.10);
    osc.frequency.exponentialRampToValueAtTime(42, now + 3.48);
    thudGain.gain.setValueAtTime(0.32, now + 3.10);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 3.50);
    osc.connect(thudGain);
    thudGain.connect(ctx.destination);
    osc.start(now + 3.10);
    osc.stop(now + 3.52);

    const popOsc = ctx.createOscillator();
    const popGain = ctx.createGain();
    popOsc.type = "sine";
    popOsc.frequency.setValueAtTime(520, now + 3.25);
    popOsc.frequency.exponentialRampToValueAtTime(880, now + 3.52);
    popGain.gain.setValueAtTime(0.14, now + 3.25);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 3.58);
    popOsc.connect(popGain);
    popGain.connect(ctx.destination);
    popOsc.start(now + 3.25);
    popOsc.stop(now + 3.60);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 4700);
  } catch {
    // Ignore audio context errors if blocked by browser autoplay policy
  }
};

const resolveInitialActiveSemester = (userObj: any): Semester | null => {
  const cacheState = useCacheStore.getState();
  if (cacheState.semester?.activeSemester?.id && cacheState.semester.activeSemester.id !== "active-semester") {
    return cacheState.semester.activeSemester;
  }
  if (cacheState.timetable?.activeSemester?.id && cacheState.timetable.activeSemester.id !== "active-semester") {
    return cacheState.timetable.activeSemester;
  }
  if (cacheState.today) {
    for (const entry of Object.values(cacheState.today) as any[]) {
      if (entry?.activeSemester?.id && entry.activeSemester.id !== "active-semester") {
        return entry.activeSemester;
      }
    }
  }
  return null;
};

export const SemesterHubPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { tab: routeTab } = useParams<{ tab: string }>();
  const defaultTab = (routeTab || searchParams.get("tab") as any) || "timeline";
  const [activeTab, setActiveTab] = useState<"timeline" | "calendar" | "events" | "countdowns" | "holidays">(defaultTab);

  useEffect(() => {
    const urlTab = (routeTab || searchParams.get("tab")) as any;
    if (urlTab && ["timeline", "calendar", "events", "countdowns", "holidays"].includes(urlTab)) {
      setActiveTab(urlTab);
    }
  }, [routeTab, searchParams]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const cachedData = useCacheStore((state) => state.semester);
  const setCache = useCacheStore((state) => state.setCache);
  const user = useAuthStore((state) => state.user);
  const hasGlobalActiveSemester = useAttendanceStore(
    (state) => Boolean(state.hasActiveSemester && state.activeSemesterId && state.activeSemesterId !== "active-semester")
  );

  const [events, setEvents] = useState<AppEvent[]>(() =>
    normalizeEventsList(
      cachedData?.events?.length ? cachedData.events : (useAttendanceStore.getState().events as any) || []
    )
  );
  const [activeSemester, setActiveSemester] = useState<Semester | null>(() => resolveInitialActiveSemester(user));
  const [isFetchingSemester, setIsFetchingSemester] = useState<boolean>(() => !resolveInitialActiveSemester(user));
  const [calendarData, setCalendarData] = useState<any>(cachedData?.calendarData || null);
  const [isLoading, setIsLoading] = useState(() => !cachedData && !useAttendanceStore.getState().hasActiveSemester && !resolveInitialActiveSemester(user));

  // Reactive hydration listener when Capacitor Preferences or attendanceStore finish hydrating
  useEffect(() => {
    if (cachedData) {
      if (cachedData.events && events.length === 0) {
        setEvents(normalizeEventsList(cachedData.events));
      }
      if (cachedData.activeSemester) {
        setActiveSemester(cachedData.activeSemester);
        setIsFetchingSemester(false);
      }
      if (cachedData.calendarData && !calendarData) {
        setCalendarData(cachedData.calendarData);
      }
      setIsLoading(false);
    } else if (!activeSemester && hasGlobalActiveSemester) {
      const resolved = resolveInitialActiveSemester(user);
      if (resolved) {
        setActiveSemester(resolved);
        setIsFetchingSemester(false);
      }
    }
  }, [cachedData, hasGlobalActiveSemester, user]);
  
  // OCR & Animation State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timelineNextEventRef = useRef<HTMLDivElement>(null);
  const eventCardRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const hasInitialTimelineScrolledRef = useRef(false);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);
  const [crumblingEventId, setCrumblingEventId] = useState<string | null>(null);
  const [trashTossAnim, setTrashTossAnim] = useState<TrashTossAnim | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [wizardPayload, setWizardPayload] = useState<any>(null);
  const [isCreateSemesterOpen, setIsCreateSemesterOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState(false);

  const setEventCardRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      eventCardRefs.current.set(id, el);
    } else {
      eventCardRefs.current.delete(id);
    }
  }, []);

  const scrollToAndHighlightEvent = useCallback((targetId: string) => {
    if (!targetId) return;
    if (activeTab !== "timeline" && activeTab !== "events") {
      setActiveTab("timeline");
    }
    setHighlightedEventId(targetId);
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedEventId((curr) => (curr === targetId ? null : curr));
    }, 4200);

    setTimeout(() => {
      const el = eventCardRefs.current.get(targetId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 90);
  }, [activeTab]);

  useEffect(() => {
    const unregister = useBackHandlerStore.getState().register(() => {
      if (isTransitionModalOpen) { setIsTransitionModalOpen(false); return true; }
      if (isImportModalOpen) { setIsImportModalOpen(false); return true; }
      if (isAddEventOpen) { setIsAddEventOpen(false); return true; }
      if (isWizardOpen) { setIsWizardOpen(false); return true; }
      if (isCreateSemesterOpen) { setIsCreateSemesterOpen(false); return true; }
      if (activeTab !== "timeline") {
        setActiveTab("timeline");
        if (routeTab || searchParams.get("tab")) {
          navigate("/semester", { replace: true });
        }
        return true;
      }
      navigate("/subjects", { replace: true });
      return true;
    });
    return () => unregister();
  }, [isTransitionModalOpen, isImportModalOpen, isAddEventOpen, isWizardOpen, isCreateSemesterOpen, activeTab, routeTab, searchParams, navigate]);

  const nextEventId = React.useMemo(() => {
    const _today = startOfDay(new Date());
    return events.find(e => {
      const isPast = isAfter(_today, parseLocalDate(e.endDate || e.date));
      return !isPast;
    })?.id;
  }, [events]);

  useEffect(() => {
    if (
      activeTab === "timeline" &&
      !highlightedEventId &&
      !crumblingEventId &&
      !hasInitialTimelineScrolledRef.current &&
      timelineNextEventRef.current
    ) {
      hasInitialTimelineScrolledRef.current = true;
      setTimeout(() => {
        timelineNextEventRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [activeTab, events.length, highlightedEventId, crumblingEventId]);

  const fetchData = async () => {
    // If device is offline, resolve cached data immediately and stop loading
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cache = useCacheStore.getState().semester;
      const attendanceState = useAttendanceStore.getState();
      if (cache?.activeSemester) {
        setActiveSemester(cache.activeSemester);
        setEvents(normalizeEventsList(cache.events || (attendanceState.events as any) || []));
      } else if (attendanceState.hasActiveSemester && attendanceState.activeSemesterId) {
        const bounds = attendanceState.simulationBounds;
        const startDate = bounds?.startDate || new Date(new Date().setMonth(new Date().getMonth() - 2)).toISOString();
        const endDate = bounds?.endDate || new Date(new Date().setMonth(new Date().getMonth() + 4)).toISOString();
        setActiveSemester({ id: attendanceState.activeSemesterId, name: "Active Semester", startDate, endDate } as any);
        setEvents(normalizeEventsList((attendanceState.events as any) || []));
      } else {
        setEvents(normalizeEventsList((attendanceState.events as any) || []));
      }
      setIsLoading(false);
      return;
    }

    try {
      if (!cachedData && !activeSemester && events.length === 0) setIsLoading(true);
      const knownSemId =
        activeSemester?.id ||
        cachedData?.activeSemester?.id ||
        useCacheStore.getState().timetable?.activeSemester?.id ||
        useAttendanceStore.getState().activeSemesterId ||
        null;

      const [semRes, parallelEventsRes] = await Promise.all([
        api.get("/semesters/active"),
        knownSemId && knownSemId !== "active-semester"
          ? api.get(`/events?semesterId=${knownSemId}`)
          : Promise.resolve(null),
      ]);
      
      let nextSemester = null;
      let fetchedEvents: AppEvent[] = [];
      if (semRes.data) {
        nextSemester = semRes.data;
        setActiveSemester(nextSemester);
        const eventsRes =
          parallelEventsRes && knownSemId === semRes.data.id
            ? parallelEventsRes
            : await api.get(`/events?semesterId=${semRes.data.id}`);
        fetchedEvents = normalizeEventsList(eventsRes.data);
      } else {
        setActiveSemester(null);
      }
      setEvents(fetchedEvents);
      
      setCache('semester', {
        ...useCacheStore.getState().semester,
        activeSemester: nextSemester,
        events: fetchedEvents
      });
    } catch (error) {
      console.error("Failed to fetch academic data:", error);
      const fallbackSem = resolveInitialActiveSemester(user);
      const attendanceState = useAttendanceStore.getState();
      if (fallbackSem) {
        setActiveSemester(fallbackSem);
      } else {
        setActiveSemester(null);
      }
      const cache = useCacheStore.getState().semester;
      setEvents(normalizeEventsList(cache?.events?.length ? cache.events : (attendanceState.events as any) || []));
    } finally {
      setIsFetchingSemester(false);
      setIsLoading(false);
    }
  };

  const fetchCalendar = async (force = false) => {
    try {
      const monthStr = format(currentDate, "yyyy-MM");
      const res = await api.get(`/attendance/calendar?month=${monthStr}${force ? "&force=true" : ""}`);
      const d = typeof res.data === 'string' ? { days: [], insights: [], events: [], isComplete: false, completionPercentage: 0, requiredClassesToTarget: 0, canBunk: false } : res.data;
      setCalendarData(d);
      
      setCache('semester', {
        ...useCacheStore.getState().semester,
        calendarData: res.data
      });
    } catch (error) {
      console.error("Failed to fetch calendar:", error);
      const cache = useCacheStore.getState().semester;
      if (cache && cache.calendarData) {
        setCalendarData(cache.calendarData);
      }
    }
  };

  useEffect(() => {
    fetchData();
    let debounceTimer: any = null;
    const handleUpdate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchData();
        fetchCalendar(true);
      }, 40);
    };
    window.addEventListener("attendance-updated", handleUpdate);
    window.addEventListener("events-updated", handleUpdate);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener("attendance-updated", handleUpdate);
      window.removeEventListener("events-updated", handleUpdate);
    };
  }, []);

  useEffect(() => {
    fetchCalendar();
  }, [currentDate]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSemester) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("semesterId", activeSemester.id);

    try {
      setIsUploading(true);
      const res = await api.post("/events/ocr-import", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      if (res.data.status === "needs_setup") {
        setWizardPayload(res.data.rawEvents);
        setIsWizardOpen(true);
      } else {
        useCacheStore.getState().setCache("calendar", null);
        toast.success("Calendar imported successfully!");
        fetchData();
        fetchCalendar(true);
        window.dispatchEvent(new Event("attendance-updated"));
        window.dispatchEvent(new Event("events-updated"));
      }
    } catch (error) {
      console.error("OCR import failed:", error);
      toast.error("Failed to process calendar file.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleOptimisticAddEvent = useCallback((optimisticEvent: AppEvent) => {
    const normalized = normalizeEventsList([optimisticEvent])[0];
    if (!normalized) return;
    setEvents((prev) => {
      const next = normalizeEventsList([...prev.filter((e) => e.id !== normalized.id), normalized]);
      setCache("semester", {
        ...useCacheStore.getState().semester,
        activeSemester,
        events: next,
      });
      return next;
    });
    scrollToAndHighlightEvent(normalized.id);
  }, [activeSemester, setCache, scrollToAndHighlightEvent]);

  const handleEventSaved = useCallback((createdEvents?: any[], tempId?: string) => {
    const createdList = normalizeEventsList(createdEvents || []);
    const realEvt = createdList[0];
    if (realEvt) {
      setEvents((prev) => {
        const filtered = prev.filter((e) => e.id !== tempId && e.id !== realEvt.id);
        const next = normalizeEventsList([...filtered, realEvt]);
        setCache("semester", {
          ...useCacheStore.getState().semester,
          activeSemester,
          events: next,
        });
        return next;
      });
      setHighlightedEventId((curr) => (curr === tempId ? realEvt.id : curr));
      setTimeout(() => {
        const el = eventCardRefs.current.get(realEvt.id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 60);
    } else {
      fetchData();
    }
    fetchCalendar(true);
  }, [activeSemester, setCache]);

  const handleEventRollback = useCallback((tempId: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== tempId));
    setHighlightedEventId((curr) => (curr === tempId ? null : curr));
  }, []);

  const handleSaveEvents = async (selectedEvents: any[], semesterId: string) => {
    try {
      const res = await api.post("/events/save-wizard", {
        semesterId,
        events: selectedEvents
      });
      setIsWizardOpen(false);
      useCacheStore.getState().setCache("calendar", null);
      const savedList = normalizeEventsList(res.data?.events || []);
      if (savedList.length > 0) {
        setEvents((prev) => {
          const savedIds = new Set(savedList.map((s) => s.id));
          const merged = normalizeEventsList([...prev.filter((p) => !savedIds.has(p.id)), ...savedList]);
          setCache("semester", {
            ...useCacheStore.getState().semester,
            activeSemester,
            events: merged,
          });
          return merged;
        });
        scrollToAndHighlightEvent(savedList[0].id);
      } else {
        fetchData();
      }
      fetchCalendar(true);
      useAttendanceStore.getState().fetchStats(true).catch(() => {});
      toast.success("Calendar imported successfully!", {
        action: {
          label: "View Calendar",
          onClick: () => window.location.href = "/calendar?promptSync=true",
        }
      });
    } catch (error) {
      console.error("Failed to save events:", error);
      toast.error("Failed to save events.");
    }
  };

  const handleClearEvents = async () => {
    try {
      setEvents([]);
      await api.post(`/events/clear?target=all&semesterId=${activeSemester?.id || ''}`);
      toast.success("Calendar events cleared");
      useCacheStore.getState().setCache("calendar", null);
      Promise.all([
        fetchData(),
        fetchCalendar(true),
        useAttendanceStore.getState().fetchStats(true),
      ]).catch(() => {});
    } catch (error) {
      console.error("Failed to clear events:", error);
      toast.error("Failed to clear events.");
    }
  };

  const handleDeleteSingleEvent = async (
    event: AppEvent,
    e?: React.MouseEvent<HTMLButtonElement>
  ) => {
    const previousEvents = events;
    hapticMedium();
    playTrashWhooshSound();

    // Measure card position for the burst + parabolic flight into trash bag animation
    let startX = typeof window !== "undefined" ? window.innerWidth / 2 : 200;
    let startY = typeof window !== "undefined" ? window.innerHeight / 2 : 300;
    const cardEl =
      (e?.currentTarget?.closest("[data-event-card]") as HTMLElement | null) ||
      eventCardRefs.current.get(event.id) ||
      e?.currentTarget ||
      null;
    if (cardEl && typeof cardEl.getBoundingClientRect === "function") {
      const rect = cardEl.getBoundingClientRect();
      startX = rect.left + rect.width / 2;
      startY = rect.top + rect.height / 2;
    }

    setCrumblingEventId(event.id);
    setTrashTossAnim({
      key: Date.now(),
      event,
      startX,
      startY,
    });

    setTimeout(() => {
      setEvents((prev) => {
        const next = prev.filter((item) => item.id !== event.id);
        setCache("semester", {
          ...useCacheStore.getState().semester,
          activeSemester,
          events: next,
        });
        return next;
      });
      setCrumblingEventId((curr) => (curr === event.id ? null : curr));
    }, 1200);

    setTimeout(() => {
      setTrashTossAnim((curr) => (curr?.event.id === event.id ? null : curr));
    }, 4650);

    try {
      await api.delete(`/events/${event.id}`);
      useCacheStore.getState().setCache("calendar", null);
      fetchCalendar(true);
      useAttendanceStore.getState().fetchStats(true).catch(() => {});
    } catch (error) {
      console.error("Failed to delete event:", error);
      setEvents(previousEvents);
      toast.error("Failed to delete event.");
    }
  };

  const getEventDotSolidColor = (event: any) => {
    const type = String(event?.eventType || event?.type || "").toLowerCase();
    const titleLower = String(event?.title || "").toLowerCase();

    if (type === "holiday" || titleLower.includes("holiday") || titleLower.includes("jayanti")) {
      if (event?.isHolidayList) return "bg-blue-500";
      return "bg-emerald-500";
    }
    if (type === "restricted_holiday" || (type === "other" && event?.isHolidayList)) return "bg-cyan-400";
    if (type === "endsem" || titleLower.includes("end sem") || titleLower.includes("end-sem")) return "bg-rose-500";
    if (type === "midsem" || titleLower.includes("mid sem") || titleLower.includes("mid-sem") || titleLower.includes("mse")) return "bg-orange-500";
    if (type === "ct" || titleLower.includes("cycle test") || titleLower.includes("quiz")) return "bg-amber-500";
    if (type === "lab_exam" || titleLower.includes("lab") || titleLower.includes("practical")) return "bg-yellow-400";
    if (type === "exam" || titleLower.includes("exam")) return "bg-red-500";
    if (type === "vacation" || titleLower.includes("vacation") || titleLower.includes("break")) return "bg-teal-400";
    if (type === "sports" || titleLower.includes("sports") || titleLower.includes("yalgaar") || titleLower.includes("tournament")) return "bg-lime-500";
    if (type === "fest" || titleLower.includes("fest")) return "bg-fuchsia-500";
    if (type === "institute" || titleLower.includes("institute") || titleLower.includes("commencement")) return "bg-sky-400";
    if (type === "other" || titleLower.includes("birthday")) return "bg-pink-500";
    return "bg-sky-400";
  };

  const getEventColor = (event: any) => {
    const type = String(typeof event === "string" ? event : event?.eventType || event?.type || "").toLowerCase();
    const titleLower = String(typeof event === "object" && event?.title ? event.title : "").toLowerCase();

    if (type === "holiday" || titleLower.includes("holiday") || titleLower.includes("jayanti")) {
      if (event?.isHolidayList) {
        return "bg-blue-500/20 text-blue-400 border-blue-500/30"; // Blue for Holiday List
      }
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"; // Emerald for Academic Calendar
    }
    if (type === "restricted_holiday" || (type === "other" && event?.isHolidayList)) {
      return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"; // Cyan for restricted
    }
    if (type === "endsem" || titleLower.includes("end sem") || titleLower.includes("end-sem")) {
      return "bg-rose-500/20 text-rose-400 border-rose-500/30";
    }
    if (type === "midsem" || titleLower.includes("mid sem") || titleLower.includes("mid-sem") || titleLower.includes("mse")) {
      return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    }
    if (type === "ct" || titleLower.includes("cycle test") || titleLower.includes("quiz")) {
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    }
    if (type === "lab_exam" || titleLower.includes("lab") || titleLower.includes("practical")) {
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    }
    if (type === "exam" || titleLower.includes("exam")) {
      return "bg-red-500/20 text-red-400 border-red-500/30";
    }
    if (type === "vacation" || titleLower.includes("vacation") || titleLower.includes("break")) {
      return "bg-teal-500/20 text-teal-400 border-teal-500/30";
    }
    if (type === "sports" || titleLower.includes("sports") || titleLower.includes("yalgaar") || titleLower.includes("tournament")) {
      return "bg-lime-500/20 text-lime-400 border-lime-500/30";
    }
    if (type === "fest" || titleLower.includes("fest")) {
      return "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30";
    }
    if (type === "institute" || titleLower.includes("institute") || titleLower.includes("commencement")) {
      return "bg-sky-500/20 text-sky-400 border-sky-500/30";
    }
    if (type === "other" || titleLower.includes("birthday")) {
      return "bg-pink-500/20 text-pink-400 border-pink-500/30";
    }
    return "bg-sky-500/20 text-sky-400 border-sky-500/30";
  };

  const getDotColor = (status?: string) => {
    switch (status) {
      case "attended": return "bg-emerald-500";
      case "missed": return "bg-rose-500";
      case "mixed": return "bg-primary";
      case "off": return "bg-yellow-500";
      case "not_marked":
      case "future": return "bg-zinc-500";
      default: return "bg-zinc-500/50";
    }
  };

  // Calendar Grid Generation
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = [];
  let day = startDate;
  while (day <= endDate) {
    calendarDays.push(day);
    day = addDays(day, 1);
  }


  const today = startOfDay(new Date());
  const upcomingEvents = events
    .filter(e => isAfter(parseLocalDate(e.date), today) || isSameDay(parseLocalDate(e.date), today))
    .sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());

  // Semester Progress
  let progress = 0;
  let daysCompleted = 0;
  let daysRemaining = 0;

  if (activeSemester) {
    const now = Date.now();
    const semStartMs = new Date(activeSemester.startDate).getTime();
    const semEndMs = new Date(activeSemester.endDate).getTime();
    const totalMs = semEndMs - semStartMs;

    if (totalMs > 0) {
      const totalDays = Math.ceil(totalMs / (1000 * 60 * 60 * 24));
      if (now < semStartMs) {
        progress = 0;
        daysCompleted = 0;
        daysRemaining = totalDays;
      } else if (now >= semEndMs) {
        progress = 100;
        daysCompleted = totalDays;
        daysRemaining = 0;
      } else {
        const elapsedMs = now - semStartMs;
        progress = Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100)));
        daysCompleted = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
        daysRemaining = Math.max(0, totalDays - daysCompleted);
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <PeakpathRays />
      <ScrollToTopButton />
      <div className="p-4 md:p-8 w-full mx-auto pb-24 md:pb-8 flex flex-col min-h-full space-y-6 overflow-x-hidden">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Semester Overview</h1>
          <p className="text-muted-foreground mt-1">
            {activeSemester ? `Managing ${activeSemester.name}` : "Track events, exams, and holidays."}
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          {events.length > 0 && (
            <div className="flex h-[42px] items-center justify-center shrink-0">
              <TimedUndoAction 
                initialSeconds={5} 
                deleteLabel="Clear Calendar" 
                undoLabel="Cancel"
                onConfirm={handleClearEvents} 
                icon={<Trash2 className="w-4 h-4" />}
              />
            </div>
          )}
          
          <button 
            onClick={() => setIsAddEventOpen(true)}
            disabled={!activeSemester}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-muted hover:bg-accent hover:text-accent-foreground text-foreground border border-border/50 transition-all disabled:opacity-50 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Event
          </button>
          
          <button 
            onClick={() => setIsImportModalOpen(true)}
            disabled={!activeSemester}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-primary text-[#03110E] hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            AI Import
          </button>

          {activeSemester && (
            <button
              onClick={() => setIsTransitionModalOpen(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/30 transition-all cursor-pointer"
              title="Transition to next semester"
            >
              <GraduationCap className="w-4 h-4" />
              <span>Next Semester</span>
            </button>
          )}
        </div>
        
        <CalendarImportModal 
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={fetchData}
        />
      </div>

      {activeSemester && (() => {
        const end = new Date(activeSemester.endDate);
        end.setHours(23, 59, 59, 999);
        return new Date() > end;
      })() && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">
                {activeSemester.name} Complete!
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ready for your next semester? Tap to reset app data & pre-load official calendar.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsTransitionModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold transition-all hover:bg-primary/90 shadow-sm shrink-0 cursor-pointer"
          >
            Transition Now
          </button>
        </div>
      )}

      {activeSemester || hasGlobalActiveSemester || events.length > 0 || isFetchingSemester ? (
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col md:flex-row md:items-center gap-6 shadow-xl">
          <div className="flex-1">
            <div className="flex justify-between items-end mb-2">
              <span className="text-sm font-medium text-foreground">Semester Progress</span>
              <span className="text-2xl font-bold text-primary">{progress}%</span>
            </div>
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground font-medium">
              <span>{daysCompleted} days completed</span>
              <span>{daysRemaining} days remaining</span>
            </div>
          </div>
          <div className="hidden md:block w-px h-16 bg-border" />
          <div className="flex-1">
            <span className="text-sm font-medium text-foreground mb-2 block">Next Milestone</span>
            {upcomingEvents.length > 0 ? (
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-bold text-foreground leading-tight">{upcomingEvents[0].title}</h4>
                  <p className="text-sm text-primary font-medium mt-0.5">
                    {differenceInDays(parseLocalDate(upcomingEvents[0].date), today)} days left
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${getEventColor(upcomingEvents[0].eventType)}`}>
                  <Timer className="w-6 h-6" />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming milestones.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-primary/10 border border-primary/30 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-foreground">No Active Semester</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Set up your semester start and end dates to activate academic tracking and calendar view.
            </p>
          </div>
          <button
            onClick={() => setIsCreateSemesterOpen(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-primary/30 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Semester</span>
          </button>
        </div>
      )}

      {/* Tabs */}
      <DiscreteTabs
        defaultTab={activeTab}
        onTabChange={(id) => {
          setActiveTab(id as any);
          if (routeTab || searchParams.get("tab")) {
            navigate("/semester", { replace: true });
          }
        }}
        tabs={[
          { id: 'timeline', icon: <AlignLeft size={20} />, label: 'Timeline', activeColor: 'text-blue-500' },
          { id: 'calendar', icon: <CalendarDays size={20} />, label: 'Calendar', activeColor: 'text-primary' },
          { id: 'countdowns', icon: <Timer size={20} />, label: 'Countdowns', activeColor: 'text-amber-500' },
          { id: 'events', icon: <ListFilter size={20} />, label: 'Events', activeColor: 'text-rose-500' },
          { id: 'holidays', icon: <Palmtree size={20} />, label: 'Holidays', activeColor: 'text-emerald-500' }
        ]}
      />

      {/* Tab Content */}
      <div className="flex-1 bg-card border border-border rounded-3xl p-6 min-h-[500px]">
        
        {activeTab === "calendar" && (
          <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">{format(currentDate, "MMMM yyyy")}</h2>
              <div className="flex gap-2">
                <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 hover:bg-muted rounded-lg text-sm font-medium text-foreground">
                  Today
                </button>
                <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-px mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2 uppercase tracking-wider">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-8">
              {calendarDays.map((day, i) => {
                const dayEvents = events.filter(e => {
                  const s = startOfDay(parseLocalDate(e.date));
                  const ed = e.endDate ? startOfDay(parseLocalDate(e.endDate)) : s;
                  return day >= s && day <= ed;
                });
                
                const dateKey = format(day, "yyyy-MM-dd");
                const status = calendarData?.days?.[dateKey];
                const isCurrentMonth = isSameMonth(day, monthStart);

                return (
                  <Link 
                    key={i} 
                    to={isCurrentMonth ? `/today?date=${dateKey}` : "#"} 
                    className={`min-h-[70px] sm:min-h-[80px] p-1 sm:p-2 rounded-lg sm:rounded-xl border ${
                      !isCurrentMonth ? "opacity-30 border-transparent cursor-default pointer-events-none" : 
                      isSameDay(day, new Date()) ? "border-primary/50 bg-primary/5 cursor-pointer" : "border-border/50 hover:border-border bg-card cursor-pointer"
                    } transition-colors flex flex-col`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-sm font-medium ${isSameDay(day, new Date()) ? "text-primary bg-primary/10 w-6 h-6 rounded-full flex items-center justify-center -ml-1 -mt-1" : "text-foreground/80"}`}>
                        {format(day, "d")}
                      </span>
                      <div className="flex items-center gap-1 mt-1">
                        {isCurrentMonth && dayEvents.slice(0, 2).map(e => (
                          <div key={`dot-${e.id}`} className={`w-2 h-2 rounded-full ${getEventDotSolidColor(e)}`} title={e.title} />
                        ))}
                        {isCurrentMonth && status && (
                          <div className={`w-2 h-2 rounded-full ${getDotColor(status)}`} title={String(status).replace("_", " ")} />
                        )}
                      </div>
                    </div>
                    <div className="space-y-1 mt-auto hidden sm:block">
                      {dayEvents.slice(0, 2).map(e => (
                        <div key={e.id} className={`text-[10px] px-1.5 py-0.5 rounded truncate border ${getEventColor(e)}`} title={e.title}>
                          {e.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && <div className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 2} more</div>}
                    </div>
                    {/* Mobile event dots */}
                    {dayEvents.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-auto sm:hidden pb-0.5 justify-center w-full">
                        {dayEvents.slice(0, 3).map(e => (
                          <div key={e.id} className={`w-1.5 h-1.5 rounded-full ${getEventDotSolidColor(e)}`} />
                        ))}
                        {dayEvents.length > 3 && (
                           <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                        )}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Calendar Stats */}
            {calendarData?.stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-auto">
                <div className="bg-card rounded-2xl overflow-hidden border border-border shadow-xs">
                  <div className="grid grid-cols-5 p-4 text-center divide-x divide-border">
                    <div>
                      <div className="text-lg font-bold text-foreground mb-0.5">{calendarData.stats.days.not_marked}</div>
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider hidden sm:inline">None</span>
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider sm:hidden">No</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-foreground mb-0.5">{calendarData.stats.days.off}</div>
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Off</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-foreground mb-0.5">{calendarData.stats.days.missed}</div>
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Missed</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-foreground mb-0.5">{calendarData.stats.days.attended}</div>
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Attended</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-foreground mb-0.5">{calendarData.stats.days.mixed}</div>
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Mixed</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-muted/40 text-center py-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest border-t border-border">
                    Days Summary
                  </div>
                </div>

                <div className="bg-card rounded-2xl overflow-hidden border border-border shadow-xs">
                  <div className="grid grid-cols-5 p-4 text-center divide-x divide-border">
                    <div>
                      <div className="text-lg font-bold text-foreground mb-0.5">{calendarData.stats.lectures.off}</div>
                      <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Off</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-foreground mb-0.5">{calendarData.stats.lectures.missed}</div>
                      <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Missed</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-foreground mb-0.5">{calendarData.stats.lectures.attended}</div>
                      <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Attended</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-foreground mb-0.5">{calendarData.stats.lectures.total}</div>
                      <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-foreground mb-0.5">{(calendarData?.stats?.lectures?.percentage ?? 0).toFixed(0)}%</div>
                      <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Percent</div>
                    </div>
                  </div>
                  <div className="bg-black/[0.03] dark:bg-white/[0.03] text-center py-2 text-xs font-semibold text-foreground/50 uppercase tracking-widest border-t border-border/50">
                    Lectures Summary
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

          {activeTab === "timeline" && (
            <div className="max-w-2xl mx-auto py-8">
              <h2 className="text-xl font-bold text-foreground mb-8">Semester Journey</h2>
              <div className="space-y-0 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-border">
                {events.map((event) => {
                  const isPast = isAfter(today, parseLocalDate(event.endDate || event.date));
                  const isCurrent = isSameDay(today, parseLocalDate(event.date)) || (event.endDate && today >= parseLocalDate(event.date) && today <= parseLocalDate(event.endDate));
                  const isHighlighted = highlightedEventId === event.id;
                  const isCrumbling = crumblingEventId === event.id;
                  
                  return (
                    <motion.div 
                      key={event.id} 
                      ref={(el) => {
                        setEventCardRef(event.id, el);
                        if (event.id === nextEventId) {
                          timelineNextEventRef.current = el;
                        }
                      }}
                      data-event-card
                      animate={
                        isCrumbling
                          ? {
                              scale: [1, 1.05, 0.94, 1.03, 0.62, 0.18],
                              rotate: [0, -3, 4, -7, 14, -24],
                              opacity: [1, 1, 1, 0.95, 0.75, 0],
                              filter: ["blur(0px)", "blur(0px)", "blur(0px)", "blur(1px)", "blur(2px)", "blur(4px)"],
                            }
                          : isHighlighted
                          ? { scale: [0.96, 1.02, 1], y: [8, -2, 0] }
                          : { scale: 1, rotate: 0, opacity: 1, y: 0, filter: "blur(0px)" }
                      }
                      transition={{ duration: isCrumbling ? 1.18 : 0.38, ease: "easeInOut" }}
                      className="relative flex items-center mb-8 group"
                    >
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-background z-10 shrink-0 transition-transform duration-300 ${
                        isCrumbling ? 'bg-rose-500 scale-110 shadow-[0_0_24px_rgba(244,63,94,0.85)]' :
                        isHighlighted ? 'bg-primary scale-115 shadow-[0_0_20px_rgba(163,230,53,0.75)]' :
                        isCurrent ? 'bg-primary shadow-[0_0_15px_rgba(var(--primary),0.5)]' : 
                        isPast ? 'bg-emerald-500' : 'bg-muted'
                      }`}>
                        {isPast && !isHighlighted ? <CheckCircle2 className="w-5 h-5 text-foreground" /> : <div className={`w-3 h-3 rounded-full ${isCurrent || isHighlighted ? 'bg-white' : getEventDotSolidColor(event)}`} />}
                      </div>
                      
                      <div className={`ml-6 p-5 rounded-2xl border flex-1 transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isCrumbling
                          ? 'bg-rose-500/20 border-rose-500 ring-2 ring-rose-500/70 shadow-[0_0_35px_rgba(244,63,94,0.45)]'
                          : isHighlighted
                          ? 'bg-primary/15 border-primary ring-2 ring-primary/60 shadow-[0_0_30px_rgba(163,230,53,0.28)]'
                          : isCurrent
                          ? 'bg-primary/5 border-primary/30'
                          : 'bg-card border-border group-hover:border-primary/30'
                      }`}>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                            <span>
                              {event.endDate && event.endDate !== event.date 
                                ? `${format(parseLocalDate(event.date), "MMM d, yyyy")} - ${format(parseLocalDate(event.endDate), "MMM d, yyyy")}`
                                : format(parseLocalDate(event.date), "MMM d, yyyy")}
                            </span>
                            {isHighlighted && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest bg-primary text-[#03110E] animate-pulse">
                                JUST ADDED
                              </span>
                            )}
                          </div>
                          <h3 className={`text-lg font-bold ${isCurrent || isHighlighted ? 'text-primary' : 'text-foreground'}`}>{event.title}</h3>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getEventColor(event)}`}>
                            {String(event.eventType || (event as any).type || "other").replace(/_/g, " ")}
                          </span>
                          <button
                            onClick={(e) => handleDeleteSingleEvent(event, e)}
                            className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Delete event"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

        {activeTab === "countdowns" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingEvents.map(event => {
              const daysLeft = differenceInDays(parseLocalDate(event.date), today);
              return (
                <div key={event.id} className="bg-card border border-border/60 hover:border-border transition-colors rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                  <div className={`w-16 h-16 shrink-0 rounded-full flex flex-col items-center justify-center border-2 ${getEventColor(event)}`}>
                    <span className="text-2xl font-black leading-none">{daysLeft}</span>
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-sm sm:text-base font-bold text-foreground leading-tight line-clamp-2">{event.title}</h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <p className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                        <CalendarIcon className="w-3.5 h-3.5" />
                        {format(parseLocalDate(event.date), "MMM d")}
                      </p>
                      <span className="w-1 h-1 rounded-full bg-border" />
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        {daysLeft === 0 ? "Today" : daysLeft === 1 ? "Tomorrow" : `${daysLeft} Days`}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "events" && (
          <div className="space-y-4">
            {events.map(event => {
              const isHighlighted = highlightedEventId === event.id;
              const isCrumbling = crumblingEventId === event.id;
              return (
                <motion.div
                  key={event.id}
                  ref={(el) => setEventCardRef(event.id, el)}
                  data-event-card
                  animate={
                    isCrumbling
                      ? {
                          scale: [1, 1.04, 0.94, 1.03, 0.62, 0.18],
                          rotate: [0, -3, 4, -7, 14, -22],
                          opacity: [1, 1, 1, 0.95, 0.75, 0],
                          filter: ["blur(0px)", "blur(0px)", "blur(0px)", "blur(1px)", "blur(2px)", "blur(4px)"],
                        }
                      : isHighlighted
                      ? { scale: [0.96, 1.02, 1], y: [8, -2, 0] }
                      : { scale: 1, rotate: 0, opacity: 1, y: 0, filter: "blur(0px)" }
                  }
                  transition={{ duration: isCrumbling ? 1.18 : 0.38, ease: "easeInOut" }}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 border rounded-2xl gap-3 transition-all duration-300 ${
                    isCrumbling
                      ? "bg-rose-500/20 border-rose-500 ring-2 ring-rose-500/70 shadow-[0_0_35px_rgba(244,63,94,0.45)]"
                      : isHighlighted
                      ? "bg-primary/15 border-primary ring-2 ring-primary/60 shadow-[0_0_30px_rgba(163,230,53,0.28)]"
                      : "bg-card border-border/60 shadow-sm hover:border-border"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-bold text-base ${isHighlighted ? "text-primary" : "text-foreground"}`}>{event.title}</h4>
                      {isHighlighted && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest bg-primary text-[#03110E] animate-pulse">
                          JUST ADDED
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      {event.endDate && event.endDate !== event.date 
                        ? `${format(parseLocalDate(event.date), "MMMM d, yyyy")} - ${format(parseLocalDate(event.endDate), "MMMM d, yyyy")}`
                        : format(parseLocalDate(event.date), "MMMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getEventColor(event)}`}>
                      {String(event.eventType || (event as any).type || "other").replace(/_/g, " ")}
                    </span>
                    <button
                      onClick={(e) => handleDeleteSingleEvent(event, e)}
                      className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Delete event"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {activeTab === "holidays" as any && (
          <div className="py-2">
            <HolidayListTab 
              semesterId={activeSemester?.id} 
              semesterStartDate={activeSemester?.startDate}
              semesterEndDate={activeSemester?.endDate}
            />
          </div>
        )}

      </div>

      {/* 4.6-Second Burst + Parabolic Whoosh Into Trash Bag Deletion Stage */}
      <AnimatePresence>
        {trashTossAnim && (() => {
          const targetX = typeof window !== "undefined" ? window.innerWidth / 2 : 200;
          const targetY = typeof window !== "undefined" ? window.innerHeight - 135 : 620;
          const startX = trashTossAnim.startX;
          const startY = trashTossAnim.startY;
          const midX = (startX + targetX) / 2;
          const peakY = Math.max(70, Math.min(startY, targetY) - 190);

          const burstParticles = Array.from({ length: 18 }, (_, idx) => {
            const angle = (idx / 18) * Math.PI * 2;
            const dist = 68 + (idx % 3) * 34;
            return {
              id: idx,
              dx: Math.cos(angle) * dist,
              dy: Math.sin(angle) * dist,
              color: idx % 3 === 0 ? "#f43f5e" : idx % 3 === 1 ? "#a3e635" : "#fb923c",
            };
          });

          const arcTrailSteps = [0, 1, 2, 3, 4, 5];

          const rimSparks = Array.from({ length: 14 }, (_, idx) => {
            const angle = -Math.PI * 0.1 - (idx / 13) * Math.PI * 0.8;
            const dist = 54 + (idx % 3) * 24;
            return {
              id: idx,
              dx: Math.cos(angle) * dist,
              dy: Math.sin(angle) * dist - 22,
              color: idx % 2 === 0 ? "#fb7185" : "#fbbf24",
            };
          });

          return (
            <div
              key={trashTossAnim.key}
              className="fixed inset-0 z-[130] pointer-events-none overflow-hidden"
            >
              {/* 1. Origin Radial Burst Shards (0.30s -> 1.45s as card crumples) */}
              {burstParticles.map((p) => (
                <motion.div
                  key={`burst-${p.id}`}
                  initial={{ x: startX, y: startY, scale: 0, opacity: 0 }}
                  animate={{
                    x: [startX, startX + p.dx * 0.65, startX + p.dx],
                    y: [startY, startY + p.dy * 0.65, startY + p.dy + 18],
                    scale: [0, 1.45, 0],
                    opacity: [0, 1, 0],
                    rotate: [0, 140, 300],
                  }}
                  transition={{ delay: 0.3, duration: 1.15, ease: "easeOut" }}
                  style={{ backgroundColor: p.color }}
                  className="fixed top-0 left-0 w-3 h-3 rounded-sm shadow-[0_0_14px_currentColor]"
                />
              ))}

              {/* 2. Glowing Parabolic Arc Trail Sparks (1.05s -> 3.10s) */}
              {arcTrailSteps.map((stepIdx) => (
                <motion.div
                  key={`trail-${stepIdx}`}
                  initial={{ x: startX, y: startY, scale: 0, opacity: 0 }}
                  animate={{
                    x: [
                      startX,
                      startX * 0.7 + targetX * 0.3,
                      midX,
                      startX * 0.25 + targetX * 0.75,
                      targetX,
                    ],
                    y: [
                      startY,
                      peakY + 35,
                      peakY - 25,
                      peakY + 55,
                      targetY - 12,
                    ],
                    scale: [0, 1.1, 1.25, 0.9, 0],
                    opacity: [0, 0.75, 0.85, 0.6, 0],
                  }}
                  transition={{
                    delay: 1.05 + (stepIdx + 1) * 0.09,
                    duration: 1.95,
                    times: [0, 0.26, 0.52, 0.78, 1],
                    ease: "easeInOut",
                  }}
                  className="fixed top-0 left-0 w-3.5 h-3.5 rounded-full bg-gradient-to-r from-rose-400 to-amber-300 blur-[1px] shadow-[0_0_16px_rgba(244,63,94,0.85)]"
                />
              ))}

              {/* 3. Crumpled Event Card Projectile Flying in 2.05s Parabolic Whoosh Arc (1.05s -> 3.10s) */}
              <motion.div
                initial={{ x: startX - 96, y: startY - 26, scale: 0, rotate: 0, opacity: 0 }}
                animate={{
                  x: [
                    startX - 96,
                    startX - 96,
                    startX * 0.7 + targetX * 0.3 - 86,
                    midX - 78,
                    startX * 0.25 + targetX * 0.75 - 64,
                    targetX - 36,
                  ],
                  y: [
                    startY - 26,
                    startY - 34,
                    peakY + 25,
                    peakY - 35,
                    peakY + 45,
                    targetY - 16,
                  ],
                  scale: [0, 1.08, 0.98, 0.88, 0.62, 0.16],
                  rotate: [0, -14, 45, 220, 460, 720],
                  opacity: [0, 1, 1, 1, 1, 0],
                }}
                transition={{
                  delay: 0.92,
                  duration: 2.18,
                  times: [0, 0.12, 0.36, 0.6, 0.84, 1],
                  ease: "easeInOut",
                }}
                className="fixed top-0 left-0 w-48 px-4 py-2.5 rounded-2xl bg-gradient-to-br from-rose-500 via-red-500 to-orange-500 border-2 border-white/60 text-white shadow-[0_18px_42px_rgba(244,63,94,0.7)] backdrop-blur-md flex items-center gap-2.5"
              >
                <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/80">
                    Crumpling & Tossing
                  </div>
                  <div className="text-xs font-black truncate">{trashTossAnim.event.title}</div>
                </div>
              </motion.div>

              {/* 4. Trash Bag / Bin Catcher at Bottom Center (0.0s -> 4.60s total 4.6s stage) */}
              <motion.div
                initial={{ x: targetX - 64, y: targetY + 120, scale: 0.3, opacity: 0 }}
                animate={{
                  x: targetX - 64,
                  y: [
                    targetY + 120,
                    targetY - 46,
                    targetY - 52,
                    targetY - 46,
                    targetY - 26,
                    targetY - 54,
                    targetY - 46,
                    targetY + 130,
                  ],
                  scaleX: [0.5, 1.04, 1.12, 1.08, 1.38, 0.88, 1.02, 0.4],
                  scaleY: [0.5, 1.0, 0.94, 0.98, 0.7, 1.2, 1.0, 0.4],
                  rotate: [0, 0, -4, 4, 0, -3, 0, 0],
                  opacity: [0, 1, 1, 1, 1, 1, 1, 0],
                }}
                transition={{
                  duration: 4.6,
                  times: [0, 0.12, 0.36, 0.62, 0.68, 0.76, 0.91, 1],
                  ease: "easeInOut",
                }}
                className="fixed top-0 left-0 w-32 flex flex-col items-center"
              >
                {/* Bag Gulp Rim Fireworks when projectile lands at t=3.10s */}
                {rimSparks.map((s) => (
                  <motion.div
                    key={`rim-${s.id}`}
                    initial={{ x: 0, y: 10, scale: 0, opacity: 0 }}
                    animate={{
                      x: [0, s.dx * 0.7, s.dx],
                      y: [10, s.dy * 0.8, s.dy + 16],
                      scale: [0, 1.4, 0],
                      opacity: [0, 1, 0],
                    }}
                    transition={{ delay: 3.06, duration: 0.95, ease: "easeOut" }}
                    style={{ backgroundColor: s.color }}
                    className="absolute top-0 w-2.5 h-2.5 rounded-full shadow-[0_0_12px_currentColor]"
                  />
                ))}

                {/* Stylized Animated Trash Bag */}
                <div className="relative w-20 h-20 rounded-[28px] bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 border-2 border-rose-500/75 shadow-[0_18px_45px_rgba(244,63,94,0.55)] flex flex-col items-center justify-center">
                  {/* Glowing Mouth Rim */}
                  <div className="-mt-3 w-14 h-3.5 rounded-t-full bg-gradient-to-r from-rose-500 via-orange-400 to-rose-500 border border-white/35 shadow-[0_0_16px_rgba(244,63,94,0.8)]" />
                  {/* Golden Drawstring Tie */}
                  <div className="w-10 h-1.5 bg-amber-400 rounded-full my-1 shadow-[0_0_10px_rgba(251,191,36,0.8)]" />
                  <Trash2 className="w-8 h-8 text-rose-400 mt-0.5" />
                </div>

                {/* Status Pill Under Bag (Waiting -> Tossed!) */}
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: [0, 1, 1, 0], y: [6, 0, 0, -4] }}
                  transition={{ duration: 4.5, times: [0, 0.1, 0.92, 1] }}
                  className="mt-2 px-3.5 py-1 rounded-full bg-gradient-to-r from-rose-600 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider shadow-[0_8px_20px_rgba(244,63,94,0.5)] border border-white/25 whitespace-nowrap"
                >
                  🗑️ Tossing "{trashTossAnim.event.title.slice(0, 18)}{trashTossAnim.event.title.length > 18 ? "…" : ""}"
                </motion.div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      <AddEventModal 
        isOpen={isAddEventOpen}
        onClose={() => setIsAddEventOpen(false)}
        semesterId={activeSemester?.id}
        onOptimisticAdd={handleOptimisticAddEvent}
        onSaved={handleEventSaved}
        onErrorRollback={handleEventRollback}
      />

      <EventWizardModal 
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onSave={handleSaveEvents}
        eventsPayload={wizardPayload}
      />

      <CreateSemesterModal
        isOpen={isCreateSemesterOpen}
        onClose={() => setIsCreateSemesterOpen(false)}
        onSuccess={fetchData}
      />

      <SemesterTransitionModal
        isOpen={isTransitionModalOpen}
        onClose={() => setIsTransitionModalOpen(false)}
        onSuccess={fetchData}
      />
    </div>
    </>
  );
};






