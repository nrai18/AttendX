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
            if (activeSemSettled.status !== "fulfilled")
              throw activeSemSettled.reason;
            const activeSemRes = activeSemSettled.value;

            if (!activeSemRes.data) {
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
              knownSemId === activeSemRes.data.id
                ? [preStatsRes, preEventsRes, preTimetableRes]
                : await Promise.allSettled([
                    api.get(
                      `/attendance/stats?semesterId=${activeSemRes.data.id}`,
                    ),
                    api.get(`/events?semesterId=${activeSemRes.data.id}`),
                    api.get(`/timetable/${activeSemRes.data.id}`),
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
                activeSemester: activeSemRes.data,
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
            }

            let totalAttended = 0;
            let totalClasses = 0;

            const subjects: SubjectStat[] = rawSubjects.map((sub: any) => {
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
            const overallPercentage =
              totalClasses > 0 ? (totalAttended / totalClasses) * 100 : 0;

            // 2. Process Detailed Attendance History Logs
            let historyLogs: AttendanceHistoryEntry[] = get().historyLogs || [];
            if (logsRes.status === "fulfilled") {
              // --- SILENTLY CACHE FOR OFFLINE SUBJECT DETAIL PAGE ---
              if (
                logsRes.value.data &&
                !Array.isArray(logsRes.value.data) &&
                Array.isArray(logsRes.value.data.logs)
              ) {
                const existingCache =
                  useCacheStore.getState().subject_logs || {};
                useCacheStore.getState().setCache("subject_logs", {
                  ...existingCache,
                  all: logsRes.value.data,
                });
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
                logsRes.reason,
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
                activeSemester: activeSemRes.data,
                events: rawEvents,
              });
            } else {
              const existingSemCache = useCacheStore.getState().semester;
              if (activeSemRes.data && !existingSemCache?.activeSemester) {
                useCacheStore.getState().setCache("semester", {
                  ...existingSemCache,
                  activeSemester: activeSemRes.data,
                  events: existingSemCache?.events || [],
                });
              }
              console.warn(
                "Could not fetch events for RAG context:",
                eventsRes.reason,
              );
            }

            if (mySeq !== fetchStatsSeq) return;

            set({
              overallPercentage: overallPercentage,
              targetPercentage: userTarget,
              totalAttended,
              totalClasses,
              subjects,
              historyLogs,
              events,
              hasActiveSemester: true,
              activeSemesterId: activeSemRes.data.id,
              simulationBounds,
              isLoading: false,
            });

            lastStatsCompletedAt = Date.now();

            // Proactively schedule all notifications (classes, events, all summaries) once active semester and stats are loaded
            import("../services/NotificationService")
              .then(({ NotificationService }) => {
                NotificationService.scheduleAllProactiveNotifications().catch(
                  () => {},
                );
              })
              .catch(() => {});
          } catch (error) {
            console.error("Failed to fetch global attendance stats:", error);
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
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const ONE_DAY_MS = 86400000;
        const holidayMap = new Map<
          string,
          { isHoliday: boolean; reason: string }
        >();
        for (const ev of currentEvents) {
          const evType = String(ev.eventType || ev.type || "").toLowerCase();
          const isHol =
            (ev.isHolidayList && evType !== "restricted_holiday") ||
            ["holiday", "vacation", "midsem", "endsem", "exam"].includes(
              evType,
            );
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

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowUTC = Date.UTC(
          tomorrow.getFullYear(),
          tomorrow.getMonth(),
          tomorrow.getDate(),
        );
        const [eY, eM, eD] = endClean.split("-").map(Number);
        const endUTC = Date.UTC(eY, eM - 1, eD);

        const updatedSubjects = subjects.map((sub) => {
          const activeSubSlots = allSlots.filter(
            (s: any) =>
              (s.subjectId === sub.id || s.subjectId === sub.subjectId) &&
              (!s.validUntil || new Date(s.validUntil) >= tomorrow),
          );
          const slotsByDay = [0, 0, 0, 0, 0, 0, 0];
          for (const s of activeSubSlots) {
            if (
              typeof s.dayOfWeek === "number" &&
              s.dayOfWeek >= 0 &&
              s.dayOfWeek < 7
            ) {
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
