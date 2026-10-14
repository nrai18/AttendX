import React, { useState, useEffect, useRef } from "react";
import { format, subMonths, addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays } from "date-fns";
import { PageSkeleton } from "../../components/common/PageSkeleton";
import { ChevronLeft, ChevronRight, Loader2, MessageSquare, Upload, CalendarDays } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../lib/api";
import { useNavigate } from "react-router-dom";
import { CalendarImportModal } from "../../components/calendar/CalendarImportModal";
import { SyncEventsModal } from "../../components/calendar/SyncEventsModal";
import { InlineAction } from "../../components/ui/inline-action";
import { toast } from "sonner";
import { useCacheStore } from "../../stores/cacheStore";
import { useOfflineStore } from "../../stores/offlineStore";
import { useBackHandlerStore } from "../../stores/backHandlerStore";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { useSwipeable } from "react-swipeable";
import { hapticSelection } from "../../utils/haptics";

interface DayDetail {
  id: string;
  subjectName: string;
  status: string; // "present" | "absent" | "medical" | "od" | "off"
  remarks: string | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  eventType: string;
  isHolidayList?: boolean;
  isHoliday?: boolean;
}

interface CalendarData {
  hasCalendar?: boolean;
  days: Record<string, string>; // "YYYY-MM-DD" -> "attended" | "missed" | "mixed" | "off" | "not_marked" | "future"
  details?: Record<string, DayDetail[]>;
  events?: Record<string, CalendarEvent[]>;
  stats: {
    days: {
      not_marked: number;
      off: number;
      missed: number;
      attended: number;
      mixed: number;
    };
    lectures: {
      off: number;
      missed: number;
      attended: number;
      total: number;
      percentage: number;
    };
  };
}

function deduplicateCalendarEvents(eventsList: CalendarEvent[]): CalendarEvent[] {
  if (!eventsList || eventsList.length <= 1) return eventsList;
  const result: CalendarEvent[] = [];
  for (const ev of eventsList) {
    const isHoliday = Boolean(ev.isHoliday) || ["holiday", "restricted_holiday"].includes(ev.eventType || "");
    if (isHoliday) {
      const matchIdx = result.findIndex(r => {
        const rIsHoliday = Boolean(r.isHoliday) || ["holiday", "restricted_holiday"].includes(r.eventType || "");
        if (!rIsHoliday) return false;
        const normR = r.title.toLowerCase().replace(/\(.*?\)/g, "").trim();
        const normE = ev.title.toLowerCase().replace(/\(.*?\)/g, "").trim();
        return normR === normE || normR.includes(normE) || normE.includes(normR);
      });
      if (matchIdx !== -1) {
        if (ev.title.length > result[matchIdx].title.length) {
          result[matchIdx] = ev;
        }
        continue;
      }
    } else {
      if (result.some(r => r.title.toLowerCase().trim() === ev.title.toLowerCase().trim())) {
        continue;
      }
    }
    result.push(ev);
  }
  return result;
}

