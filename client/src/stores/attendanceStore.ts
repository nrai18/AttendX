import { create } from "zustand";
import { capacitorStorage } from "./capacitorStorage";
import { persist, createJSONStorage } from "zustand/middleware";
import { api } from "../lib/api";
import { useAuthStore } from "./authStore";
import { useCacheStore, registerCacheClearListener } from "./cacheStore";
import { useOfflineStore } from "./offlineStore";

export interface SubjectStat {
  id: string;
  subjectId: string;
  name: string;
  code: string;
  colorHex?: string;
  attended: number;
  missed?: number;
  off?: number;
  total: number;
  percentage: number;
  target?: number;
  remainingClasses?: number;
  maxRemainingClasses?: number;
  missingBoundaries?: boolean;
  canMiss?: number;
  needAttend?: number;
  statusText?: string;
  futureBreakdown?: { date: string; type: 'HELD' | 'OFF' | 'LOGGED'; reason?: string; count: number; status?: string }[];
  attendance?: { date: string; status: string }[];
}

export interface AttendanceHistoryEntry {
  date: string;
  dateFormatted: string;
  subject: string;
  status: string;
  time?: string;
}
export interface CalendarEventEntry {
  id?: string;
  title: string;
  type?: string;
  date: string;
  endDate?: string;
  isHolidayList?: boolean;
  eventType?: string;
  description?: string;
}

interface AttendanceState {
  overallPercentage: number;
  targetPercentage: number;
  totalAttended: number;
  totalClasses: number;
  subjects: SubjectStat[];
  historyLogs: AttendanceHistoryEntry[];
  events: CalendarEventEntry[];
  hasActiveSemester: boolean;
  activeSemesterId: string | null;
  isLoading: boolean;
  simulationBounds: { startDate: string, endDate: string, missingBoundaries: boolean, hasCommencement: boolean, hasLastDay: boolean } | null;
  fetchStats: (background?: boolean) => Promise<void>;
  invalidateInFlightStats: () => void;
  resetAttendanceStore: () => void;
  updateSimulationBoundaries: (startDate: string, endDate: string) => Promise<void>;
}

let fetchStatsSeq = 0;
let inFlightStatsPromise: Promise<void> | null = null;
let lastStatsCompletedAt = 0;

if (typeof window !== "undefined") {
  window.addEventListener("attendance-updated", () => {
    fetchStatsSeq += 1;
    // Reset cache cooldown so subsequent fetchStats runs freshly without being blocked,
    // while preserving any actively in-flight promise to prevent concurrent duplicate queries.
    lastStatsCompletedAt = 0;
  });
}

