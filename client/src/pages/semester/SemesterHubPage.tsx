import React, { useState, useEffect, useRef, useCallback } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, isAfter, startOfDay, differenceInDays } from "date-fns";
import { ChevronLeft, ChevronRight, Upload, Calendar as CalendarIcon, Loader2, Sparkles, AlertTriangle, ListFilter, AlignLeft, CalendarDays, Timer, CheckCircle2, Plus, Trash2, Palmtree, GraduationCap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../lib/api";
import { hapticMedium, hapticHeavy } from "../../utils/haptics";
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
import { SoundFX } from "../../utils/soundEffects";
import { triggerDynamicHUD } from "../../components/ui/dynamic-island-hud";
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
  SoundFX.playTrashGulpSound();
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
  const [isClearingDomino, setIsClearingDomino] = useState(false);

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
        useAttendanceStore.setState({ activeSemesterId: null, hasActiveSemester: false, events: [] });
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
        useAttendanceStore.setState({ activeSemesterId: null, hasActiveSemester: false, events: [] });
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
    window.addEventListener("semester-updated", handleUpdate);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener("attendance-updated", handleUpdate);
      window.removeEventListener("events-updated", handleUpdate);
      window.removeEventListener("semester-updated", handleUpdate);
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
      useAttendanceStore.setState({ events: next as any });
      return next;
    });
    window.dispatchEvent(new CustomEvent("events-updated"));
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
        useAttendanceStore.setState({ events: next as any });
        return next;
      });
      window.dispatchEvent(new CustomEvent("events-updated"));
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
      SoundFX.playSnapPopSound();
      triggerDynamicHUD({
        type: "sparkle",
        label: "Calendar Events Imported",
        subtitle: `${selectedEvents.length} events added`,
      });
    } catch (error) {
      console.error("Failed to save events:", error);
      toast.error("Failed to save events.");
    }
  };

  const handleClearEvents = async () => {
    if (events.length === 0) return;
    try {
      // 1. Switch to timeline tab if not already on timeline or events so cards are mounted
      if (activeTab !== "timeline" && activeTab !== "events") {
        setActiveTab("timeline");
      }

      setIsClearingDomino(true);
      hapticHeavy();
      SoundFX.playDominoCascadeSound();
      triggerDynamicHUD({
        type: "trash",
        label: "Cascading Calendar Disintegration...",
        durationMs: 4800,
      });

      // 2. Smoothly scroll to the optimal height so the user gets a full screen of domino cards
      const triggerOptimalScroll = () => {
        const container =
          document.getElementById("semester-journey-cards") ||
          document.getElementById("semester-timeline-container") ||
          document.getElementById("semester-events-list-container") ||
          document.querySelector("[data-event-card]");

        if (container) {
          container.scrollIntoView({ behavior: "smooth", block: "start" });
          const rect = container.getBoundingClientRect();
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
          const targetY = Math.max(0, rect.top + scrollTop - 72);
          window.scrollTo({ top: targetY, behavior: "smooth" });
        }
      };

      setTimeout(triggerOptimalScroll, activeTab !== "timeline" && activeTab !== "events" ? 50 : 20);

      // 3. Dynamic camera tracking down the cascade wave for long event lists
      if (events.length > 5) {
        setTimeout(() => {
          const cards = document.querySelectorAll("[data-event-card]");
          const midCard = cards[Math.min(cards.length - 1, 6)];
          if (midCard) {
            midCard.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 1200);
      }

      if (events.length > 10) {
        setTimeout(() => {
          const cards = document.querySelectorAll("[data-event-card]");
          const endCard = cards[cards.length - 1];
          if (endCard) {
            endCard.scrollIntoView({ behavior: "smooth", block: "end" });
          }
        }, 2200);
      }

      // Run 4.5s Domino Cascade Wave across all timeline & event cards
      setTimeout(async () => {
        try {
          await api.post(`/events/clear?target=all&semesterId=${activeSemester?.id || ''}`);
          setEvents([]);
          setIsClearingDomino(false);
          useCacheStore.getState().setCache("calendar", null);
          Promise.all([
            fetchData(),
            fetchCalendar(true),
            useAttendanceStore.getState().fetchStats(true),
          ]).catch(() => {});
          triggerDynamicHUD({ type: "trash", label: "Calendar Events Cleared" });
        } catch (error) {
          console.error("Failed to clear events:", error);
          toast.error("Failed to clear events.");
          setIsClearingDomino(false);
          fetchData();
        }
      }, 4500);
    } catch (error) {
      console.error("Failed to initiate clear events:", error);
      toast.error("Failed to clear events.");
      setIsClearingDomino(false);
    }
  };

  const handleDeleteSingleEvent = async (
    event: AppEvent,
    e?: React.MouseEvent<HTMLButtonElement>
  ) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const previousEvents = events;
    SoundFX.warmUp();
    hapticMedium();
    SoundFX.playTrashGulpSound();

    // Measure card position for the smooth parabolic flight into large trash can
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

    // Remove from background list at 4.0s right as the trash can descends so the UI reflows gracefully
    setTimeout(() => {
      setEvents((prev) => {
        const next = prev.filter((item) => item.id !== event.id);
        setCache("semester", {
          ...useCacheStore.getState().semester,
          activeSemester,
          events: next,
        });
        useAttendanceStore.setState({ events: next as any });
        return next;
      });
      window.dispatchEvent(new CustomEvent("events-updated"));
      setCrumblingEventId((curr) => (curr === event.id ? null : curr));
    }, 4000);

    // Dynamic HUD triggers right when card plunges into the trash can mouth (2.40s)
    setTimeout(() => {
      triggerDynamicHUD({
        title: "Event Discarded",
        subtitle: event.title,
        type: "trash",
        durationMs: 4500,
      });
    }, 2400);

    // Complete 4.5-second cinematic animation cycle
    setTimeout(() => {
      setTrashTossAnim((curr) => (curr?.event.id === event.id ? null : curr));
    }, 4500);

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
      <style>{`
        @keyframes calendarCascadeFall {
          0% { transform: perspective(800px) rotateX(0deg) translateY(0) scale(1); opacity: 1; }
          40% { transform: perspective(800px) rotateX(45deg) translateY(18px) scale(0.95); opacity: 0.85; filter: blur(0.5px); }
          70% { transform: perspective(800px) rotateX(75deg) translateY(38px) scale(0.85); opacity: 0.5; filter: blur(2px); }
          100% { transform: perspective(800px) rotateX(90deg) translateY(65px) scale(0.6); opacity: 0; filter: blur(4px); visibility: hidden; }
        }
      `}</style>
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
                  <div className="grid grid-cols-5 p-2.5 sm:p-4 text-center divide-x divide-border">
                    <div className="px-0.5 sm:px-1">
                      <div className="text-base sm:text-lg font-bold text-foreground mb-0.5">{calendarData.stats.days.not_marked}</div>
                      <div className="flex items-center justify-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 shrink-0" />
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium uppercase tracking-normal sm:tracking-wider hidden sm:inline truncate">None</span>
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium uppercase tracking-normal sm:tracking-wider sm:hidden truncate">No</span>
                      </div>
                    </div>
                    <div className="px-0.5 sm:px-1">
                      <div className="text-base sm:text-lg font-bold text-foreground mb-0.5">{calendarData.stats.days.off}</div>
                      <div className="flex items-center justify-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0" />
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium uppercase tracking-normal sm:tracking-wider truncate">Off</span>
                      </div>
                    </div>
                    <div className="px-0.5 sm:px-1">
                      <div className="text-base sm:text-lg font-bold text-foreground mb-0.5">{calendarData.stats.days.missed}</div>
                      <div className="flex items-center justify-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium uppercase tracking-normal sm:tracking-wider truncate">Missed</span>
                      </div>
                    </div>
                    <div className="px-0.5 sm:px-1">
                      <div className="text-base sm:text-lg font-bold text-foreground mb-0.5">{calendarData.stats.days.attended}</div>
                      <div className="flex items-center justify-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium uppercase tracking-normal sm:tracking-wider truncate">Attended</span>
                      </div>
                    </div>
                    <div className="px-0.5 sm:px-1">
                      <div className="text-base sm:text-lg font-bold text-foreground mb-0.5">{calendarData.stats.days.mixed}</div>
                      <div className="flex items-center justify-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium uppercase tracking-normal sm:tracking-wider truncate">Mixed</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-muted/40 text-center py-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest border-t border-border">
                    Days Summary
                  </div>
                </div>

                <div className="bg-card rounded-2xl overflow-hidden border border-border shadow-xs">
                  <div className="grid grid-cols-5 p-2.5 sm:p-4 text-center divide-x divide-border">
                    <div className="px-0.5 sm:px-1">
                      <div className="text-base sm:text-lg font-bold text-foreground mb-0.5">{calendarData.stats.lectures.off}</div>
                      <div className="text-[9px] sm:text-[10px] text-muted-foreground font-medium uppercase tracking-normal sm:tracking-wider truncate">Off</div>
                    </div>
                    <div className="px-0.5 sm:px-1">
                      <div className="text-base sm:text-lg font-bold text-foreground mb-0.5">{calendarData.stats.lectures.missed}</div>
                      <div className="text-[9px] sm:text-[10px] text-muted-foreground font-medium uppercase tracking-normal sm:tracking-wider truncate">Missed</div>
                    </div>
                    <div className="px-0.5 sm:px-1">
                      <div className="text-base sm:text-lg font-bold text-foreground mb-0.5">{calendarData.stats.lectures.attended}</div>
                      <div className="text-[9px] sm:text-[10px] text-muted-foreground font-medium uppercase tracking-normal sm:tracking-wider truncate">Attended</div>
                    </div>
                    <div className="px-0.5 sm:px-1">
                      <div className="text-base sm:text-lg font-bold text-foreground mb-0.5">{calendarData.stats.lectures.total}</div>
                      <div className="text-[9px] sm:text-[10px] text-muted-foreground font-medium uppercase tracking-normal sm:tracking-wider truncate">Total</div>
                    </div>
                    <div className="px-0.5 sm:px-1">
                      <div className="text-base sm:text-lg font-bold text-foreground mb-0.5">{(calendarData?.stats?.lectures?.percentage ?? 0).toFixed(0)}%</div>
                      <div className="text-[9px] sm:text-[10px] text-muted-foreground font-medium uppercase tracking-normal sm:tracking-wider truncate">Percent</div>
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
            <div id="semester-timeline-container" className="max-w-2xl mx-auto py-8 scroll-mt-20">
              <h2 className="text-xl font-bold text-foreground mb-8">Semester Journey</h2>
              <div id="semester-journey-cards" className="space-y-0 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-border scroll-mt-20">
                {events.map((event, idx) => {
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
                      style={isClearingDomino ? {
                        transformOrigin: "top center",
                        animation: `calendarCascadeFall 1.15s cubic-bezier(0.25, 1, 0.5, 1) ${0.35 + Math.min(idx * 0.08, 2.5)}s forwards`,
                        pointerEvents: "none",
                      } : undefined}
                      animate={
                        isCrumbling
                          ? {
                              scale: [1, 0.96, 0.90, 0.75, 0],
                              opacity: [1, 0.85, 0.60, 0.25, 0],
                              filter: ["blur(0px)", "blur(0.5px)", "blur(1px)", "blur(2px)", "blur(4px)"],
                            }
                          : isHighlighted
                          ? { scale: [0.96, 1.02, 1], y: [8, -2, 0] }
                          : { scale: 1, rotate: 0, opacity: 1, y: 0, filter: "blur(0px)" }
                      }
                      transition={{ duration: isCrumbling ? 2.40 : 0.38, ease: [0.22, 1, 0.36, 1] }}
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
          <div id="semester-events-list-container" className="space-y-4 scroll-mt-20">
            {events.map((event, idx) => {
              const isHighlighted = highlightedEventId === event.id;
              const isCrumbling = crumblingEventId === event.id;
              return (
                <motion.div
                  key={event.id}
                  ref={(el) => setEventCardRef(event.id, el)}
                  data-event-card
                  style={isClearingDomino ? {
                    transformOrigin: "top center",
                    animation: `calendarCascadeFall 1.15s cubic-bezier(0.25, 1, 0.5, 1) ${0.35 + Math.min(idx * 0.08, 2.5)}s forwards`,
                    pointerEvents: "none",
                  } : undefined}
                  animate={
                    isCrumbling
                      ? {
                          scale: [1, 0.96, 0.90, 0.75, 0],
                          opacity: [1, 0.85, 0.60, 0.25, 0],
                          filter: ["blur(0px)", "blur(0.5px)", "blur(1px)", "blur(2px)", "blur(4px)"],
                        }
                      : isHighlighted
                      ? { scale: [0.96, 1.02, 1], y: [8, -2, 0] }
                      : { scale: 1, rotate: 0, opacity: 1, y: 0, filter: "blur(0px)" }
                  }
                  transition={{ duration: isCrumbling ? 2.40 : 0.38, ease: [0.22, 1, 0.36, 1] }}
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

      {/* Snappy 1.5-Second Burst + Parabolic Whoosh Into Trash Bag Deletion Stage */}
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

          const arcTrailSteps = [0, 1, 2, 3];

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
              {/* 1. Origin Radial Burst Shards (0.0s -> 0.85s instant burst on tap) */}
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
                  transition={{ delay: 0, duration: 0.85, ease: "easeOut" }}
                  style={{ backgroundColor: p.color }}
                  className="fixed top-0 left-0 w-3 h-3 rounded-sm shadow-[0_0_14px_currentColor]"
                />
              ))}

              {/* 2. Glowing Parabolic Arc Trail Sparks (0.5s -> 2.4s) */}
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
                    delay: 0.45 + stepIdx * 0.22,
                    duration: 1.80,
                    times: [0, 0.26, 0.52, 0.78, 1],
                    ease: "easeInOut",
                  }}
                  className="fixed top-0 left-0 w-3.5 h-3.5 rounded-full bg-gradient-to-r from-rose-400 to-amber-300 blur-[1px] shadow-[0_0_16px_rgba(244,63,94,0.85)]"
                />
              ))}

              {/* 3. Smooth Parabolic Tumbling Card into Dustbin (0.0s -> 2.40s flight) */}
              <motion.div
                initial={{ x: startX - 84, y: startY - 22, scale: 0.95, rotate: 0, opacity: 1 }}
                animate={{
                  x: [
                    startX - 84,
                    startX - 84,
                    startX * 0.7 + targetX * 0.3 - 60,
                    midX - 40,
                    startX * 0.25 + targetX * 0.75 - 25,
                    targetX - 22,
                  ],
                  y: [
                    startY - 22,
                    startY - 55,
                    peakY - 30,
                    peakY + 5,
                    peakY + 70,
                    targetY - 55,
                  ],
                  scale: [1, 1.15, 1.12, 0.92, 0.45, 0.05],
                  rotate: [0, -10, 80, 240, 480, 680],
                  opacity: [1, 1, 1, 1, 0.95, 0],
                }}
                transition={{
                  delay: 0,
                  duration: 2.40,
                  times: [0, 0.20, 0.42, 0.65, 0.88, 1],
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="fixed top-0 left-0 w-44 px-3.5 py-2.5 rounded-2xl bg-gradient-to-br from-rose-500 via-red-500 to-orange-500 border-2 border-white/80 text-white shadow-[0_20px_50px_rgba(244,63,94,0.75)] backdrop-blur-md flex items-center gap-2.5 z-[140]"
              >
                <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/80">
                    Discarding
                  </div>
                  <div className="text-xs font-black truncate">{trashTossAnim.event.title}</div>
                </div>
              </motion.div>

              {/* 4. Large Premium Trash Can at Bottom Center (0.0s -> 4.5s stage) */}
              <motion.div
                initial={{ x: targetX - 72, y: targetY + 220, scale: 0.5, opacity: 0 }}
                animate={{
                  x: targetX - 72,
                  y: [
                    targetY + 220,
                    targetY - 60,
                    targetY - 60,
                    targetY - 45,
                    targetY - 65,
                    targetY - 60,
                    targetY + 240,
                  ],
                  scaleX: [0.6, 1.0, 1.0, 1.32, 0.94, 1.0, 0.4],
                  scaleY: [0.6, 1.0, 1.0, 0.72, 1.16, 1.0, 0.4],
                  opacity: [0, 1, 1, 1, 1, 1, 0],
                }}
                transition={{
                  duration: 4.5,
                  times: [0, 0.12, 0.52, 0.56, 0.62, 0.84, 1],
                  ease: "easeInOut",
                }}
                className="fixed top-0 left-0 w-36 flex flex-col items-center z-[135]"
              >
                {/* Catch Rim Fireworks when card enters mouth at t=2.40s */}
                {rimSparks.map((s) => (
                  <motion.div
                    key={`rim-${s.id}`}
                    initial={{ x: 0, y: 12, scale: 0, opacity: 0 }}
                    animate={{
                      x: [0, s.dx * 0.85, s.dx * 1.2],
                      y: [12, s.dy * 0.9, s.dy + 14],
                      scale: [0, 1.6, 0],
                      opacity: [0, 1, 0],
                    }}
                    transition={{ delay: 2.40, duration: 0.65, ease: "easeOut" }}
                    style={{ backgroundColor: s.color }}
                    className="absolute top-0 w-2.5 h-2.5 rounded-full shadow-[0_0_14px_currentColor]"
                  />
                ))}

                {/* Large Stylized Animated Trash Can (w-36 h-40) */}
                <div className="relative w-36 h-40 rounded-[32px] bg-gradient-to-b from-zinc-800 via-zinc-900 to-black border-2 border-rose-500/80 shadow-[0_24px_60px_rgba(244,63,94,0.65)] flex flex-col items-center justify-center p-3">
                  {/* Wide Glowing Open Mouth Rim */}
                  <div className="-mt-7 w-28 h-5 rounded-t-full bg-gradient-to-r from-rose-500 via-amber-400 to-rose-500 border border-white/40 shadow-[0_0_24px_rgba(244,63,94,0.95)] flex items-center justify-center">
                    <div className="w-20 h-2 bg-black/60 rounded-full" />
                  </div>

                  {/* Golden Drawstring Tie */}
                  <div className="w-16 h-2 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 rounded-full my-2 shadow-[0_0_14px_rgba(251,191,36,0.9)]" />

                  {/* 3D Vertical Ribs */}
                  <div className="flex gap-2.5 my-1 opacity-25">
                    <div className="w-1.5 h-12 bg-white rounded-full" />
                    <div className="w-1.5 h-12 bg-white rounded-full" />
                    <div className="w-1.5 h-12 bg-white rounded-full" />
                  </div>

                  {/* Large Icon */}
                  <Trash2 className="w-12 h-12 text-rose-400 -mt-11 drop-shadow-[0_4px_12px_rgba(244,63,94,0.8)]" />
                </div>

                {/* Status Pill Under Bag */}
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: [0, 1, 1, 0], y: [6, 0, 0, -4] }}
                  transition={{ delay: 2.45, duration: 1.4, times: [0, 0.15, 0.85, 1] }}
                  className="mt-2.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-rose-600 via-red-600 to-orange-500 text-white text-[11px] font-black uppercase tracking-wider shadow-[0_10px_25px_rgba(244,63,94,0.6)] border border-white/30 whitespace-nowrap"
                >
                  🗑️ Discarded "{trashTossAnim.event.title.slice(0, 18)}{trashTossAnim.event.title.length > 18 ? "…" : ""}"
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
        onSuccess={(newSem) => {
          if (newSem) setActiveSemester(newSem);
          fetchData();
        }}
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