export const CalendarPage = () => {
  const cachedData = useCacheStore((state) => state.calendar);
  const setCache = useCacheStore((state) => state.setCache);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  // Determine initial month
  const initialMonthStr = format(new Date(), "yyyy-MM");
  const [data, setData] = useState<CalendarData | null>(cachedData?.[initialMonthStr] || null);
  const [isLoading, setIsLoading] = useState(!cachedData?.[initialMonthStr]);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (selectedMobileDate) {
        hapticSelection();
        const nextDay = format(addDays(new Date(selectedMobileDate + 'T00:00:00'), 1), 'yyyy-MM-dd');
        setSelectedMobileDate(nextDay);
      }
    },
    onSwipedRight: () => {
      if (selectedMobileDate) {
        hapticSelection();
        const prevDay = format(addDays(new Date(selectedMobileDate + 'T00:00:00'), -1), 'yyyy-MM-dd');
        setSelectedMobileDate(prevDay);
      }
    },
    trackMouse: false
  });

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [selectedMobileDate, setSelectedMobileDate] = useState<string | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  useEffect(() => {
    const unregister = useBackHandlerStore.getState().register(() => {
      if (isImportModalOpen) { setIsImportModalOpen(false); return true; }
      if (isSyncModalOpen) { setIsSyncModalOpen(false); return true; }
      if (selectedMobileDate !== null) { setSelectedMobileDate(null); return true; }
      return false;
    });
    return () => unregister();
  }, [isImportModalOpen, isSyncModalOpen, selectedMobileDate]);

  const navigate = useNavigate();

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStartX || !touchEndX) return;
    const distance = touchStartX - touchEndX;
    if (distance > 50) {
      hapticSelection();
      setCurrentDate(prev => addMonths(prev, 1));
    } else if (distance < -50) {
      hapticSelection();
      setCurrentDate(prev => subMonths(prev, 1));
    }
    setTouchStartX(null);
    setTouchEndX(null);
  };

  const abortControllerRef = useRef<AbortController | null>(null);

  const buildLocalMonthPreview = (monthStr: string): CalendarData | null => {
    try {
      const cacheState = useCacheStore.getState();
      const allLogs: any[] =
        cacheState.subject_logs?.["all"]?.logs ||
        useAttendanceStore.getState().historyLogs ||
        [];
      const ttStore = cacheState.timetable;
      const activeSlots: any[] = Array.isArray(ttStore) ? ttStore : (ttStore?.slots || []);
      const archivedVersions: any[] = (!Array.isArray(ttStore) && ttStore?.archivedSlots) || cacheState.archived_timetables || [];
      const archivedSlots: any[] = archivedVersions.flatMap((v: any) => v?.slots || []);
      const allSlots = [...activeSlots, ...archivedSlots];
      const allEvents: any[] = cacheState.semester?.events || (useAttendanceStore.getState().events as any) || [];

      if (allLogs.length === 0 && allSlots.length === 0 && allEvents.length === 0) {
        return null;
      }

      const [year, m] = monthStr.split("-").map(Number);
      const startDate = new Date(year, m - 1, 1);
      const endDate = new Date(year, m, 0);
      const todayStr = format(new Date(), "yyyy-MM-dd");

      const days: Record<string, string> = {};
      const details: Record<string, DayDetail[]> = {};
      const eventsMap: Record<string, CalendarEvent[]> = {};
      const dayStats = { not_marked: 0, off: 0, missed: 0, attended: 0, mixed: 0 };
      const lectureStats = { off: 0, missed: 0, attended: 0, total: 0, percentage: 0 };

      for (let d = new Date(startDate); d <= endDate; d = addDays(d, 1)) {
        const dateStr = format(d, "yyyy-MM-dd");
        const jsDay = d.getDay();
        const dbDay = jsDay === 0 ? 6 : jsDay - 1;

        const dayEvents = allEvents.filter((ev: any) => {
          const s = String(ev.date || "").slice(0, 10);
          const e = String(ev.endDate || ev.date || "").slice(0, 10);
          return s && dateStr >= s && dateStr <= e;
        });

        if (dayEvents.length > 0) {
          eventsMap[dateStr] = deduplicateCalendarEvents(
            dayEvents.map((ev: any) => ({
              id: ev.id,
              title: ev.title || "Event",
              eventType: ev.eventType || ev.type || "other",
              isHolidayList: ev.isHolidayList,
              isHoliday: ev.isHoliday,
            }))
          );
        }

        const isGlobalOff = dayEvents.some((ev: any) =>
          ["holiday", "vacation"].includes(String(ev.eventType || ev.type || "").toLowerCase())
        );

        const dayLogs = allLogs.filter((l: any) => String(l.date || "").slice(0, 10) === dateStr);
        const daySlots = isGlobalOff
          ? []
          : allSlots.filter((s: any) => {
              if (s.dayOfWeek !== dbDay) return false;
              const fromKey = s.validFrom ? String(s.validFrom).slice(0, 10) : "0000-00-00";
              if (fromKey > dateStr) return false;
              if (s.validUntil) {
                const untilKey = String(s.validUntil).slice(0, 10);
                if (untilKey < dateStr) return false;
              }
              return true;
            });

        if (dayLogs.length > 0) {
          details[dateStr] = dayLogs.map((l: any, idx: number) => ({
            id: l.id || `${dateStr}-${idx}`,
            subjectName: l.subjectName || l.subject?.name || l.subject || "Subject",
            status: String(l.status || "not_marked").toLowerCase(),
            remarks: l.remarks || null,
          }));
        }

        let status = "off";
        if (dateStr > todayStr) {
          status = daySlots.length > 0 ? "future" : "off";
        } else if (dayLogs.length > 0) {
          let presentCount = 0;
          let absentCount = 0;
          for (const l of dayLogs) {
            const st = String(l.status || "").toLowerCase();
            if (["present", "attended", "medical", "od"].includes(st)) {
              presentCount++;
              lectureStats.attended++;
            } else if (["absent", "missed"].includes(st)) {
              absentCount++;
              lectureStats.missed++;
            } else if (["off", "cancelled"].includes(st)) {
              lectureStats.off++;
            }
          }
          if (presentCount > 0 && absentCount === 0) status = "attended";
          else if (absentCount > 0 && presentCount === 0) status = "missed";
          else if (presentCount > 0 && absentCount > 0) status = "mixed";
          else status = "off";
        } else {
          status = daySlots.length > 0 ? "not_marked" : "off";
        }

        days[dateStr] = status;
        if (status === "not_marked" || status === "future") dayStats.not_marked++;
        else if (status === "off") dayStats.off++;
        else if (status === "missed") dayStats.missed++;
        else if (status === "attended") dayStats.attended++;
        else if (status === "mixed") dayStats.mixed++;
      }

      lectureStats.total = lectureStats.attended + lectureStats.missed;
      lectureStats.percentage =
        lectureStats.total > 0 ? (lectureStats.attended / lectureStats.total) * 100 : 0;

      return {
        hasCalendar: allEvents.length > 0,
        days,
        details,
        events: eventsMap,
        stats: {
          days: dayStats,
          lectures: lectureStats,
        },
      };
    } catch {
      return null;
    }
  };

  const prefetchAdjacentMonths = (baseDate: Date) => {
    const adjacent = [
      format(subMonths(baseDate, 1), "yyyy-MM"),
      format(addMonths(baseDate, 1), "yyyy-MM"),
    ];
    const currentCalCache = useCacheStore.getState().calendar || {};
    adjacent.forEach((mStr) => {
      if (currentCalCache[mStr]) return;
      api
        .get(`/attendance/calendar?month=${mStr}`)
        .then((res) => {
          if (res.data && typeof res.data === "object") {
            useCacheStore.getState().setCache("calendar", {
              ...(useCacheStore.getState().calendar || {}),
              [mStr]: res.data,
            });
          }
        })
        .catch(() => {});
    });
  };

  const fetchCalendar = async (force: boolean = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const monthStr = format(currentDate, "yyyy-MM");
    try {
      const latestCalendarCache = useCacheStore.getState().calendar;
      if (latestCalendarCache && latestCalendarCache[monthStr]) {
        setData(latestCalendarCache[monthStr]);
        setIsLoading(false);
      } else {
        const instantPreview = buildLocalMonthPreview(monthStr);
        if (instantPreview) {
          setData(instantPreview);
          setIsLoading(false);
        } else if (!data) {
          setIsLoading(true);
        }
      }
      
      const res = await api.get(`/attendance/calendar?month=${monthStr}${force ? '&force=true' : ''}`, {
        signal: controller.signal
      });
      let d = typeof res.data === 'string' ? { days: [], insights: [], events: [], isComplete: false, completionPercentage: 0, requiredClassesToTarget: 0, canBunk: false } : res.data;
      
      // MERGE OFFLINE/OPTIMISTIC LOGS OVER THE API RESPONSE ONLY WHEN OFFLINE QUEUE IS NON-EMPTY
      // When online with an empty offline queue, the server response is authoritative and must not be clobbered by stale historyLogs.
      const hasPendingOfflineQueue = (useOfflineStore.getState().queue?.length || 0) > 0;
      const logs = hasPendingOfflineQueue ? (useAttendanceStore.getState().historyLogs || []) : [];
      const filteredLogs = logs.filter((log: any) => log.date?.startsWith(monthStr));
      
      if (filteredLogs.length > 0) {
        if (!d.days) d.days = {};
        if (!d.details) d.details = {};
        
        // Group logs by date
        const logsByDate: Record<string, any[]> = {};
        filteredLogs.forEach((log: any) => {
          if (!logsByDate[log.date]) logsByDate[log.date] = [];
          logsByDate[log.date].push(log);
        });
        
        Object.entries(logsByDate).forEach(([dateStr, dayLogs]) => {
          let dayDetails = [...(d.details[dateStr] || [])];
          
          dayLogs.forEach((l: any) => {
            if (!dayDetails.some((detail: any) => detail.subjectName === l.subject)) {
              dayDetails.push({
                id: Math.random().toString(),
                subjectName: l.subject,
                status: l.status.toLowerCase(),
                remarks: null,
              });
            }
          });
          
          if (dayDetails.length > 0) {
            d.details[dateStr] = dayDetails;
            
            // A day only gets a status color (attended, missed, mixed, off) when it is FULLY MARKED.
            // If any slot is still pending/unmarked, the day remains 'not_marked' (uncoloured).
            const isFullyMarked = dayDetails.every((l: any) => {
              const s = (l.status || '').toLowerCase();
              const isUnmarkedId = typeof l.id === 'string' && l.id.startsWith('unmarked-');
              return !isUnmarkedId && s && s !== 'not_marked';
            });

            if (!isFullyMarked) {
              d.days[dateStr] = "not_marked";
            } else {
              const hasAttended = dayDetails.some((l: any) => ['present', 'attended', 'medical', 'od'].includes(l.status.toLowerCase()));
              const hasMissed = dayDetails.some((l: any) => ['absent', 'missed'].includes(l.status.toLowerCase()));
              
              if (hasAttended && hasMissed) {
                d.days[dateStr] = "mixed";
              } else if (hasAttended) {
                d.days[dateStr] = "attended";
              } else if (hasMissed) {
                d.days[dateStr] = "missed";
              } else {
                d.days[dateStr] = "off";
              }
            }
          }
        });
      }

      setData(d);
      
      setCache('calendar', {
        ...useCacheStore.getState().calendar,
        [monthStr]: d
      });
      prefetchAdjacentMonths(currentDate);
      return d;
    } catch (error: any) {
      if (error?.name === 'CanceledError' || error?.name === 'AbortError' || error?.message?.includes('canceled')) return;
      console.error("Failed to fetch calendar:", error);
      
      // --- OFFLINE FALLBACK CALCULATION ---
      const fallbackData = buildLocalMonthPreview(monthStr);
      if (fallbackData) {
        setData(fallbackData);
        return fallbackData;
      }
      return null;
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchCalendar(false);

    // Check if we were redirected here and should prompt the user to force sync
    const params = new URLSearchParams(window.location.search);
    if (false && params.get("promptSync") === "true") {
      setTimeout(() => {
        toast.info("Click 'Sync Events' to ensure your lectures and calendar dates are fully synchronized.", {
          duration: 3500,
          position: "top-center"
        });
        // Remove the param so it doesn't keep prompting on refresh
        window.history.replaceState({}, document.title, "/calendar");
      }, 500);
    }

    const handleAttendanceUpdate = () => {
      fetchCalendar(true);
    };
    window.addEventListener("attendance-updated", handleAttendanceUpdate);
    window.addEventListener("events-updated", handleAttendanceUpdate);
    return () => {
      window.removeEventListener("attendance-updated", handleAttendanceUpdate);
      window.removeEventListener("events-updated", handleAttendanceUpdate);
    };
  }, [currentDate]);

  const getEventOptimumStyle = (e: CalendarEvent) => {
    const type = (e.eventType || "").toLowerCase();
    const titleLower = (e.title || "").toLowerCase();

    if (type === "restricted_holiday") {
      return {
        priority: 1,
        dot: "bg-cyan-400",
        ring: "ring-2 ring-cyan-500 bg-cyan-500/10 dark:bg-cyan-500/20",
        text: "text-cyan-600 dark:text-cyan-400",
        pill: "bg-cyan-500/10 border-cyan-500/25 text-cyan-600 dark:text-cyan-400",
      };
    }
    if (e.isHolidayList && type !== "restricted_holiday") {
      return {
        priority: 0,
        dot: "bg-blue-500",
        ring: "ring-2 ring-blue-500 bg-blue-500/10 dark:bg-blue-500/20",
        text: "text-blue-600 dark:text-blue-400",
        pill: "bg-blue-500/10 border-blue-500/25 text-blue-600 dark:text-blue-400",
      };
    }
    if (
      type === "holiday" ||
      titleLower.includes("holiday") ||
      titleLower.includes("jayanti") ||
      titleLower.includes("diwali") ||
      titleLower.includes("dussehra")
    ) {
      return {
        priority: 0,
        dot: "bg-blue-500",
        ring: "ring-2 ring-blue-500 bg-blue-500/10 dark:bg-blue-500/20",
        text: "text-blue-600 dark:text-blue-400",
        pill: "bg-blue-500/10 border-blue-500/25 text-blue-600 dark:text-blue-400",
      };
    }
    if (type === "endsem" || titleLower.includes("end sem") || titleLower.includes("end-sem")) {
      return {
        priority: 2,
        dot: "bg-red-500",
        ring: "ring-2 ring-red-600 bg-red-600/10 dark:bg-red-600/20",
        text: "text-red-600 dark:text-red-400",
        pill: "bg-red-500/10 border-red-500/25 text-red-600 dark:text-red-400",
      };
    }
    if (type === "midsem" || titleLower.includes("mid sem") || titleLower.includes("mid-sem") || titleLower.includes("mse")) {
      return {
        priority: 3,
        dot: "bg-orange-500",
        ring: "ring-2 ring-orange-500 bg-orange-500/10 dark:bg-orange-500/20",
        text: "text-orange-600 dark:text-orange-400",
        pill: "bg-orange-500/10 border-orange-500/25 text-orange-600 dark:text-orange-400",
      };
    }
    if (type === "lab_exam" || titleLower.includes("lab") || titleLower.includes("practical")) {
      return {
        priority: 5,
        dot: "bg-yellow-400",
        ring: "ring-2 ring-yellow-500 bg-yellow-500/10 dark:bg-yellow-500/20",
        text: "text-yellow-600 dark:text-yellow-400",
        pill: "bg-yellow-500/10 border-yellow-500/25 text-yellow-600 dark:text-yellow-400",
      };
    }
    if (type === "ct" || type === "exam" || titleLower.includes("exam") || titleLower.includes("cycle test") || titleLower.includes("quiz")) {
      return {
        priority: 4,
        dot: "bg-amber-500",
        ring: "ring-2 ring-amber-500 bg-amber-500/10 dark:bg-amber-500/20",
        text: "text-amber-600 dark:text-amber-400",
        pill: "bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400",
      };
    }
    if (type === "vacation" || titleLower.includes("vacation") || titleLower.includes("break")) {
      return {
        priority: 6,
        dot: "bg-cyan-400",
        ring: "ring-2 ring-cyan-500 bg-cyan-500/10 dark:bg-cyan-500/20",
        text: "text-cyan-600 dark:text-cyan-400",
        pill: "bg-cyan-500/10 border-cyan-500/25 text-cyan-600 dark:text-cyan-400",
      };
    }
    if (type === "sports" || titleLower.includes("sports") || titleLower.includes("yalgaar") || titleLower.includes("tournament")) {
      return {
        priority: 9,
        dot: "bg-indigo-400",
        ring: "ring-2 ring-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/20",
        text: "text-indigo-600 dark:text-indigo-400",
        pill: "bg-indigo-500/10 border-indigo-500/25 text-indigo-600 dark:text-indigo-400",
      };
    }
    if (type === "fest" || titleLower.includes("fest")) {
      return {
        priority: 8,
        dot: "bg-fuchsia-500",
        ring: "ring-2 ring-purple-500 bg-purple-500/10 dark:bg-purple-500/20",
        text: "text-fuchsia-600 dark:text-fuchsia-400",
        pill: "bg-fuchsia-500/10 border-fuchsia-500/25 text-fuchsia-600 dark:text-fuchsia-400",
      };
    }
    if (type === "institute" || titleLower.includes("institute") || titleLower.includes("commencement")) {
      return {
        priority: 7,
        dot: "bg-sky-400",
        ring: "ring-2 ring-sky-500 bg-sky-500/10 dark:bg-sky-500/20",
        text: "text-sky-600 dark:text-sky-400",
        pill: "bg-sky-500/10 border-sky-500/25 text-sky-600 dark:text-sky-400",
      };
    }
    return {
      priority: 7,
      dot: "bg-pink-500",
      ring: "ring-2 ring-pink-500 bg-pink-500/10 dark:bg-pink-500/20",
      text: "text-pink-600 dark:text-pink-400",
      pill: "bg-pink-500/10 border-pink-500/25 text-pink-600 dark:text-pink-400",
    };
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  // our weeks start on Monday (1)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = [];
  let day = startDate;
  while (day <= endDate) {
    calendarDays.push(day);
    day = addDays(day, 1);
  }

  const getDotColor = (status?: string) => {
    switch (status) {
      case "attended": return "bg-emerald-500";
      case "missed": return "bg-rose-500";
      case "mixed": return "bg-purple-500";
      case "off": return "bg-yellow-500";
      case "not_marked":
      case "future": return "bg-muted-foreground/30";
      default: return "bg-muted-foreground/20";
    }
  };

  if (isLoading) {
    return <PageSkeleton type="calendar" />;
  }

  const days: Record<string, string> = data?.days || {};
  const details: Record<string, DayDetail[]> = data?.details || {};
  const events: Record<string, CalendarEvent[]> = data?.events || {};
  const stats = data?.stats || { 
    days: { not_marked: 0, off: 0, missed: 0, attended: 0, mixed: 0 }, 
    lectures: { off: 0, missed: 0, attended: 0, total: 0, percentage: 0 } 
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-foreground tracking-tight">{format(currentDate, "MMMM yyyy")}</h2>
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-semibold transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            AI Import
          </button>
          <div className="hidden sm:block ml-2 w-80 transform scale-90 origin-left">
            <InlineAction 
              label="Calendar" 
              icon={<CalendarDays size={18} />} 
              actionText="Sync Events" 
              onAction={async () => {
                hapticSelection();
                setIsSyncModalOpen(true);
              }} 
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { hapticSelection(); setCurrentDate(subMonths(currentDate, 1)); }} className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors cursor-pointer">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => { hapticSelection(); setCurrentDate(new Date()); }} className="px-3 py-1.5 hover:bg-muted rounded-lg text-sm font-medium text-foreground transition-colors cursor-pointer">
            Today
          </button>
          <button onClick={() => { hapticSelection(); setCurrentDate(addMonths(currentDate, 1)); }} className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors cursor-pointer">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile Sync Events Pill Banner */}
      <div className="block sm:hidden w-full -mt-2">
        <InlineAction 
          label="Calendar" 
          icon={<CalendarDays size={18} />} 
          actionText="Sync Events" 
          onAction={async () => {
            hapticSelection();
            setIsSyncModalOpen(true);
          }} 
        />
      </div>

      <div 
        className="grid grid-cols-7 gap-y-4 text-center mb-6"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
          <div key={d} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{d}</div>
        ))}

        {calendarDays.map((d, i) => {
          const dateKey = format(d, "yyyy-MM-dd");
          const status = days[dateKey];
          const isCurrentMonth = isSameMonth(d, currentDate);
          const isToday = isSameDay(d, new Date());
          const dayDetails = details[dateKey] || [];
          const dayEvents = events[dateKey] || [];
          const dedupedDayEvents = deduplicateCalendarEvents(dayEvents).sort(
            (a, b) => getEventOptimumStyle(a).priority - getEventOptimumStyle(b).priority
          );
          const hasRemarks = dayDetails.some(item => !!item.remarks);
          const animBorder = dedupedDayEvents.length > 0 ? getEventOptimumStyle(dedupedDayEvents[0]).ring : "";

          return (
            <div key={i} className="flex justify-center">
              {isCurrentMonth ? (
                <button
                  onClick={() => {
                    hapticSelection();
                    if (window.innerWidth < 640) {
                      setSelectedMobileDate(dateKey);
                    } else {
                      navigate(`/today?date=${dateKey}`);
                    }
                  }}
                  className={`flex flex-col items-center justify-center relative w-12 h-14 hover:bg-muted/60 rounded-2xl transition-all cursor-pointer group ${animBorder}`}
                >
                  <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-transform group-hover:scale-110 ${
                    isToday ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20" : "text-foreground"
                  }`}>
                    {format(d, "d")}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${getDotColor(status)}`} />
                    {hasRemarks && (
                      <MessageSquare className="w-2.5 h-2.5 text-primary" />
                    )}
                    {dedupedDayEvents.slice(0, 2).map((ev, evIdx) => (
                      <span
                        key={ev.id || evIdx}
                        className={`w-1.5 h-1.5 rounded-full ${getEventOptimumStyle(ev).dot}`}
                        title={ev.title}
                      />
                    ))}
                  </div>

                  {/* Hover Agenda Tooltip (Hidden on Mobile) */}
                  <div className={`absolute ${Math.floor(i / 7) <= 1 ? 'top-full mt-2 origin-top' : 'bottom-full mb-2 origin-bottom'} ${i % 7 === 0 ? 'left-0' : i % 7 === 6 ? 'right-0' : 'left-1/2 -translate-x-1/2'} w-64 bg-card border border-border rounded-xl shadow-2xl p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-auto hidden sm:flex flex-col gap-2 text-left scale-95 group-hover:scale-100 max-h-[350px] overflow-y-auto custom-scrollbar`}>
                    {/* Header */}
                    <div className="flex justify-between items-center pb-2 border-b border-border/50">
                      <span className="font-bold text-sm text-foreground">{format(d, "d MMM")}</span>
                      <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                        status === "attended" ? "bg-emerald-500/20 text-emerald-500" :
                        status === "missed" ? "bg-rose-500/20 text-rose-500" :
                        status === "mixed" ? "bg-purple-500/20 text-purple-500" :
                        status === "off" ? "bg-yellow-500/20 text-yellow-500" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {status === "not_marked" 
                          ? (dayDetails.length > 0 ? "Incomplete" : "No Data") 
                          : status}
                      </span>
                    </div>

                    {/* Events */}
                    {dedupedDayEvents.length > 0 && (
                      <div className="flex flex-col gap-1">
                        {dedupedDayEvents.map((e, idx) => {
                          const evStyle = getEventOptimumStyle(e);
                          return (
                            <div key={idx} className={`flex items-start gap-1.5 text-xs font-semibold ${evStyle.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${evStyle.dot} mt-1 shrink-0`} />
                              <span className="leading-tight">{e.title}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Subjects Agenda */}
                    {dayDetails.length > 0 && (
                      <div className="flex flex-col gap-1.5 mt-1">
                        {dayDetails.map((detail, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground truncate pr-2 flex-1">{detail.subjectName}</span>
                            <span className={`font-bold shrink-0 ${
                              detail.status === "present" ? "text-emerald-500" :
                              detail.status === "absent" ? "text-rose-500" :
                              detail.status === "off" ? "text-yellow-500" :
                              "text-blue-500"
                            }`}>
                              {detail.status === "present" ? "Present" : detail.status === "absent" ? "Absent" : detail.status === "off" ? "Off" : detail.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Empty State */}
                    {dayDetails.length === 0 && dayEvents.length === 0 && (
                      <div className="text-xs text-muted-foreground italic text-center py-1">
                        No agenda for this day
                      </div>
                    )}
                  </div>
                </button>
              ) : (
                <div className="w-12 h-14" />
              )}
            </div>
          );
        })}
      </div>

      {/* Stats Cards */}
      <div className="space-y-4">
        {/* Days Stats */}
        <div className="bg-card rounded-2xl overflow-hidden border border-border shadow-sm">
          <div className="grid grid-cols-5 p-4 text-center divide-x divide-border">
            <div>
              <div className="text-lg font-bold text-foreground mb-0.5">{stats.days.not_marked}</div>
              <div className="flex items-center justify-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider hidden sm:inline">Not marked</span>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider sm:hidden">None</span>
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-foreground mb-0.5">{stats.days.off}</div>
              <div className="flex items-center justify-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Off</span>
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-foreground mb-0.5">{stats.days.missed}</div>
              <div className="flex items-center justify-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Missed</span>
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-foreground mb-0.5">{stats.days.attended}</div>
              <div className="flex items-center justify-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Attended</span>
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-foreground mb-0.5">{stats.days.mixed}</div>
              <div className="flex items-center justify-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Mixed</span>
              </div>
            </div>
          </div>
          <div className="bg-muted/40 text-center py-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest border-t border-border">
            Days
          </div>
        </div>

        {/* Lectures Stats */}
        <div className="bg-card rounded-2xl overflow-hidden border border-border shadow-sm">
          <div className="grid grid-cols-5 p-4 text-center divide-x divide-border">
            <div>
              <div className="text-lg font-bold text-foreground mb-0.5">{stats.lectures.off}</div>
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Off</div>
            </div>
            <div>
              <div className="text-lg font-bold text-foreground mb-0.5">{stats.lectures.missed}</div>
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Missed</div>
            </div>
            <div>
              <div className="text-lg font-bold text-foreground mb-0.5">{stats.lectures.attended}</div>
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Attended</div>
            </div>
            <div>
              <div className="text-lg font-bold text-foreground mb-0.5">{stats.lectures.total}</div>
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total</div>
            </div>
            <div>
              <div className="text-lg font-bold text-foreground mb-0.5">{(stats?.lectures?.percentage ?? 0).toFixed(2)}%</div>
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Percent</div>
            </div>
          </div>
          <div className="bg-muted/40 text-center py-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest border-t border-border">
            Lectures
          </div>
        </div>
      </div>

      <CalendarImportModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => fetchCalendar(true)}
      />

      <SyncEventsModal 
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSuccess={() => fetchCalendar(true)}
      />

      {/* Mobile Agenda Modal */}
      <AnimatePresence>
        {selectedMobileDate && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMobileDate(null)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] sm:hidden"
            />
            <motion.div
              {...swipeHandlers}
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-3xl p-6 z-[101] shadow-2xl sm:hidden flex flex-col max-h-[80vh]"
            >
              <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-6" />
              
              {/* Agenda Content */}
              {(() => {
                const dayDetails = data?.details?.[selectedMobileDate] || [];
                const dayEvents = data?.events?.[selectedMobileDate] || [];
                const status = data?.days?.[selectedMobileDate] || "not_marked";
                
                return (
                  <div className="flex flex-col gap-4 overflow-y-auto">
                    {/* Header */}
                    <div className="flex justify-between items-center pb-3 border-b border-border">
                      <h3 className="text-xl font-bold text-foreground">
                        {format(new Date(selectedMobileDate + "T00:00:00"), "MMMM d, yyyy")}
                      </h3>
                      <span className={`text-xs uppercase font-bold px-2 py-1 rounded ${
                        status === "attended" ? "bg-emerald-500/20 text-emerald-500" :
                        status === "missed" ? "bg-rose-500/20 text-rose-500" :
                        status === "mixed" ? "bg-purple-500/20 text-purple-500" :
                        status === "off" ? "bg-yellow-500/20 text-yellow-500" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {status === "not_marked" 
                          ? (dayDetails.length > 0 ? "Incomplete" : "No Data") 
                          : status}
                      </span>
                    </div>

                    {/* Events */}
                    {dayEvents.length > 0 && (
                      <div className="flex flex-col gap-2 mb-2">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Events</h4>
                        {deduplicateCalendarEvents(dayEvents).map((e, idx) => {
                          const evStyle = getEventOptimumStyle(e);
                          return (
                            <div key={idx} className={`flex items-start gap-2 text-sm font-semibold p-2.5 rounded-xl border ${evStyle.pill}`}>
                              <span className={`w-2 h-2 rounded-full ${evStyle.dot} mt-1.5 shrink-0`} />
                              <span className="leading-tight">{e.title}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Subjects Agenda */}
                    {dayDetails.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Classes</h4>
                        {dayDetails.map((detail, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm bg-muted/30 p-2.5 rounded-xl border border-border">
                            <span className="text-foreground font-medium truncate pr-2 flex-1">{detail.subjectName}</span>
                            <span className={`font-bold shrink-0 ${
                              detail.status === "present" ? "text-emerald-500" :
                              detail.status === "absent" ? "text-rose-500" :
                              detail.status === "off" ? "text-yellow-500" :
                              "text-blue-500"
                            }`}>
                              {detail.status === "present" ? "Present" :
                               detail.status === "absent" ? "Absent" :
                               detail.status === "off" ? "Off" : (detail.status === "not_marked" ? "Not Marked" : detail.status.charAt(0).toUpperCase() + detail.status.slice(1))}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground italic text-center py-4 bg-muted/20 rounded-xl">
                        No classes scheduled
                      </div>
                    )}

                    <div className="flex gap-3 mt-4 pt-4 border-t border-border">
                      <button 
                        onClick={() => setSelectedMobileDate(null)}
                        className="flex-1 py-3.5 rounded-xl font-bold text-sm bg-muted text-foreground hover:bg-muted/80 transition-colors"
                      >
                        Close
                      </button>
                      <button 
                        onClick={() => navigate(`/today?date=${selectedMobileDate}`)}
                        className="flex-[2] py-3.5 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        Open Day Details
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