// Client-Side Offline Projection Engine: projects remaining held classes from cached timetable & holidays
export function computeRemainingClassesOffline(
  subjects: SubjectStat[],
  activeSemester: any,
  allSlots: any[],
  events: any[],
  bounds?: { startDate: string; endDate: string } | null
): SubjectStat[] {
  if (!activeSemester || !Array.isArray(subjects) || subjects.length === 0) {
    return subjects;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startStr = (bounds?.startDate || activeSemester.startDate || "").split("T")[0];
  const endStr = (bounds?.endDate || activeSemester.endDate || "").split("T")[0];
  if (!endStr) return subjects;

  const [eY, eM, eD] = endStr.split("-").map(Number);
  const endUTC = Date.UTC(eY, eM - 1, eD);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowUTC = Date.UTC(
    tomorrow.getFullYear(),
    tomorrow.getMonth(),
    tomorrow.getDate()
  );

  const ONE_DAY_MS = 86400000;
  const holidayMap = new Map<string, { isHoliday: boolean; reason: string }>();
  for (const ev of (events || [])) {
    const evType = String(ev.eventType || ev.type || "").toLowerCase();
    const isHol =
      (ev.isHolidayList && evType !== "restricted_holiday") ||
      ["holiday", "vacation", "midsem", "endsem", "exam"].includes(evType);
    const isRestricted = evType === "restricted_holiday";
    if (!isHol && !isRestricted) continue;

    const sStr = String(ev.date || "").slice(0, 10);
    const eStr = String(ev.endDate || ev.date || "").slice(0, 10);
    if (!sStr) continue;

    const sTime = new Date(sStr + "T00:00:00Z").getTime();
    const eTime = eStr ? new Date(eStr + "T00:00:00Z").getTime() : sTime;
    for (let t = sTime; t <= eTime; t += ONE_DAY_MS) {
      const key = new Date(t).toISOString().slice(0, 10);
      if (!holidayMap.has(key) || isHol) {
        holidayMap.set(key, {
          isHoliday: isHol || isRestricted,
          reason: ev.title || "Holiday",
        });
      }
    }
  }

  const activeSlots = (allSlots || []).filter(
    (s: any) => !s.validUntil || new Date(s.validUntil) >= tomorrow
  );

  return subjects.map((sub) => {
    const subSlots = activeSlots.filter(
      (s: any) => s.subjectId === sub.id || s.subjectId === sub.subjectId
    );
    const slotsByDay = [0, 0, 0, 0, 0, 0, 0];
    for (const s of subSlots) {
      if (typeof s.dayOfWeek === "number" && s.dayOfWeek >= 0 && s.dayOfWeek < 7) {
        slotsByDay[s.dayOfWeek]++;
      }
    }

    let remainingClasses = 0;
    let maxRemainingClasses = 0;
    const futureBreakdown: any[] = [];

    if (tomorrowUTC <= endUTC) {
      for (let dUTC = tomorrowUTC; dUTC <= endUTC; dUTC += ONE_DAY_MS) {
        const dObj = new Date(dUTC);
        const dateStr = dObj.toISOString().slice(0, 10);
        const jsDay = dObj.getUTCDay();
        const dbDay = jsDay === 0 ? 6 : jsDay - 1;
        const slotsOnDay = slotsByDay[dbDay] || 0;

        if (slotsOnDay > 0) {
          const hol = holidayMap.get(dateStr);
          if (hol) {
            futureBreakdown.push({
              date: `${dateStr}T00:00:00.000Z`,
              type: "OFF",
              reason: hol.reason,
              count: slotsOnDay,
            });
            maxRemainingClasses += slotsOnDay;
          } else {
            futureBreakdown.push({
              date: `${dateStr}T00:00:00.000Z`,
              type: "HELD",
              count: slotsOnDay,
            });
            remainingClasses += slotsOnDay;
            maxRemainingClasses += slotsOnDay;
          }
        }
      }
    }

    return {
      ...sub,
      remainingClasses,
      maxRemainingClasses,
      missingBoundaries: false,
      futureBreakdown,
    };
  });
}

export const useAttendanceStore = create<AttendanceState>()(
  persist(
    (set, get) => ({
      overallPercentage: 0,
      targetPercentage: 75,
      totalAttended: 0,
      totalClasses: 0,
      subjects: [],
      historyLogs: [],
      events: [],
      hasActiveSemester: false,
      activeSemesterId: null,
      isLoading: false,
      simulationBounds: null,
      invalidateInFlightStats: () => {
        fetchStatsSeq += 1;
        inFlightStatsPromise = null;
        lastStatsCompletedAt = 0;
      },
      resetAttendanceStore: () => {
        fetchStatsSeq += 1;
        inFlightStatsPromise = null;
        lastStatsCompletedAt = 0;
        const userTarget = useAuthStore.getState().user?.targetAttendance || 75;
        set({
          overallPercentage: 0,
          targetPercentage: userTarget,
          totalAttended: 0,
          totalClasses: 0,
          subjects: [],
          historyLogs: [],
          events: [],
          hasActiveSemester: false,
          activeSemesterId: null,
          simulationBounds: null,
          isLoading: false,
        });
      },
      fetchStats: async (background = false) => {
        if (inFlightStatsPromise) {
          return inFlightStatsPromise;
        }
        if (
          Date.now() - lastStatsCompletedAt < 2500 &&
          get().hasActiveSemester &&
          get().subjects.length > 0
        ) {
          return;
        }
        const mySeq = ++fetchStatsSeq;

        // Only show loading if we don't have any cached subjects
        if (!background && get().subjects.length === 0)
          set({ isLoading: true });
        let runPromise: Promise<void> | null = null;
        runPromise = (async () => {
          try {
            const user = useAuthStore.getState().user;
            const userTarget = user?.targetAttendance || 75;

            const knownSemId =
              get().activeSemesterId ||
              useCacheStore.getState().semester?.activeSemester?.id ||
              null;

            // Fire /semesters/active and all 4 semester-scoped queries in 1 single parallel wave when semesterId is known
            const [
              activeSemSettled,
              preStatsRes,
              logsRes,
              preEventsRes,
              preTimetableRes,
            ] = await Promise.allSettled([
              api.get("/semesters/active"),
              knownSemId
                ? api.get(`/attendance/stats?semesterId=${knownSemId}`)
                : Promise.reject("no_known_sem"),
              api.get("/attendance/logs"),
              knownSemId
                ? api.get(`/events?semesterId=${knownSemId}`)
                : Promise.reject("no_known_sem"),
              knownSemId
                ? api.get(`/timetable/${knownSemId}`)
                : Promise.reject("no_known_sem"),
            ]);
            if (mySeq !== fetchStatsSeq) return;
            let activeSem = activeSemSettled.status === "fulfilled" ? activeSemSettled.value.data : null;
            if (!activeSem) {
              const cachedSem = useCacheStore.getState().semester?.activeSemester;
              if (cachedSem) {
                activeSem = cachedSem;
              } else {
                throw activeSemSettled.status === "rejected" ? activeSemSettled.reason : new Error("No active semester");
              }
            }

            if (!activeSem) {
              set({
                overallPercentage: 0,
                targetPercentage: userTarget,
                totalAttended: 0,
                totalClasses: 0,
                subjects: [],
                historyLogs: [],
                events: [],
                hasActiveSemester: false,
                activeSemesterId: null,
                simulationBounds: null,
                isLoading: false,
              });
              return;
            }

            // Only re-fetch semester-scoped resources if activeSemesterId changed from knownSemId
            const [statsRes, eventsRes, timetableRes] =
              knownSemId === activeSem.id
                ? [preStatsRes, preEventsRes, preTimetableRes]
                : await Promise.allSettled([
                    api.get(
                      `/attendance/stats?semesterId=${activeSem.id}`,
                    ),
                    api.get(`/events?semesterId=${activeSem.id}`),
                    api.get(`/timetable/${activeSem.id}`),
                  ]);

            // Discard stale pre-mutation responses if a newer fetch or mutation occurred while awaiting
            if (mySeq !== fetchStatsSeq) return;

            // Inject timetable into cacheStore silently so the Timetable page works completely offline even if unvisited
            if (timetableRes.status === "fulfilled") {
              const slots = Array.isArray(timetableRes.value.data)
                ? timetableRes.value.data
                : [];
              const normalizedSlots = slots.map((s: any) => ({
                ...s,
                startTime: s.startTime.slice(0, 5),
                endTime: s.endTime.slice(0, 5),
              }));
              const existingTt = useCacheStore.getState().timetable;
              let subjectsToCache = existingTt?.subjects || [];
              if (
                (!subjectsToCache || subjectsToCache.length === 0) &&
                statsRes.status === "fulfilled"
              ) {
                const rSubs = Array.isArray(statsRes.value.data)
                  ? statsRes.value.data
                  : statsRes.value.data?.subjects || [];
                subjectsToCache = rSubs;
              }
              useCacheStore.getState().setCache("timetable", {
                ...existingTt,
                activeSemester: activeSem,
                subjects: subjectsToCache,
                slots: normalizedSlots,
              });
            }

            // 1. Process Subject Stats
            let rawSubjects = get().subjects || [];
            let simulationBounds = get().simulationBounds || null;
            const hasPendingMutations = useOfflineStore
              .getState()
              .queue.some(
                (q: any) =>
                  q.url?.includes("/attendance/mark") ||
                  q.url?.includes("/attendance/mark-day"),
              );
            if (statsRes.status === "fulfilled" && !hasPendingMutations) {
              if (Array.isArray(statsRes.value.data)) {
                rawSubjects = statsRes.value.data;
              } else if (
                statsRes.value.data &&
                Array.isArray(statsRes.value.data.subjects)
              ) {
                rawSubjects = statsRes.value.data.subjects;
                simulationBounds = statsRes.value.data.simulationBounds || null;
              }
            } else {
              // RESILIENT FALLBACK: Prefer source with real recorded classes (total > 0)
              const cachedStats = useCacheStore.getState().subjects?.stats || [];
              const cachedTotalClasses = (Array.isArray(cachedStats) ? cachedStats : []).reduce(
                (acc: number, s: any) => acc + (Number(s.total) || 0), 0
              );
              const storeTotalClasses = (get().subjects || []).reduce(
                (acc: number, s: any) => acc + (Number(s.total) || 0), 0
              );

              if (cachedTotalClasses > 0) {
                rawSubjects = cachedStats;
              } else if (storeTotalClasses > 0) {
                rawSubjects = get().subjects;
              } else {
                const cachedSubs =
                  useCacheStore.getState().subjects?.subjects ||
                  useCacheStore.getState().subjects ||
                  [];
                rawSubjects = Array.isArray(cachedSubs) ? cachedSubs : cachedSubs.subjects || [];
              }
            }

            let totalAttended = 0;
            let totalClasses = 0;

            let subjects: SubjectStat[] = rawSubjects.map((sub: any) => {
              const att = Number(sub.attended) || 0;
              const tot = Number(sub.total) || 0;
              const missed =
                typeof sub.missed === "number" && !isNaN(sub.missed)
                  ? sub.missed
                  : Math.max(0, tot - att);
              const off =
                typeof sub.off === "number" && !isNaN(sub.off) ? sub.off : 0;
              totalAttended += att;
              totalClasses += tot;
              const pct =
                tot > 0 ? (att / tot) * 100 : Number(sub.percentage) || 0;
              return {
                id: sub.id || sub.subjectId || "",
                subjectId: sub.id || sub.subjectId || "",
                name: sub.name || sub.subjectName || "Course",
                code: sub.code || sub.subjectCode || "",
                colorHex: sub.colorHex,
                attended: att,
                missed,
                off,
                total: tot,
                percentage: Number(pct.toFixed(1)),
                target: sub.target,
                remainingClasses: sub.remainingClasses,
                maxRemainingClasses: sub.maxRemainingClasses,
                missingBoundaries: sub.missingBoundaries,
                futureBreakdown: sub.futureBreakdown,
                attendance: sub.attendance,
              };
            });
            // Self-heal: If totalClasses is 0, reconstruct ground-truth stats from historyLogs
            const allLogs =
              logsRes.status === "fulfilled" && Array.isArray(logsRes.value.data?.logs)
                ? logsRes.value.data.logs
                : useCacheStore.getState().subject_logs?.["all"]?.logs || get().historyLogs || [];

            if (totalClasses === 0 && allLogs.length > 0 && subjects.length > 0) {
              totalAttended = 0;
              totalClasses = 0;
              subjects = subjects.map((sub) => {
                const subLogs = allLogs.filter(
                  (l: any) =>
                    l.subjectId === sub.id ||
                    l.subject?.id === sub.id ||
                    l.subject === sub.name,
                );
                let att = 0;
                let tot = 0;
                let missed = 0;
                let off = 0;
                subLogs.forEach((l: any) => {
                  const st = String(l.status || "").toLowerCase();
                  if (["present", "attended", "medical", "od"].includes(st)) {
                    att++; tot++;
                  } else if (["absent", "missed"].includes(st)) {
                    missed++; tot++;
                  } else if (["off", "cancelled"].includes(st)) {
                    off++;
                  }
                });
                totalAttended += att;
                totalClasses += tot;
                const pct = tot > 0 ? (att / tot) * 100 : sub.percentage || 0;
                return {
                  ...sub,
                  attended: att,
                  total: tot,
                  missed,
                  off,
                  percentage: Number(pct.toFixed(1)),
                };
              });
            }

            // If subjects had valid data, calculate percentage; otherwise preserve previous valid store percentage!
            const overallPercentage =
              totalClasses > 0
                ? (totalAttended / totalClasses) * 100
                : get().overallPercentage > 0
                  ? get().overallPercentage
                  : 0;
            const finalAttended = totalClasses > 0 ? totalAttended : get().totalAttended;
            const finalClasses = totalClasses > 0 ? totalClasses : get().totalClasses;

            // 2. Process Detailed Attendance History Logs
            let historyLogs: AttendanceHistoryEntry[] = get().historyLogs || [];
            if (logsRes.status === "fulfilled" && !hasPendingMutations) {
              // --- SILENTLY CACHE FOR OFFLINE SUBJECT DETAIL PAGE ---
              if (
                logsRes.value.data &&
                !Array.isArray(logsRes.value.data) &&
                Array.isArray(logsRes.value.data.logs)
              ) {
                const existingCache =
                  useCacheStore.getState().subject_logs || {};
                const nextLogsCache: Record<string, any> = {
                  ...existingCache,
                  all: logsRes.value.data,
                  overall: logsRes.value.data,
                };
                if (Array.isArray(logsRes.value.data.subjects)) {
                  logsRes.value.data.subjects.forEach((sub: any) => {
                    nextLogsCache[sub.id] = {
                      logs: logsRes.value.data.logs.filter(
                        (l: any) => l.subjectId === sub.id,
                      ),
                      subjects: logsRes.value.data.subjects.filter(
                        (s: any) => s.id === sub.id,
                      ),
                    };
                  });
                }
                useCacheStore
                  .getState()
                  .setCache("subject_logs", nextLogsCache);
              }
              // ------------------------------------------------------
              const rawLogs = Array.isArray(logsRes.value.data?.logs)
                ? logsRes.value.data.logs
                : Array.isArray(logsRes.value.data)
                  ? logsRes.value.data
                  : [];

              historyLogs = rawLogs.map((item: any) => {
                let time = "";
                if (
                  item.startTime &&
                  item.endTime &&
                  item.startTime !== "00:00"
                ) {
                  time = `${item.startTime} - ${item.endTime}`;
                } else if (item.startTime && item.startTime !== "00:00") {
                  time = item.startTime;
                }
                return {
                  date: item.date || "",
                  dateFormatted: item.dateFormatted || item.date || "",
                  subject: item.subjectName || item.name || "Class",
                  status: (item.status || "not_marked").toUpperCase(),
                  time: time || undefined,
                };
              });
            } else {
              console.warn(
                "Could not fetch attendance logs for RAG context:",
                logsRes.status === "rejected"
                  ? (logsRes as any).reason
                  : "Request fulfilled but response was unsuccessful or pending mutations exist",
              );
            }

            // 3. Process Calendar Events & Holidays
            let events: CalendarEventEntry[] = get().events || [];
            if (eventsRes.status === "fulfilled") {
              const rawEvents = Array.isArray(eventsRes.value.data)
                ? eventsRes.value.data
                : [];
              events = rawEvents.map((ev: any) => ({
                id: ev.id,
                title: ev.title || "Event",
                type: ev.eventType || "academic",
                eventType: ev.eventType || "academic",
                date: ev.date ? ev.date.split("T")[0] + "T00:00:00" : "",
                endDate: ev.endDate
                  ? ev.endDate.split("T")[0] + "T00:00:00"
                  : undefined,
                description: ev.description,
              }));
              const existingSemCache = useCacheStore.getState().semester;
              useCacheStore.getState().setCache("semester", {
                ...existingSemCache,
                activeSemester: activeSem,
                events: rawEvents,
              });
            } else {
              const existingSemCache = useCacheStore.getState().semester;
              if (activeSem && !existingSemCache?.activeSemester) {
                useCacheStore.getState().setCache("semester", {
                  ...existingSemCache,
                  activeSemester: activeSem,
                  events: existingSemCache?.events || [],
                });
              }
              console.warn(
                "Could not fetch events for RAG context:",
                eventsRes.reason,
              );
            }

            if (mySeq !== fetchStatsSeq) return;

            // Persist full projection stats to cache store for offline availability
            const currentSubCache = useCacheStore.getState().subjects || {};
            useCacheStore.getState().setCache("subjects", {
              ...currentSubCache,
              stats: subjects,
              activeSemesterId: activeSem.id,
            });

            const effectiveBounds = simulationBounds || {
              startDate: (activeSem.startDate ? new Date(activeSem.startDate) : new Date()).toISOString(),
              endDate: (activeSem.endDate ? new Date(activeSem.endDate) : new Date()).toISOString(),
              missingBoundaries: false,
              hasCommencement: true,
              hasLastDay: true,
            };

            set({
              overallPercentage: overallPercentage,
              targetPercentage: userTarget,
              totalAttended: finalAttended,
              totalClasses: finalClasses,
              subjects,
              historyLogs,
              events,
              hasActiveSemester: true,
              activeSemesterId: activeSem.id,
              simulationBounds: effectiveBounds,
              isLoading: false,
            });

            lastStatsCompletedAt = Date.now();

            // Proactively schedule notifications once active semester and stats are loaded
            import("../services/NotificationService")
              .then(({ NotificationService }) => {
                NotificationService.scheduleAllProactiveNotifications().catch(
                  () => {},
                );
              })
              .catch(() => {});
          } catch (error) {
            console.warn("[AttendanceStore] Offline fetchStats fallback triggered:", error);
            const cachedSem = useCacheStore.getState().semester?.activeSemester;
            const cachedSubs =
              useCacheStore.getState().subjects?.stats ||
              (get().subjects.length > 0 ? get().subjects : null) ||
              useCacheStore.getState().subjects_overview ||
              [];
            let validSubs: SubjectStat[] = Array.isArray(cachedSubs) ? cachedSubs : cachedSubs.subjects || [];

            let att = 0;
            let tot = 0;
            if (validSubs.length > 0) {
              validSubs.forEach((s: any) => {
                att += Number(s.attended) || 0;
                tot += Number(s.total) || 0;
              });
            }

            const preservedAtt = tot > 0 ? att : get().totalAttended;
            const preservedTot = tot > 0 ? tot : get().totalClasses;
            const preservedPct =
              preservedTot > 0
                ? (preservedAtt / preservedTot) * 100
                : get().overallPercentage;

            const ttStore = useCacheStore.getState().timetable;
            const allSlots = Array.isArray(ttStore) ? ttStore : ttStore?.slots || [];
            const cachedEvents = get().events?.length ? get().events : useCacheStore.getState().semester?.events || [];

            const effectiveBounds = get().simulationBounds || (cachedSem ? {
              startDate: (cachedSem.startDate ? new Date(cachedSem.startDate) : new Date()).toISOString(),
              endDate: (cachedSem.endDate ? new Date(cachedSem.endDate) : new Date()).toISOString(),
              missingBoundaries: false,
              hasCommencement: true,
              hasLastDay: true,
            } : null);

            // Compute remaining classes offline using cached timetable and events
            if (cachedSem && allSlots.length > 0 && validSubs.length > 0) {
              validSubs = computeRemainingClassesOffline(
                validSubs,
                cachedSem,
                allSlots,
                cachedEvents,
                effectiveBounds
              );
            }

            const userTarget = useAuthStore.getState().user?.targetAttendance || get().targetPercentage || 75;
            if (validSubs.length > 0) {
              validSubs = validSubs.map((s: any) => {
                const sAtt = Number(s.attended) || 0;
                const sTot = Number(s.total) || 0;
                const sPct = sTot > 0 ? (sAtt / sTot) * 100 : Number(s.percentage) || 0;
                const subTarget = Number(s.target) || userTarget;
                const canMiss =
                  sPct >= subTarget && subTarget > 0
                    ? Math.floor((sAtt - (subTarget / 100) * sTot) / (subTarget / 100))
                    : 0;
                const needAttend =
                  sPct < subTarget && subTarget < 100
                    ? Math.ceil(((subTarget / 100) * sTot - sAtt) / (1 - subTarget / 100))
                    : 0;
                return {
                  ...s,
                  target: subTarget,
                  canMiss,
                  needAttend,
                };
              });
            }

            set({
              hasActiveSemester: Boolean(cachedSem || get().activeSemesterId),
              activeSemesterId: cachedSem?.id || get().activeSemesterId,
              targetPercentage: userTarget,
              subjects: validSubs.length > 0 ? validSubs : get().subjects,
              totalAttended: preservedAtt,
              totalClasses: preservedTot,
              overallPercentage: preservedPct,
              simulationBounds: effectiveBounds,
              isLoading: false,
            });

            if (mySeq === fetchStatsSeq) {
              set({ isLoading: false });
            }
          } finally {
            if (inFlightStatsPromise === runPromise) {
              inFlightStatsPromise = null;
            }
          }

        })();
        inFlightStatsPromise = runPromise;
        return runPromise;
      },
      updateSimulationBoundaries: async (
        startDate: string,
        endDate: string,
      ) => {
        const { activeSemesterId, subjects } = get();
        if (!activeSemesterId) return;

        const startClean = startDate.split("T")[0];
        const endClean = endDate.split("T")[0];

        // 1. Immediately update simulation bounds in local store (0ms offline responsiveness)
        const nextBounds = {
          startDate: `${startClean}T00:00:00.000Z`,
          endDate: `${endClean}T23:59:59.999Z`,
          hasCommencement: true,
          hasLastDay: true,
          missingBoundaries: false,
        };

        // 2. Update boundary events locally
        const currentEvents = [...(get().events || [])];
        const commIdx = currentEvents.findIndex(
          (e) =>
            e.title &&
            e.title.toLowerCase().includes("commencement of classes"),
        );
        if (commIdx !== -1) {
          currentEvents[commIdx] = {
            ...currentEvents[commIdx],
            date: `${startClean}T00:00:00`,
          };
        } else {
          currentEvents.push({
            id: `commencement-${Date.now()}`,
            title: "Commencement of Classes",
            type: "institute",
            date: `${startClean}T00:00:00`,
            eventType: "institute",
          });
        }
        const lastIdx = currentEvents.findIndex(
          (e) =>
            e.title &&
            (e.title.toLowerCase().includes("last teaching day") ||
              e.title.toLowerCase().includes("last working day")),
        );
        if (lastIdx !== -1) {
          currentEvents[lastIdx] = {
            ...currentEvents[lastIdx],
            date: `${endClean}T00:00:00`,
          };
        } else {
          currentEvents.push({
            id: `last-teaching-${Date.now()}`,
            title: "Last Teaching Day",
            type: "institute",
            date: `${endClean}T00:00:00`,
            eventType: "institute",
          });
        }

        // 3. Client-Side Offline Remaining Classes Engine (handles holidays, restricted holidays, and breaks)
        const cacheState = useCacheStore.getState();
        const ttStore = cacheState.timetable;
        const allSlots: any[] = Array.isArray(ttStore)
          ? ttStore
          : ttStore?.slots || [];
        const updatedSubjects = computeRemainingClassesOffline(
          subjects,
          { startDate: `${startClean}T00:00:00.000Z`, endDate: `${endClean}T23:59:59.999Z` },
          allSlots,
          currentEvents,
          nextBounds
        );

        set({
          simulationBounds: nextBounds,
          events: currentEvents,
          subjects: updatedSubjects,
          isLoading: false,
        });

        cacheState.setCache("subjects", {
          ...(cacheState.subjects || {}),
          stats: updatedSubjects,
        });

        // 4. Send or queue mutation
        try {
          await api.post("/attendance/boundaries", {
            semesterId: activeSemesterId,
            startDate,
            endDate,
          });
        } catch (error) {
          console.warn(
            "Updating boundaries offline, enqueued mutation:",
            error,
          );
          useOfflineStore.getState().enqueue({
            method: "POST",
            url: "/attendance/boundaries",
            data: { semesterId: activeSemesterId, startDate, endDate },
          });
        }
        window.dispatchEvent(new CustomEvent("attendance-updated"));
      },
    }),
    {
      name: "attendx-attendance-cache",
      storage: createJSONStorage(() => capacitorStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isLoading = false;
        }
      },
      partialize: (state) => ({
        overallPercentage: state.overallPercentage,
        targetPercentage: state.targetPercentage,
        totalAttended: state.totalAttended,
        totalClasses: state.totalClasses,
        subjects: state.subjects,
        historyLogs: state.historyLogs,
        events: state.events,
        hasActiveSemester: state.hasActiveSemester,
        activeSemesterId: state.activeSemesterId,
        simulationBounds: state.simulationBounds,
      }),
    },
  ),
);

