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
  subjectId?: string;
  subjectName: string;
  startTime?: string;
  endTime?: string;
  isExtra?: boolean;
  status: string; // "present" | "absent" | "medical" | "od" | "off"
  remarks: string | null;
}

export const matchLogDate = (rawDate: any, targetDateStr: string): boolean => {
  if (!rawDate || !targetDateStr) return false;
  const s = String(rawDate);
  if (s === targetDateStr || s.startsWith(targetDateStr)) return true;
  if (s.includes("T")) {
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      const pad = (n: number) => String(n).padStart(2, "0");
      const localIso = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
      if (localIso === targetDateStr) return true;
      const istTime = new Date(dt.getTime() + 5.5 * 3600 * 1000);
      const istIso = `${istTime.getUTCFullYear()}-${pad(istTime.getUTCMonth() + 1)}-${pad(istTime.getUTCDate())}`;
      if (istIso === targetDateStr) return true;
    }
  }
  return s.slice(0, 10) === targetDateStr;
};

function sortDayDetailsChronologically(items: DayDetail[], dateStr: string): DayDetail[] {
  if (!items || items.length <= 1) return items || [];
  try {
    const cacheState = useCacheStore.getState();
    const ttStore = cacheState.timetable;
    const activeSlots: any[] = Array.isArray(ttStore) ? ttStore : (ttStore?.slots || []);
    const semId =
      (!Array.isArray(ttStore) && ttStore?.activeSemester?.id) ||
      cacheState.semester?.activeSemester?.id ||
      useAttendanceStore.getState().activeSemesterId;
    const archivedVersions: any[] =
      (!Array.isArray(ttStore) && ttStore?.archivedSlots) ||
      (semId && (cacheState as any)[`archived_timetables_${semId}`]) ||
      cacheState.archived_timetables ||
      [];
    const archivedSlots: any[] = archivedVersions
      .filter((v: any) => !v?.isCurrent && v?.id !== "current_version")
      .flatMap((v: any) => v?.slots || []);
    const allSlots = [...archivedSlots, ...activeSlots];

    const todayAgenda: any[] = cacheState.today?.[dateStr]?.agenda || [];
    const allLogs: any[] =
      cacheState.subject_logs?.["all"]?.logs ||
      cacheState.all_logs ||
      useAttendanceStore.getState().historyLogs ||
      [];
    const dateLogs = allLogs.filter((l: any) => matchLogDate(l.date, dateStr));

    const d = new Date(dateStr + "T00:00:00");
    const jsDay = d.getDay();
    const dbDay = jsDay === 0 ? 6 : jsDay - 1;

    const resolveStartTime = (item: DayDetail): string => {
      if (item.startTime && item.startTime !== "00:00") return item.startTime;
      const normName = String(item.subjectName || "").trim().toLowerCase();
      const itemIsExtra = Boolean(item.isExtra);

      // 1. Check cached TodayPage agenda for this exact date (matching extra vs regular slot first)
      const matchAgenda =
        todayAgenda.find(
          (a: any) =>
            (item.id && (a.id === item.id || a.attendanceId === item.id || `today-${a.id}` === item.id)) ||
            (Boolean(a.isExtra || a.overrideType === "extra_class" || (a.type === "override" && a.isExtra)) === itemIsExtra &&
              ((item.subjectId && a.subject?.id === item.subjectId) ||
                String(a.subject?.name || a.subjectName || "").trim().toLowerCase() === normName))
        ) ||
        todayAgenda.find(
          (a: any) =>
            (item.subjectId && a.subject?.id === item.subjectId) ||
            String(a.subject?.name || a.subjectName || "").trim().toLowerCase() === normName
        );
      if (matchAgenda?.startTime && matchAgenda.startTime !== "00:00") {
        return matchAgenda.startTime;
      }

      // 2. Check cached attendance logs for this exact date (matching extra vs regular slot first)
      const matchLog =
        dateLogs.find(
          (l: any) =>
            (item.id && (l.id === item.id || l.overrideId === item.id || l.timetableSlotId === item.id)) ||
            (Boolean(l.isExtra || (l.slotType && String(l.slotType).toLowerCase() === "extra")) === itemIsExtra &&
              ((item.subjectId && l.subjectId === item.subjectId) ||
                String(l.subjectName || l.subject?.name || l.subject || "").trim().toLowerCase() === normName))
        ) ||
        dateLogs.find(
          (l: any) =>
            (item.subjectId && l.subjectId === item.subjectId) ||
            String(l.subjectName || l.subject?.name || l.subject || "").trim().toLowerCase() === normName
        );
      const logTime = matchLog?.startTime || matchLog?.time;
      if (logTime && logTime !== "00:00") {
        return logTime;
      }
      // 3. Match against version-sorted timetable slots (archived versions valid on dateStr before active versions)
      const subjectSlots = allSlots.filter(
        (s: any) =>
          (item.subjectId && s.subjectId === item.subjectId) ||
          String(s.subject?.name || s.subjectName || "").trim().toLowerCase() === normName
      );
      if (subjectSlots.length === 0) return "99:99";

      const sortedSubjectSlots = [...subjectSlots].sort((a: any, b: any) => {
        const aUntil = a.validUntil ? String(a.validUntil).slice(0, 10) : null;
        const bUntil = b.validUntil ? String(b.validUntil).slice(0, 10) : null;
        const aValidOnDate = !aUntil || aUntil >= dateStr;
        const bValidOnDate = !bUntil || bUntil >= dateStr;
        if (aValidOnDate !== bValidOnDate) return aValidOnDate ? -1 : 1;
        if (aUntil && bUntil && aUntil !== bUntil) return aUntil.localeCompare(bUntil);
        if (aUntil && !bUntil) return -1;
        if (!aUntil && bUntil) return 1;
        const aFrom = a.validFrom ? String(a.validFrom).slice(0, 10) : "0000-00-00";
        const bFrom = b.validFrom ? String(b.validFrom).slice(0, 10) : "0000-00-00";
        return aFrom.localeCompare(bFrom);
      });

      const matchSlot =
        sortedSubjectSlots.find(
          (s: any) =>
            s.dayOfWeek === dbDay &&
            (!s.validFrom || String(s.validFrom).slice(0, 10) <= dateStr) &&
            (!s.validUntil || String(s.validUntil).slice(0, 10) >= dateStr)
        ) ||
        sortedSubjectSlots.find(
          (s: any) =>
            s.dayOfWeek === dbDay &&
            (!s.validUntil || String(s.validUntil).slice(0, 10) >= dateStr)
        ) ||
        sortedSubjectSlots.find((s: any) => s.dayOfWeek === dbDay) ||
        sortedSubjectSlots[0];

      return matchSlot?.startTime && matchSlot.startTime !== "00:00" ? matchSlot.startTime : "99:99";
    };

    return [...items].sort((a, b) => resolveStartTime(a).localeCompare(resolveStartTime(b)));
  } catch {
    return items;
  }
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
        const nextDt = addDays(new Date(selectedMobileDate + 'T00:00:00'), 1);
        const nextDay = format(nextDt, 'yyyy-MM-dd');
        if (nextDay.slice(0, 7) !== selectedMobileDate.slice(0, 7)) {
          setCurrentDate(new Date(nextDt.getFullYear(), nextDt.getMonth(), 1));
        }
        setSelectedMobileDate(nextDay);
      }
    },
    onSwipedRight: () => {
      if (selectedMobileDate) {
        hapticSelection();
        const prevDt = addDays(new Date(selectedMobileDate + 'T00:00:00'), -1);
        const prevDay = format(prevDt, 'yyyy-MM-dd');
        if (prevDay.slice(0, 7) !== selectedMobileDate.slice(0, 7)) {
          setCurrentDate(new Date(prevDt.getFullYear(), prevDt.getMonth(), 1));
        }
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
      const pendingQueue = useOfflineStore.getState().queue || [];
      const todayCache = cacheState.today || {};
      const ttStore = cacheState.timetable;
      const activeSlots: any[] = Array.isArray(ttStore) ? ttStore : (ttStore?.slots || []);
      const archivedVersions: any[] = (!Array.isArray(ttStore) && ttStore?.archivedSlots) || cacheState.archived_timetables || [];
      // Exclude current_version (isCurrent: true) from archivedVersions so current timetable slots are never duplicated
      const archivedSlots: any[] = archivedVersions
        .filter((v: any) => !v?.isCurrent && v?.id !== "current_version")
        .flatMap((v: any) => v?.slots || []);
      const rawAllSlots = [...activeSlots, ...archivedSlots];
      const seenSlotIds = new Set<string>();
      const allSlots = rawAllSlots.filter((s: any) => {
        if (!s?.id) return true;
        if (seenSlotIds.has(s.id)) return false;
        seenSlotIds.add(s.id);
        return true;
      });
      const allEvents: any[] = cacheState.semester?.events || (useAttendanceStore.getState().events as any) || [];

      if (allLogs.length === 0 && allSlots.length === 0 && allEvents.length === 0 && Object.keys(todayCache).length === 0) {
        return null;
      }

      // Determine Last Teaching Day & Semester End Date so scheduled classes stop after Last Teaching Day
      const lastTeachingEvent = allEvents.find((e: any) =>
        /last\s*(teaching|working)\s*day/i.test(String(e.title || ""))
      );
      const simBounds = useAttendanceStore.getState().simulationBounds;
      const activeSem =
        cacheState.semester?.activeSemester ||
        (!Array.isArray(ttStore) ? ttStore?.activeSemester : null);
      const lastTeachingDateKey = lastTeachingEvent
        ? String(lastTeachingEvent.endDate || lastTeachingEvent.date || "").slice(0, 10)
        : simBounds?.endDate
          ? String(simBounds.endDate).slice(0, 10)
          : null;
      const semEndDateKey = activeSem?.endDate ? String(activeSem.endDate).slice(0, 10) : null;
      const semStartDateKey = activeSem?.startDate ? String(activeSem.startDate).slice(0, 10) : null;
      const commencementEvent = allEvents.find((e: any) =>
        /commencement\s*of\s*classes/i.test(String(e.title || ""))
      );
      const commencementDateKey = commencementEvent
        ? String(commencementEvent.date || "").slice(0, 10)
        : semStartDateKey;

      const [year, m] = monthStr.split("-").map(Number);
      const startDate = new Date(year, m - 1, 1);
      const endDate = new Date(year, m, 0);
      const todayStr = format(new Date(), "yyyy-MM-dd");

      const days: Record<string, string> = {};
      const details: Record<string, DayDetail[]> = {};
      const eventsMap: Record<string, CalendarEvent[]> = {};
      const dayStats = { not_marked: 0, off: 0, missed: 0, attended: 0, mixed: 0 };
      const lectureStats = { off: 0, missed: 0, attended: 0, total: 0, percentage: 0 };
      const cachedMonthDetails = cacheState.calendar?.[monthStr]?.details || {};

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
            })),
          );
        }

        const dayLogs = allLogs.filter(
          (l: any) => matchLogDate(l.date, dateStr),
        );
        const cachedDayDetails: any[] = cachedMonthDetails[dateStr] || [];
        const todayEntry = todayCache[dateStr];
        const queueForDate = pendingQueue.filter((q: any) => {
          const p = q.data || (q as any).payload;
          return (
            p &&
            (p.date === dateStr ||
              String(p.date || "").slice(0, 10) === dateStr)
          );
        });

        const isBeforeSemester = Boolean(commencementDateKey && dateStr < commencementDateKey);
      const isPastTeachingDay =
        Boolean(lastTeachingDateKey && dateStr > lastTeachingDateKey) ||
        Boolean(semEndDateKey && dateStr > semEndDateKey);

      const isClassSuspendedByEvent = dayEvents.some((ev: any) => {
        const t = String(ev.eventType || ev.type || "").toLowerCase();
        const title = String(ev.title || "").toLowerCase();
        const isSuspended =
          t === "holiday" ||
          t === "vacation" ||
          t === "exam" ||
          t === "midsem" ||
          t === "endsem" ||
          /holiday|vacation|break|recess|exam|midsem|endsem/i.test(title);
        const isRestricted = t.includes("restricted") || title.includes("restricted");
        return isSuspended && !isRestricted;
      });

      const hasArchivedSlotForSubjectOnDay = (subId: string) =>
        allSlots.some((s: any) => {
          if (!s.validUntil || (s.subjectId !== subId && s.subject?.id !== subId)) return false;
          const fromKey = s.validFrom
            ? String(s.validFrom).slice(0, 10)
            : "0000-00-00";
          const untilKey = String(s.validUntil).slice(0, 10);
          return fromKey <= dateStr && untilKey >= dateStr;
        });

      const rawDaySlots = (isPastTeachingDay || isBeforeSemester || isClassSuspendedByEvent)
        ? []
        : allSlots.filter((s: any) => {
            if (s.dayOfWeek !== dbDay) return false;
            const fromKey = s.validFrom
              ? String(s.validFrom).slice(0, 10)
              : "0000-00-00";
            if (fromKey > dateStr) return false;
            const subId = s.subjectId || s.subject?.id;
            if (s.validUntil) {
              const untilKey = String(s.validUntil).slice(0, 10);
              if (untilKey < dateStr) return false;
            } else if (subId && hasArchivedSlotForSubjectOnDay(subId)) {
              return false;
            }
            return true;
          });

        // Deduplicate overlapping daySlots by subjectId and time window (matching server logic)
        const daySlots: any[] = [];
        const seenDaySlotWindows = new Set<string>();
        const sortedRawDaySlots = [...rawDaySlots].sort(
          (a: any, b: any) =>
            new Date(b.validFrom || 0).getTime() -
            new Date(a.validFrom || 0).getTime(),
        );
        for (const s of sortedRawDaySlots) {
          const subKey =
            s.subjectId ||
            s.subject?.id ||
            s.subjectName ||
            s.subject?.name ||
            "";
          const timeKey = `${subKey}_${String(s.startTime || "").trim()}_${String(s.endTime || "").trim()}`;
          if (!seenDaySlotWindows.has(timeKey)) {
            seenDaySlotWindows.add(timeKey);
            daySlots.push(s);
          }
        }
        daySlots.sort((a: any, b: any) =>
          String(a.startTime || "99:99").localeCompare(
            String(b.startTime || "99:99"),
          ),
        );

        // 1. Determine effective day details: initialize from authoritative todayCache agenda, or daySlots
        let effectiveDayDetails: DayDetail[];
        if (todayEntry?.agenda && Array.isArray(todayEntry.agenda) && todayEntry.agenda.length > 0) {
          effectiveDayDetails = todayEntry.agenda.map((a: any, idx: number) => ({
            id: a.attendanceId || a.id || `today-${idx}`,
            subjectId: a.subject?.id,
            subjectName: a.subject?.name || "Class",
            startTime: a.startTime || "00:00",
            endTime: a.endTime || "00:00",
            status: String(a.status || (dateStr > todayStr ? "future" : "not_marked")).toLowerCase(),
            remarks: a.remarks || null,
            isExtra: Boolean(a.isExtra || a.overrideType === "extra_class" || (a.type === "override" && a.isExtra)),
          }));
        } else {
          effectiveDayDetails = daySlots.map((s: any, idx: number) => ({
            id: s.id || `slot-${idx}`,
            subjectId: s.subjectId || s.subject?.id,
            subjectName: s.subjectName || s.subject?.name || "Subject",
            startTime: s.startTime || "00:00",
            endTime: s.endTime || "00:00",
            status: dateStr > todayStr ? "future" : "not_marked",
            remarks: null,
            isExtra: false,
          }));
        }

        if (
          !isPastTeachingDay &&
          !isBeforeSemester &&
          !isClassSuspendedByEvent &&
          effectiveDayDetails.length === 0 &&
          cachedDayDetails.length > 0
        ) {
          effectiveDayDetails = [...cachedDayDetails];
        }

        // Overlay dayLogs from subject_logs / historyLogs (keeping extra classes separate from regular slots)
        if (dayLogs.length > 0) {
          const matchedDetailIndices = new Set<number>();
          for (const l of dayLogs) {
            const normSt = String(l.status || "").toLowerCase();
            const mappedSt =
              normSt === "attended"
                ? "present"
                : normSt === "missed"
                  ? "absent"
                  : normSt;
            const logIsExtra = Boolean(
              l.isExtra || (l.slotType && String(l.slotType).toLowerCase() === "extra"),
            );
            const lSlotId = l.timetableSlotId || l.slotId;
            const lTime = l.startTime || l.time;

            const matchIdx = effectiveDayDetails.findIndex((e, idx) => {
              if (matchedDetailIndices.has(idx)) return false;
              if (l.id && e.id === l.id) return true;
              if (l.overrideId && e.id === l.overrideId) return true;
              if (lSlotId && e.id === lSlotId) return true;
              // Strict invariant: An extra class log MUST NEVER match a regular timetable slot and vice-versa
              if (logIsExtra !== Boolean(e.isExtra)) return false;
              if (
                lTime &&
                lTime !== "00:00" &&
                e.startTime &&
                e.startTime !== "00:00" &&
                lTime !== e.startTime
              ) {
                return false;
              }
              return (
                (l.subjectId && e.subjectId === l.subjectId) ||
                (l.subjectName &&
                  String(e.subjectName || "")
                    .trim()
                    .toLowerCase() ===
                    String(l.subjectName || l.subject || "")
                      .trim()
                      .toLowerCase())
              );
            });

            if (matchIdx !== -1) {
              matchedDetailIndices.add(matchIdx);
              const match = effectiveDayDetails[matchIdx];
              match.id = l.id || match.id;
              match.status = mappedSt;
              match.remarks =
                l.remarks !== undefined ? l.remarks : match.remarks;
              if (lTime && lTime !== "00:00") match.startTime = lTime;
              if (l.endTime && l.endTime !== "00:00") match.endTime = l.endTime;
              match.isExtra = Boolean(match.isExtra || logIsExtra);
            } else {
              effectiveDayDetails.push({
                id:
                  l.id ||
                  l.overrideId ||
                  `log-${dateStr}-${effectiveDayDetails.length}`,
                subjectId: l.subjectId,
                subjectName: l.subjectName || l.subject || "Subject",
                startTime: lTime || "00:00",
                endTime: l.endTime || "00:00",
                status: mappedSt,
                remarks: l.remarks || null,
                isExtra: logIsExtra,
              });
            }
          }
        }

        // Overlay todayEntry if present (preserving extra classes & their startTime)
        if (todayEntry?.agenda && todayEntry.agenda.length > 0) {
          for (const a of todayEntry.agenda) {
            const aStatus = String(a.status || "").toLowerCase();
            const aIsExtra = Boolean(a.isExtra || a.overrideType === "extra_class" || (a.type === "override" && a.isExtra));
            const resolvedStatus =
              aStatus && aStatus !== "null" && aStatus !== "undefined"
                ? aStatus === "not_marked"
                  ? "not_marked"
                  : aStatus
                : dateStr > todayStr
                  ? "future"
                  : "not_marked";

            const match = effectiveDayDetails.find((e) => {
              if (a.attendanceId && e.id === a.attendanceId) return true;
              if (a.id && (e.id === a.id || e.id === `today-${a.id}`))
                return true;
              if (aIsExtra !== Boolean(e.isExtra)) return false;
              if (
                a.startTime &&
                a.startTime !== "00:00" &&
                e.startTime &&
                e.startTime !== "00:00" &&
                a.startTime !== e.startTime
              ) {
                return false;
              }
              return Boolean(a.subject?.id && e.subjectId === a.subject?.id);
            });

            if (match) {
              match.status = resolvedStatus;
              match.remarks =
                a.remarks !== undefined ? a.remarks : match.remarks;
              if (a.startTime && a.startTime !== "00:00")
                match.startTime = a.startTime;
              if (a.endTime && a.endTime !== "00:00") match.endTime = a.endTime;
              if (aIsExtra) match.isExtra = true;
              if (a.attendanceId) match.id = a.attendanceId;
            } else {
              effectiveDayDetails.push({
                id: a.attendanceId || `today-${a.id}`,
                subjectId: a.subject?.id,
                subjectName: a.subject?.name || "Class",
                startTime: a.startTime || "00:00",
                endTime: a.endTime || "00:00",
                status: resolvedStatus,
                remarks: a.remarks || null,
                isExtra: aIsExtra,
              });
            }
          }
        }

        // If todayEntry is present, it is the authoritative schedule for this date:
        // Any extra class that was deleted from today's agenda must be purged from effectiveDayDetails
        if (todayEntry?.agenda) {
          const todayAgendaExtraIds = new Set(
            todayEntry.agenda
              .filter((a: any) => Boolean(a.isExtra || a.overrideType === "extra_class" || (a.type === "override" && a.isExtra)))
              .map((a: any) => a.id),
          );
          effectiveDayDetails = effectiveDayDetails.filter((e: any) => {
            if (!e.isExtra) return true;
            if (e.id && todayAgendaExtraIds.has(e.id)) return true;
            if (e.id && todayAgendaExtraIds.has(e.id.replace(/^today-/, "")))
              return true;
            return todayEntry.agenda.some(
              (a: any) =>
                Boolean(a.isExtra || a.overrideType === "extra_class" || (a.type === "override" && a.isExtra)) &&
                a.subject?.id === e.subjectId &&
                a.startTime === e.startTime,
            );
          });
        }

        if (todayEntry?.todayStatus === "off") {
          effectiveDayDetails = effectiveDayDetails.map((item) => ({
            ...item,
            status: "off",
          }));
        }

        // Overlay pending offline mutations for this date
        if (queueForDate.length > 0) {
          for (const q of queueForDate) {
            const endpoint = String(
              (q as any).url || (q as any).endpoint || "",
            );
            const p = (q as any).data || (q as any).payload || {};
            if (endpoint.includes("/timetable/extra-class")) {
              const extraId =
                p.tempId || (q as any).tempId || `temp-extra-${q.id}`;
              const subObj = (
                useAttendanceStore.getState().subjects || []
              ).find(
                (s: any) =>
                  s.id === p.subjectId || s.subjectId === p.subjectId,
              );
              const alreadyPresent = effectiveDayDetails.some(
                (e) =>
                  e.id === extraId ||
                  e.id === `today-${extraId}` ||
                  (e.isExtra &&
                    (e.subjectId === p.subjectId ||
                      String(e.subjectName || "").trim().toLowerCase() ===
                        String(subObj?.name || "").trim().toLowerCase()) &&
                    (e.startTime === p.startTime ||
                      !p.startTime ||
                      !e.startTime ||
                      e.startTime === "00:00")),
              );
              if (!alreadyPresent) {
                effectiveDayDetails.push({
                  id: extraId,
                  subjectId: p.subjectId,
                  subjectName: subObj?.name || "Extra Class",
                  startTime: p.startTime || "09:00",
                  endTime: p.endTime || "10:00",
                  status: dateStr > todayStr ? "future" : "not_marked",
                  remarks: p.reason || "Extra Lecture",
                  isExtra: true,
                });
              } else {
                const existing = effectiveDayDetails.find(
                  (e) =>
                    e.id === extraId ||
                    e.id === `today-${extraId}` ||
                    (e.isExtra &&
                      (e.subjectId === p.subjectId ||
                        String(e.subjectName || "").trim().toLowerCase() ===
                          String(subObj?.name || "").trim().toLowerCase())),
                );
                if (existing) {
                  existing.isExtra = true;
                  if (!existing.remarks && p.reason) existing.remarks = p.reason;
                }
              }
            } else if (endpoint.includes("/attendance/mark-day")) {
              const fullDayStatus = String(p.status || "").toLowerCase();
              if (fullDayStatus === "clear") {
                effectiveDayDetails = effectiveDayDetails.map((item) => ({
                  ...item,
                  status: dateStr > todayStr ? "future" : "not_marked",
                  remarks: null,
                }));
              } else {
                effectiveDayDetails = effectiveDayDetails.map((item) => ({
                  ...item,
                  status: fullDayStatus,
                  remarks: p.remark || item.remarks,
                }));
              }
            } else if (endpoint.includes("/attendance/undo-day")) {
              effectiveDayDetails = effectiveDayDetails.map((item) => ({
                ...item,
                status: dateStr > todayStr ? "future" : "not_marked",
                remarks: null,
              }));
            } else if (endpoint.includes("/attendance/mark")) {
              const markStatus = String(p.status || "").toLowerCase();
              effectiveDayDetails = effectiveDayDetails.map((item) => {
                const matchById =
                  (p.overrideId &&
                    (item.id === p.overrideId ||
                      item.id === `today-${p.overrideId}`)) ||
                  (p.timetableSlotId &&
                    (item.id === p.timetableSlotId ||
                      item.id === `today-${p.timetableSlotId}`)) ||
                  (p.attendanceId && item.id === p.attendanceId);
                const matchBySubject =
                  !p.overrideId &&
                  !p.timetableSlotId &&
                  !item.isExtra &&
                  p.subjectId &&
                  item.subjectId === p.subjectId;
                if (matchById || matchBySubject) {
                  return {
                    ...item,
                    status:
                      markStatus === "clear"
                        ? dateStr > todayStr
                          ? "future"
                          : "not_marked"
                        : markStatus,
                    remarks: p.remarks !== undefined ? p.remarks : item.remarks,
                  };
                }
                return item;
              });
            }
          }
        }
        // Invariant: Do not downgrade genuine extra classes.
        effectiveDayDetails = effectiveDayDetails.map((item) => {
          if (item.isExtra) return item;
          return { ...item, isExtra: false };
        });

        // Strict Deduplication: Ensure at most 1 regular class per timetable slot/time and at most 1 extra class per subject/time
        const dedupedDetails: any[] = [];
        for (const item of effectiveDayDetails) {
          const itemIsExtra = Boolean(item.isExtra);
          const existing = dedupedDetails.find((d) => {
            if (Boolean(d.isExtra) !== itemIsExtra) return false;
            const sameSub =
              item.subjectId && d.subjectId
                ? item.subjectId === d.subjectId
                : String(item.subjectName || "").trim().toLowerCase() ===
                  String(d.subjectName || "").trim().toLowerCase();
            if (!sameSub) return false;
            if (
              item.startTime &&
              d.startTime &&
              item.startTime !== "00:00" &&
              d.startTime !== "00:00"
            ) {
              return item.startTime === d.startTime;
            }
            return true;
          });
          if (existing) {
            // Merge: preserve marked status over not_marked/future, and preserve non-empty remarks
            if (
              (!existing.status ||
                existing.status === "not_marked" ||
                existing.status === "future") &&
              item.status &&
              item.status !== "not_marked" &&
              item.status !== "future"
            ) {
              existing.status = item.status;
              existing.id = item.id || existing.id;
            }
            if (!existing.remarks && item.remarks) {
              existing.remarks = item.remarks;
            }
          } else {
            dedupedDetails.push({ ...item });
          }
        }
        effectiveDayDetails = dedupedDetails;

        if (effectiveDayDetails.length > 0) {
          details[dateStr] = sortDayDetailsChronologically(
            effectiveDayDetails,
            dateStr,
          );
        }

        // 2. Calculate day status accurately
        let status = dateStr > todayStr ? "future" : "not_marked";
        const fullDayMutations = queueForDate.filter(
          (q: any) =>
            String(q.url || q.endpoint || "").includes(
              "/attendance/mark-day",
            ) ||
            String(q.url || q.endpoint || "").includes("/attendance/undo-day"),
        );
        const latestFullDayMut: any =
          fullDayMutations[fullDayMutations.length - 1];
        const latestFullDayStatus = latestFullDayMut
          ? String(
              latestFullDayMut.data?.status ||
                latestFullDayMut.payload?.status ||
                "",
            ).toLowerCase()
          : null;
        const isQueuedOff = latestFullDayStatus === "off";
        const isQueuedClear =
          latestFullDayStatus === "clear" ||
          String(
            latestFullDayMut?.url || latestFullDayMut?.endpoint || "",
          ).includes("/attendance/undo-day");
        if (effectiveDayDetails.length > 0) {
          let presentCount = 0;
          let absentCount = 0;
          let offCount = 0;
          let markedCount = 0;

          for (const l of effectiveDayDetails) {
            const st = String(l.status || "").toLowerCase();
            if (
              st &&
              st !== "not_marked" &&
              st !== "future" &&
              st !== "clear"
            ) {
              markedCount++;
              if (["present", "attended", "medical", "od"].includes(st)) {
                presentCount++;
                lectureStats.attended++;
              } else if (["absent", "missed"].includes(st)) {
                absentCount++;
                lectureStats.missed++;
              } else if (["off", "cancelled"].includes(st)) {
                offCount++;
                lectureStats.off++;
              }
            }
          }
          const totalClasses = effectiveDayDetails.length;
          const isFullyMarked =
            totalClasses > 0 && markedCount === totalClasses;

          if (isQueuedClear) {
            status = dateStr > todayStr ? "future" : "not_marked";
          } else if (isFullyMarked) {
            if (presentCount > 0 && absentCount > 0) {
              status = "mixed";
            } else if (presentCount > 0) {
              status = "attended";
            } else if (absentCount > 0) {
              status = "missed";
            } else if (
              offCount > 0 ||
              isQueuedOff ||
              todayEntry?.todayStatus === "off"
            ) {
              status = "off";
            } else {
              status = dateStr > todayStr ? "future" : "not_marked";
            }
          } else {
            // Any unmarked class forces grey dot (not_marked / future)
            status = dateStr > todayStr ? "future" : "not_marked";
          }
        } else {
         // True 0-lecture days: weekends, post-teaching days, and non-class days are ALWAYS off (Yellow Dot)
          status = "off";
        }

        days[dateStr] = status;
        if (status === "not_marked" || status === "future")
          dayStats.not_marked++;
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
      const cachedMonth = latestCalendarCache?.[monthStr];
      const cachedDetailsLists = cachedMonth?.details ? Object.values(cachedMonth.details) as any[] : [];
      const isCachedMonthMissingStartTimes =
        navigator.onLine &&
        cachedDetailsLists.length > 0 &&
        cachedDetailsLists.some((arr: any) => Array.isArray(arr) && arr.length > 0 && !arr[0]?.startTime);

      if (cachedMonth) {
        setData(cachedMonth);
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

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const offlineBase: CalendarData = cachedMonth
          ? JSON.parse(JSON.stringify(cachedMonth))
          : buildLocalMonthPreview(monthStr) || {
              hasCalendar: false,
              days: {},
              details: {},
              events: {},
              stats: {
                days: { not_marked: 0, off: 0, missed: 0, attended: 0, mixed: 0 },
                lectures: { off: 0, missed: 0, attended: 0, total: 0, percentage: 0 },
              },
            };
        const offlineQueue = useOfflineStore.getState().queue || [];
        const offlineToday = useCacheStore.getState().today || {};
        const todayStrOff = format(new Date(), "yyyy-MM-dd");

        const offlineDays = offlineBase.days ?? {};
        const offlineDetails = offlineBase.details ?? {};
        offlineBase.days = offlineDays;
        offlineBase.details = offlineDetails;

        Object.keys(offlineToday)
          .filter((dateStr) => dateStr.startsWith(monthStr))
          .forEach((dateStr) => {
            const entry = offlineToday[dateStr];
            if (entry?.agenda && entry.agenda.length > 0) {
              offlineDetails[dateStr] = entry.agenda.map((a: any, idx: number) => ({
                id: a.attendanceId || `today-${a.id || idx}`,
                timetableSlotId: a.type === "slot" ? a.id : a.timetableSlotId,
                overrideId: a.type === "override" ? a.id : a.overrideId,
                subjectId: a.subject?.id,
                subjectName: a.subject?.name || "Class",
                startTime: a.startTime || "00:00",
                endTime: a.endTime || "00:00",
                status: String(a.status || "not_marked").toLowerCase(),
                remarks: a.remarks || null,
                isExtra: Boolean(a.isExtra || a.overrideType === "extra_class" || (a.type === "override" && a.isExtra)),
              }));
            }
          });

        // Apply extra-class deletions across all days regardless of payload.date
        offlineQueue.forEach((q: any) => {
          const ep = String(q.url || "");
          if (ep.includes("/timetable/extra-class") && String(q.method || "").toLowerCase() === "delete") {
            const deletedId = ep.split("/").pop();
            if (deletedId) {
              Object.keys(offlineDetails).forEach((dKey) => {
                offlineDetails[dKey] = (offlineDetails[dKey] || []).filter(
                  (item: any) => item.id !== deletedId && item.id !== `today-${deletedId}` && item.overrideId !== deletedId,
                );
              });
            }
          }
        });

        const dayCountsOff = { not_marked: 0, off: 0, missed: 0, attended: 0, mixed: 0 };
        const lecCountsOff = { off: 0, missed: 0, attended: 0, total: 0, percentage: 0 };
        Object.keys(offlineDetails).forEach((dateStr) => {
          if (!dateStr.startsWith(monthStr)) return;
          const items = offlineDetails[dateStr] || [];
          const marked = items.filter((l: any) => {
            const st = String(l.status || "").toLowerCase();
            return st && st !== "not_marked" && st !== "future" && st !== "clear";
          });
          if (items.length > 0 && marked.length === items.length) {
            const hasAtt = marked.some((l: any) => ["present", "attended", "medical", "od"].includes(String(l.status).toLowerCase()));
            const hasMiss = marked.some((l: any) => ["absent", "missed"].includes(String(l.status).toLowerCase()));
            const allOff = marked.every((l: any) => ["off", "cancelled"].includes(String(l.status).toLowerCase()));
            offlineDays[dateStr] = allOff ? "off" : hasAtt && hasMiss ? "mixed" : hasAtt ? "attended" : hasMiss ? "missed" : "off";
          } else if (items.length > 0) {
            offlineDays[dateStr] = dateStr > todayStrOff ? "future" : "not_marked";
          }
          marked.forEach((l: any) => {
            const st = String(l.status || "").toLowerCase();
            if (["present", "attended", "medical", "od"].includes(st)) lecCountsOff.attended++;
            else if (["absent", "missed"].includes(st)) lecCountsOff.missed++;
            else if (["off", "cancelled"].includes(st)) lecCountsOff.off++;
          });
        });
        Object.values(offlineBase.days).forEach((st: any) => {
          if (st === "attended") dayCountsOff.attended++;
          else if (st === "missed") dayCountsOff.missed++;
          else if (st === "mixed") dayCountsOff.mixed++;
          else if (st === "off") dayCountsOff.off++;
          else dayCountsOff.not_marked++;
        });
        lecCountsOff.total = lecCountsOff.attended + lecCountsOff.missed;
        lecCountsOff.percentage = lecCountsOff.total > 0 ? (lecCountsOff.attended / lecCountsOff.total) * 100 : 0;
        offlineBase.stats = { days: dayCountsOff, lectures: lecCountsOff };

        setData(offlineBase);
        setCache("calendar", { ...(useCacheStore.getState().calendar || {}), [monthStr]: offlineBase });
        setIsLoading(false);
        return offlineBase;
      }

      // Ensure archived timetables are cached so historical month previews resolve archived slot startTimes accurately
      const cacheState = useCacheStore.getState();
      if (!cacheState.archived_timetables || !Array.isArray(cacheState.archived_timetables) || cacheState.archived_timetables.length === 0) {
        const semId =
          cacheState.semester?.activeSemester?.id ||
          (cacheState.timetable as any)?.activeSemester?.id ||
          useAttendanceStore.getState().activeSemesterId ||
          "active";
        api
          .get(`/timetable/semester/${semId}/archived`)
          .then((archRes) => {
            if (Array.isArray(archRes.data) && archRes.data.length > 0) {
              useCacheStore.getState().setCache("archived_timetables", archRes.data);
            }
          })
          .catch(() => {});
      }
      
      const shouldForce = force || isCachedMonthMissingStartTimes;
      const res = await api.get(`/attendance/calendar?month=${monthStr}${shouldForce ? '&force=true' : ''}`, {
        signal: controller.signal
      });
      let d = typeof res.data === 'string' ? { days: [], insights: [], events: [], isComplete: false, completionPercentage: 0, requiredClassesToTarget: 0, canBunk: false } : res.data;
      
      // MERGE OFFLINE QUEUE & TODAYPAGE CACHE OVER THE API RESPONSE
      const pendingQueue = useOfflineStore.getState().queue || [];
      const hasPendingOfflineQueue = pendingQueue.length > 0;
      const todayState = useCacheStore.getState().today || {};
      const datesWithTodayData = Object.keys(todayState).filter(dateStr => dateStr.startsWith(monthStr));

      const allLogs: any[] =
        useCacheStore.getState().subject_logs?.["all"]?.logs ||
        useAttendanceStore.getState().historyLogs ||
        [];
      const monthLogs = allLogs.filter((l: any) => String(l.date || "").startsWith(monthStr));


        if (!d.days) d.days = {};
        if (!d.details) d.details = {};
        const todayStr = format(new Date(), "yyyy-MM-dd");

        // Merge todayState entries for this month
        datesWithTodayData.forEach((dateStr) => {
          const hasQueueForDate = pendingQueue.some((q: any) => {
            const p = q.data || q.payload || {};
            return String(p.date || "").slice(0, 10) === dateStr;
          });
          if (!hasQueueForDate) return; // Authoritative online server data takes precedence when caught up!

          const entry = todayState[dateStr];
          if (entry?.agenda && entry.agenda.length > 0) {
              const mapped = entry.agenda.map((a: any, idx: number) => ({
              id: a.attendanceId || `today-${a.id || idx}`,
              timetableSlotId: a.type === "slot" ? a.id : a.timetableSlotId,
              overrideId: a.type === "override" ? a.id : a.overrideId,
              subjectId: a.subject?.id,
              subjectName: a.subject?.name || "Class",
              startTime: a.startTime || "00:00",
              endTime: a.endTime || "00:00",
              status: String(a.status || "not_marked").toLowerCase(),
              remarks: a.remarks || null,
              isExtra: Boolean(a.isExtra || a.overrideType === "extra_class" || (a.type === "override" && a.isExtra)),
            }));

            d.details[dateStr] = mapped;
 

              const totalClasses = entry.agenda.length;
            const markedItems = entry.agenda.filter((a: any) => {
              const st = String(a.status || "").toLowerCase();
              return st && st !== "not_marked" && st !== "future" && st !== "clear";
            });
            const isFullyMarked = totalClasses > 0 && markedItems.length === totalClasses;

            if (isFullyMarked) {
              const hasAttended = markedItems.some((a: any) => ["present", "medical", "od"].includes(String(a.status).toLowerCase()));
              const hasMissed = markedItems.some((a: any) => ["absent", "missed"].includes(String(a.status).toLowerCase()));
              const allOff = markedItems.every((a: any) => ["off", "cancelled"].includes(String(a.status).toLowerCase()));
              if (hasAttended && hasMissed) {
                d.days[dateStr] = "mixed";
              } else if (hasAttended) {
                d.days[dateStr] = "attended";
              } else if (hasMissed) {
                d.days[dateStr] = "missed";
              } else if (allOff || entry.todayStatus === "off") {
                d.days[dateStr] = "off";
              } else {
                d.days[dateStr] = dateStr > todayStr ? "future" : "not_marked";
              }
            } else {
              d.days[dateStr] = dateStr > todayStr ? "future" : "not_marked";
            }
          }
        });

        // Overlay extra-class deletions across all days regardless of payload.date
        pendingQueue.forEach((q: any) => {
          const endpoint = String((q as any).url || (q as any).endpoint || "");
          if (
            endpoint.includes("/timetable/extra-class") &&
            String(q.method || "").toLowerCase() === "delete"
          ) {
            const deletedId = endpoint.split("/").pop();
            if (deletedId) {
              Object.keys(d.details).forEach((dKey) => {
                d.details[dKey] = (d.details[dKey] || []).filter(
                  (item: any) =>
                    item.id !== deletedId &&
                    item.id !== `today-${deletedId}` &&
                    item.overrideId !== deletedId,
                );
              });
            }
          }
        });

        // Overlay pending queue mutations for this month
        pendingQueue.forEach((q: any) => {
          const p = (q as any).data || (q as any).payload || {};
          const dateStr = String(p.date || "").slice(0, 10);
          if (!dateStr.startsWith(monthStr)) return;

          let dayDetails = d.details[dateStr] ? [...d.details[dateStr]] : [];
          const endpoint = String((q as any).url || (q as any).endpoint || "");

          if (
            (endpoint.includes("/timetable/extra-class/") ||
              endpoint.includes("/timetable/extra-class")) &&
            String(q.method || "").toLowerCase() === "delete"
          ) {
            const deletedId = endpoint.split("/").pop();
            dayDetails = dayDetails.filter(
              (item) => item.id !== deletedId && item.id !== `today-${deletedId}`
            );
          } else if (endpoint.includes("/timetable/extra-class")) {
            const extraId = p.tempId || (q as any).tempId || `temp-extra-${q.id}`;
            const subObj = (useAttendanceStore.getState().subjects || []).find(
              (s: any) => s.id === p.subjectId || s.subjectId === p.subjectId
            );
            const alreadyPresent = dayDetails.some(
              (e) =>
                e.id === extraId ||
                e.id === `today-${extraId}` ||
                (e.isExtra &&
                  (e.subjectId === p.subjectId ||
                    String(e.subjectName || "").trim().toLowerCase() ===
                      String(subObj?.name || "").trim().toLowerCase()) &&
                  (e.startTime === p.startTime ||
                    !p.startTime ||
                    !e.startTime ||
                    e.startTime === "00:00"))
            );
            if (!alreadyPresent) {
              dayDetails.push({
                id: extraId,
                subjectId: p.subjectId,
                subjectName: subObj?.name || "Extra Class",
                startTime: p.startTime || "09:00",
                endTime: p.endTime || "10:00",
                status: dateStr > todayStr ? "future" : "not_marked",
                remarks: p.reason || "Extra Lecture",
                isExtra: true,
              });
            } else {
              const existing = dayDetails.find(
                (e) =>
                  e.id === extraId ||
                  e.id === `today-${extraId}` ||
                  (e.isExtra &&
                    (e.subjectId === p.subjectId ||
                      String(e.subjectName || "").trim().toLowerCase() ===
                        String(subObj?.name || "").trim().toLowerCase()))
              );
              if (existing) {
                existing.isExtra = true;
                if (!existing.remarks && p.reason) existing.remarks = p.reason;
              }
            }
          } else if (endpoint.includes("/attendance/mark-day")) {
            const fullDayStatus = String(p.status || "").toLowerCase();
            if (fullDayStatus === "clear") {
              dayDetails = dayDetails.map(item => ({ ...item, status: dateStr > todayStr ? "future" : "not_marked", remarks: null }));
              d.days[dateStr] = dateStr > todayStr ? "future" : "not_marked";
            } else {
              dayDetails = dayDetails.map(item => ({ ...item, status: fullDayStatus, remarks: p.remark || item.remarks }));
              d.days[dateStr] = fullDayStatus === "present" ? "attended" : fullDayStatus === "absent" ? "missed" : fullDayStatus;
            }
          } else if (endpoint.includes("/attendance/undo-day")) {
            dayDetails = dayDetails.map(item => ({ ...item, status: dateStr > todayStr ? "future" : "not_marked", remarks: null }));
            d.days[dateStr] = dateStr > todayStr ? "future" : "not_marked";
          } else if (endpoint.includes("/attendance/mark")) {
            const markStatus = String(p.status || "").toLowerCase();
            dayDetails = dayDetails.map(item => {
              const matchById =
                (p.overrideId &&
                  (item.id === p.overrideId ||
                    item.id === `today-${p.overrideId}`)) ||
                (p.timetableSlotId &&
                  (item.id === p.timetableSlotId ||
                    item.id === `today-${p.timetableSlotId}`)) ||
                (p.attendanceId && item.id === p.attendanceId);
              const matchByExtraSubject =
                !p.overrideId &&
                !p.timetableSlotId &&
                Boolean(item.isExtra) &&
                p.subjectId &&
                item.subjectId === p.subjectId;
              const matchByRegularSubject =
                !p.overrideId &&
                !p.timetableSlotId &&
                !item.isExtra &&
                p.subjectId &&
                item.subjectId === p.subjectId;
              const match =
                matchById ||
                (p.overrideId ? matchByExtraSubject : matchByRegularSubject);
              if (match) {
                return {
                  ...item,
                  status: markStatus === "clear" ? (dateStr > todayStr ? "future" : "not_marked") : markStatus,
                  remarks: p.remarks !== undefined ? p.remarks : item.remarks,
                };
              }
              return item;
            });
          }

          // Strict Deduplication across dayDetails
          const dedupedQueueDetails: any[] = [];
          for (const item of dayDetails) {
            const itemIsExtra = Boolean(item.isExtra);
            const existing = dedupedQueueDetails.find((d) => {
              if (Boolean(d.isExtra) !== itemIsExtra) return false;
              const sameSub =
                item.subjectId && d.subjectId
                  ? item.subjectId === d.subjectId
                  : String(item.subjectName || "").trim().toLowerCase() ===
                    String(d.subjectName || "").trim().toLowerCase();
              if (!sameSub) return false;
              if (
                item.startTime &&
                d.startTime &&
                item.startTime !== "00:00" &&
                d.startTime !== "00:00"
              ) {
                return item.startTime === d.startTime;
              }
              return true;
            });
            if (existing) {
              if (
                (!existing.status ||
                  existing.status === "not_marked" ||
                  existing.status === "future") &&
                item.status &&
                item.status !== "not_marked" &&
                item.status !== "future"
              ) {
                existing.status = item.status;
                existing.id = item.id || existing.id;
              }
              if (!existing.remarks && item.remarks) {
                existing.remarks = item.remarks;
              }
            } else {
              dedupedQueueDetails.push({ ...item });
            }
          }
          dayDetails = dedupedQueueDetails;

          if (dayDetails.length > 0) {
            d.details[dateStr] = sortDayDetailsChronologically(dayDetails, dateStr);
              const totalClasses = dayDetails.length;
              const markedDetails = dayDetails.filter((l: any) => {
              const s = (l.status || '').toLowerCase();
              const isUnmarkedId = typeof l.id === 'string' && l.id.startsWith('unmarked-');
              return !isUnmarkedId && s && s !== 'not_marked' && s !== 'future' && s !== 'clear';
              });
            const isFullyMarked = totalClasses > 0 && markedDetails.length === totalClasses;

            if (isFullyMarked) {
              const hasAttended = markedDetails.some((l: any) => ['present', 'attended', 'medical', 'od'].includes(l.status.toLowerCase()));
              const hasMissed = markedDetails.some((l: any) => ['absent', 'missed'].includes(l.status.toLowerCase()));
              const allOff = markedDetails.every((l: any) => ['off', 'cancelled'].includes(l.status.toLowerCase()));
              
              if (allOff) {
                d.days[dateStr] = "off";
              } else if (hasAttended && hasMissed) {
                d.days[dateStr] = "mixed";
              } else if (hasAttended) {
                d.days[dateStr] = "attended";
              } else if (hasMissed) {
                d.days[dateStr] = "missed";
              } else {
                d.days[dateStr] = "off";
              }
            } else {
              d.days[dateStr] = dateStr > todayStr ? "future" : "not_marked";
            }
          }
        });
            // Auto-reconcile d.days and stats with actual marked items from d.details
      if (d && d.details) {
        if (!d.days) d.days = {};
        Object.entries(d.details).forEach(([dateStr, items]: [string, any]) => {
          if (!Array.isArray(items) || items.length === 0) return;
          const totalClasses = items.length;
          const marked = items.filter((l: any) => {
            const st = String(l.status || "").toLowerCase();
            return st && st !== "not_marked" && st !== "future" && st !== "clear";
          });
          const isFullyMarked = totalClasses > 0 && marked.length === totalClasses;
          if (isFullyMarked) {
            const hasAtt = marked.some((l: any) => ["present", "attended", "medical", "od"].includes(String(l.status).toLowerCase()));
            const hasMiss = marked.some((l: any) => ["absent", "missed"].includes(String(l.status).toLowerCase()));
            const allOff = marked.every((l: any) => ["off", "cancelled"].includes(String(l.status).toLowerCase()));
            if (hasAtt && hasMiss) d.days[dateStr] = "mixed";
            else if (hasAtt) d.days[dateStr] = "attended";
            else if (hasMiss) d.days[dateStr] = "missed";
            else if (allOff) d.days[dateStr] = "off";
            } else {
            // If day has an event suspending classes (Exam/Holiday) but no marked logs, it is Off
            const dayEvents = (d.events?.[dateStr] || []) as any[];
            const isSuspended = dayEvents.some((ev: any) => {
              const t = String(ev.eventType || ev.type || "").toLowerCase();
              const title = String(ev.title || "").toLowerCase();
              return ["holiday", "vacation", "exam", "midsem", "endsem"].includes(t) ||
                /holiday|vacation|break|recess|exam|midsem|endsem/i.test(title);
            });
            if ((isSuspended || totalClasses === 0) && marked.length === 0) {
              d.days[dateStr] = "off";
            } else {
              d.days[dateStr] = dateStr > todayStr ? "future" : "not_marked";
            }
          }
        });

        const dayCounts = { not_marked: 0, off: 0, missed: 0, attended: 0, mixed: 0 };
        const lecCounts = { off: 0, missed: 0, attended: 0, total: 0, percentage: 0 };
        Object.values(d.details).forEach((items: any) => {
          if (!Array.isArray(items)) return;
          items.forEach((l: any) => {
            const st = String(l.status || "").toLowerCase();
            if (["present", "attended", "medical", "od"].includes(st)) lecCounts.attended++;
            else if (["absent", "missed"].includes(st)) lecCounts.missed++;
            else if (["off", "cancelled"].includes(st)) lecCounts.off++;
          });
        });
        lecCounts.total = lecCounts.attended + lecCounts.missed;
        lecCounts.percentage = lecCounts.total > 0 ? (lecCounts.attended / lecCounts.total) * 100 : 0;
        Object.values(d.days).forEach((st: any) => {
          if (st === "attended") dayCounts.attended++;
          else if (st === "missed") dayCounts.missed++;
          else if (st === "mixed") dayCounts.mixed++;
          else if (st === "off") dayCounts.off++;
          else dayCounts.not_marked++;
        });
        d.stats = { ...(d.stats || {}), days: dayCounts, lectures: lecCounts };
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
      case "attended":
        return "bg-emerald-500";
      case "missed":
        return "bg-rose-500";
      case "mixed":
        return "bg-purple-500";
      case "off":
        return "bg-yellow-500";
      case "not_marked":
        case "future":
        return "bg-muted-foreground/60";
      default:
        return "bg-muted-foreground/20";
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
        className="grid grid-cols-7 gap-x-1.5 sm:gap-x-2.5 gap-y-3 sm:gap-y-4 text-center mb-6"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
          <div key={d} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{d}</div>
        ))}

        {calendarDays.map((d, i) => {
          const dateKey = format(d, "yyyy-MM-dd");
          const todayStr = format(new Date(), "yyyy-MM-dd");
          const isFuture = dateKey > todayStr;
          const status = days[dateKey];
          const isCurrentMonth = isSameMonth(d, currentDate);
          const isToday = isSameDay(d, new Date());
          const dayDetails = sortDayDetailsChronologically(details[dateKey] || [], dateKey);
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
                  className={`flex flex-col items-center justify-between py-1.5 relative w-full max-w-[38px] sm:max-w-[50px] min-h-[52px] h-[52px] sm:h-14 hover:bg-muted/60 rounded-xl sm:rounded-2xl transition-all cursor-pointer group ring-inset ${animBorder}`}
                >
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-xs sm:text-sm font-semibold transition-transform group-hover:scale-105 ${
                      isToday
                        ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20"
                        : "text-foreground"
                    }`}
                  >
                    {format(d, "d")}
                  </div>
                  <div className="h-2 flex items-center justify-center gap-1">
                    {status && (
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${getDotColor(status)} shrink-0`}
                      />
                    )}
                    {hasRemarks && (
                      <MessageSquare className="w-2.5 h-2.5 text-primary shrink-0" />
                    )}
                    {!animBorder && dedupedDayEvents.length > 0 && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${getEventOptimumStyle(dedupedDayEvents[0]).dot} shrink-0`}
                        title={dedupedDayEvents[0].title}
                      />
                    )}
                  </div>

                  {/* Hover Agenda Tooltip (Hidden on Mobile) */}
                  <div
                    className={`absolute ${Math.floor(i / 7) <= 1 ? "top-full mt-2 origin-top" : "bottom-full mb-2 origin-bottom"} ${i % 7 === 0 ? "left-0" : i % 7 === 6 ? "right-0" : "left-1/2 -translate-x-1/2"} w-64 bg-card border border-border rounded-xl shadow-2xl p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-auto hidden sm:flex flex-col gap-2 text-left scale-95 group-hover:scale-100 max-h-[350px] overflow-y-auto custom-scrollbar`}
                  >
                    {/* Header */}
                    <div className="flex justify-between items-center pb-2 border-b border-border/50">
                      <span className="font-bold text-sm text-foreground">
                        {format(d, "d MMM")}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          status === "attended"
                            ? "bg-emerald-500/20 text-emerald-500"
                            : status === "missed"
                              ? "bg-rose-500/20 text-rose-500"
                              : status === "mixed"
                                ? "bg-purple-500/20 text-purple-500"
                                : status === "off"
                                  ? "bg-yellow-500/20 text-yellow-500"
                                  : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {status === "not_marked"
                          ? dayDetails.length > 0
                            ? "Incomplete"
                            : "No Data"
                          : status === "future"
                            ? "Future"
                            : status}
                      </span>
                    </div>

                    {/* Events */}
                    {dedupedDayEvents.length > 0 && (
                      <div className="flex flex-col gap-1">
                        {dedupedDayEvents.map((e, idx) => {
                          const evStyle = getEventOptimumStyle(e);
                          return (
                            <div
                              key={idx}
                              className={`flex items-start gap-1.5 text-xs font-semibold ${evStyle.text}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${evStyle.dot} mt-1 shrink-0`}
                              />
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
                          <div
                            key={idx}
                            className="flex flex-col gap-0.5 text-xs py-0.5 border-b border-border/20 last:border-b-0"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-muted-foreground truncate pr-1 flex-1 font-medium flex items-center gap-1">
                                <span className="truncate">
                                  {detail.subjectName}
                                </span>
                                {detail.isExtra && (
                                  <span className="bg-amber-500/20 text-amber-500 border border-amber-500/30 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full uppercase tracking-wider shrink-0">
                                    Extra
                                  </span>
                                )}
                              </span>
                              <span
                                className={`font-bold shrink-0 ${
                                  detail.status === "present" ||
                                  detail.status === "attended" ||
                                  detail.status === "medical" ||
                                  detail.status === "od"
                                    ? "text-emerald-500"
                                    : detail.status === "absent" ||
                                        detail.status === "missed"
                                      ? "text-rose-500"
                                      : detail.status === "off" ||
                                          detail.status === "cancelled"
                                        ? "text-amber-500"
                                        : "text-muted-foreground"
                                }`}
                              >
                                {detail.status === "medical"
                                  ? "Medical"
                                  : detail.status === "od"
                                    ? "OD"
                                    : detail.status === "present" ||
                                        detail.status === "attended"
                                      ? "Present"
                                      : detail.status === "absent" ||
                                          detail.status === "missed"
                                        ? "Absent"
                                        : detail.status === "off" ||
                                            detail.status === "cancelled"
                                          ? "Off"
                                          : detail.status === "future" || isFuture
                                            ? "Future"
                                            : "Not Marked"}
                              </span>
                            </div>
                            {detail.remarks && (
                              <div className="flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-md truncate max-w-full">
                                <MessageSquare className="w-2.5 h-2.5 shrink-0 text-primary" />
                                <span className="truncate italic font-medium">
                                  {detail.remarks}
                                </span>
                              </div>
                            )}
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
                <div className="w-full max-w-[38px] sm:max-w-[52px] h-12 sm:h-14" />
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
                const dayDetails = sortDayDetailsChronologically(data?.details?.[selectedMobileDate] || [], selectedMobileDate);
                const dayEvents = data?.events?.[selectedMobileDate] || [];
                const status = data?.days?.[selectedMobileDate] || "not_marked";
                
                return (
                  <div className="flex flex-col gap-4 overflow-y-auto">
                    {/* Header */}
                    <div className="flex justify-between items-center pb-3 border-b border-border">
                      <h3 className="text-xl font-bold text-foreground">
                        {format(
                          new Date(selectedMobileDate + "T00:00:00"),
                          "MMMM d, yyyy",
                        )}
                      </h3>
                      <span
                        className={`text-xs uppercase font-bold px-2 py-1 rounded ${
                          status === "attended"
                            ? "bg-emerald-500/20 text-emerald-500"
                            : status === "missed"
                              ? "bg-rose-500/20 text-rose-500"
                              : status === "mixed"
                                ? "bg-purple-500/20 text-purple-500"
                                : status === "off"
                                  ? "bg-yellow-500/20 text-yellow-500"
                                  : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {status === "not_marked"
                          ? dayDetails.length > 0
                            ? "Incomplete"
                            : "No Data"
                          : status}
                      </span>
                    </div>

                    {/* Events */}
                    {dayEvents.length > 0 && (
                      <div className="flex flex-col gap-2 mb-2">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Events
                        </h4>
                        {deduplicateCalendarEvents(dayEvents).map((e, idx) => {
                          const evStyle = getEventOptimumStyle(e);
                          return (
                            <div
                              key={idx}
                              className={`flex items-start gap-2 text-sm font-semibold p-2.5 rounded-xl border ${evStyle.pill}`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${evStyle.dot} mt-1.5 shrink-0`}
                              />
                              <span className="leading-tight">{e.title}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Subjects Agenda */}
                    {dayDetails.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Classes
                        </h4>
                        {dayDetails.map((detail, idx) => (
                          <div
                            key={idx}
                            className="flex flex-col gap-1.5 text-sm bg-muted/30 p-2.5 rounded-xl border border-border"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-foreground font-medium truncate pr-2 flex-1 flex items-center gap-1.5">
                                <span className="truncate">
                                  {detail.subjectName}
                                </span>
                                {detail.isExtra && (
                                  <span className="bg-amber-500/20 text-amber-500 border border-amber-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                    Extra
                                  </span>
                                )}
                              </span>
                              <span
                                className={`font-bold shrink-0 ${
                                  detail.status === "present" ||
                                  detail.status === "attended" ||
                                  detail.status === "medical" ||
                                  detail.status === "od"
                                    ? "text-emerald-500"
                                    : (
                                          detail.status === "absent" ||
                                          detail.status === "missed"
                                        )
                                      ? "text-rose-500"
                                      : (
                                            detail.status === "off" ||
                                            detail.status === "cancelled"
                                          )
                                        ? "text-amber-500"
                                        : "text-muted-foreground"
                                }`}
                              >
                                {detail.status === "medical"
                                  ? "Medical"
                                  : detail.status === "od"
                                    ? "OD"
                                    : detail.status === "present" ||
                                        detail.status === "attended"
                                      ? "Present"
                                      : (
                                            detail.status === "absent" ||
                                            detail.status === "missed"
                                          )
                                        ? "Absent"
                                        : (
                                              detail.status === "off" ||
                                              detail.status === "cancelled"
                                            )
                                          ? "Off"
                                          : (
                                                detail.status === "future" ||
                                                selectedMobileDate >
                                                  format(new Date(), "yyyy-MM-dd")
                                              )
                                            ? "Future"
                                            : "Not Marked"}
                              </span>
                            </div>
                            {detail.remarks && (
                              <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 px-2 py-1 rounded-lg border border-primary/20">
                                <MessageSquare className="w-3.5 h-3.5 shrink-0 text-primary" />
                                <span className="font-semibold italic">
                                  {detail.remarks}
                                </span>
                              </div>
                            )}
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
                        onClick={() =>
                          navigate(`/today?date=${selectedMobileDate}`)
                        }
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