registerCacheClearListener(() => {
  useAttendanceStore.getState().resetAttendanceStore();
});

// Real-time cross-tab synchronization for TopBar and global attendance stats
if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
  const attSyncChannel = new BroadcastChannel("attendx_offline_sync");
  const tabInstanceId = Math.random().toString(36).substring(7);

  // 1. Broadcast local attendance percentage updates to all other open tabs
  useAttendanceStore.subscribe((state, prevState) => {
    if (
      state.overallPercentage !== prevState.overallPercentage ||
      state.totalAttended !== prevState.totalAttended ||
      state.totalClasses !== prevState.totalClasses
    ) {
      try {
        attSyncChannel.postMessage({
          type: "ATTENDANCE_STATS_UPDATED",
          senderTab: tabInstanceId,
          stats: {
            overallPercentage: state.overallPercentage,
            totalAttended: state.totalAttended,
            totalClasses: state.totalClasses,
            subjects: state.subjects,
          },
        });
      } catch {}
    }
  });

  // 2. Receive attendance updates from other tabs and sync TopBar instantly
  attSyncChannel.onmessage = (event) => {
    if (
      event.data?.type === "ATTENDANCE_STATS_UPDATED" &&
      event.data.senderTab !== tabInstanceId &&
      event.data.stats
    ) {
      const incoming = event.data.stats;
      const currentTot = useAttendanceStore.getState().totalClasses;
      // GUARD: If current tab already has valid stats (>0 classes), never overwrite with corrupt 0%
      if (currentTot > 0 && (Number(incoming.totalClasses) || 0) === 0) {
        return;
      }

      const currentPct = useAttendanceStore.getState().overallPercentage;
      if (currentPct !== incoming.overallPercentage) {
        useAttendanceStore.setState({
          overallPercentage: incoming.overallPercentage,
          ...(typeof incoming.totalAttended === "number"
            ? { totalAttended: incoming.totalAttended }
            : {}),
          ...(typeof incoming.totalClasses === "number"
            ? { totalClasses: incoming.totalClasses }
            : {}),
          ...(incoming.subjects
            ? { subjects: incoming.subjects }
            : {}),
        });
      }
    }
  };
}
