import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Preferences } from "@capacitor/preferences";
import { api } from "../lib/api";
import { useAuthStore } from "./authStore";
import { useCacheStore } from "./cacheStore";
import { useOfflineStore } from "./offlineStore";

export interface SubjectStat {
  id: string;
  subjectId: string;
  name: string;
  code: string;
  colorHex?: string;
  attended: number;
  total: number;
  missed?: number;
  off?: number;
  percentage: number;
  target?: number;
  remainingClasses?: number;
  maxRemainingClasses?: number;
  missingBoundaries?: boolean;
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
  title: string;
  type: string;
  date: string;
  endDate?: string;
  isHolidayList?: boolean;
  eventType?: string;
}

interface AttendanceState {
  _hasHydrated: boolean;
  setHasHydrated: (h: boolean) => void;
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
  updateSimulationBoundaries: (startDate: string, endDate: string) => Promise<void>;
}

export function filterPendingMarksForSemester(
  queue: any[],
  activeSemester: { id?: string; startDate?: string; endDate?: string } | null | undefined,
  activeSubjectIdSet: Set<string>
): any[] {
  if (!activeSemester || !Array.isArray(queue)) return [];
  return queue.filter((q) => {
    if (!q?.url || !q.url.includes("/attendance/mark")) return false;
    if ((q.retryCount || 0) >= 3) return false;
    
    const data = q.data;
    if (!data) return false;
    
    if (data.semesterId && data.semesterId === activeSemester.id) return true;
    if (data.subjectId && activeSubjectIdSet.has(data.subjectId)) return true;
    if (data.date && activeSemester.startDate && activeSemester.endDate) {
      const sDate = activeSemester.startDate.slice(0, 10);
      const eDate = activeSemester.endDate.slice(0, 10);
      if (data.date >= sDate && data.date <= eDate) return true;
    }
    return false;
  });
}

export function reconcileSubjects(
  serverSubjects: SubjectStat[],
  localSubjects: SubjectStat[],
  pendingSubjectIds: Set<string>
): SubjectStat[] {
  const localSubjectMap = new Map(localSubjects.map((s) => [s.id, s]));
  return serverSubjects.map((sSub) => {
    if (pendingSubjectIds.has(sSub.id)) {
      const localSub = localSubjectMap.get(sSub.id);
      if (localSub) return localSub;
    }
    return sSub;
  });
}

// Custom storage wrapper for Capacitor Preferences
const capacitorStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const { value } = await Preferences.get({ key: name });
    return value;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await Preferences.set({ key: name, value });
  },
  removeItem: async (name: string): Promise<void> => {
    await Preferences.remove({ key: name });
  },
};

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
  _hasHydrated: false,
  setHasHydrated: (h) => set({ _hasHydrated: h }),
  isLoading: true,
  simulationBounds: null,
  fetchStats: async (background = false) => {
    // Only show loading if we don't have any cached subjects
    if (!background && get().subjects.length === 0) set({ isLoading: true });
    try {
      const user = useAuthStore.getState().user;
      const userTarget = user?.targetAttendance || 75;

      const activeSemRes = await api.get("/semesters/active");
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
          isLoading: false 
        });
        return;
      }

      // Run independent queries in parallel
      const [statsRes, logsRes, eventsRes, timetableRes, archivedTimetableRes] = await Promise.allSettled([
        api.get(`/attendance/stats?semesterId=${activeSemRes.data.id}`),
        api.get("/attendance/logs"),
        api.get(`/events?semesterId=${activeSemRes.data.id}`),
        api.get(`/timetable/${activeSemRes.data.id}`),
        api.get(`/timetable/semester/${activeSemRes.data.id}/archived`)
      ]);
      
      // Inject timetable into cacheStore silently so the Timetable page works completely offline even if unvisited
      if (timetableRes.status === 'fulfilled') {
        const slots = Array.isArray(timetableRes.value.data) ? timetableRes.value.data : [];
        const normalizedSlots = slots.map((s: any) => ({
          ...s,
          startTime: s.startTime.slice(0, 5),
          endTime: s.endTime.slice(0, 5)
        }));
        
        let archivedSlotsArray = [];
        if (archivedTimetableRes.status === 'fulfilled') {
          archivedSlotsArray = Array.isArray(archivedTimetableRes.value.data) ? archivedTimetableRes.value.data : [];
        }

        let subjectsToCache = [];
        if (statsRes.status === 'fulfilled') {
           const rSubs = Array.isArray(statsRes.value.data) ? statsRes.value.data : (statsRes.value.data?.subjects || []);
           subjectsToCache = rSubs;
        }
        useCacheStore.getState().setCache('timetable', {
          ...useCacheStore.getState().timetable,
          activeSemester: activeSemRes.data,
          subjects: subjectsToCache,
          slots: normalizedSlots,
          archivedSlots: archivedSlotsArray
        });
      }
      
      // Inject semester overview data silently so SemesterHubPage works instantly
      if (eventsRes.status === 'fulfilled') {
        useCacheStore.getState().setCache('semester', {
          ...useCacheStore.getState().semester,
          activeSemester: activeSemRes.data,
          events: Array.isArray(eventsRes.value.data) ? eventsRes.value.data : []
        });
      }

      // Inject subjects data silently so SubjectsPage works instantly
      if (statsRes.status === 'fulfilled') {
        const rSubs = Array.isArray(statsRes.value.data) ? statsRes.value.data : (statsRes.value.data?.subjects || []);
        useCacheStore.getState().setCache('subjects', {
          ...useCacheStore.getState().subjects,
          activeSemesterId: activeSemRes.data.id,
          stats: rSubs,
          subjects: rSubs
        });
      }

      // 1. Process Subject Stats
      let rawSubjects: any[] = [];
      let simulationBounds = null;
      
      if (statsRes.status === 'fulfilled') {
        if (Array.isArray(statsRes.value.data)) {
          rawSubjects = statsRes.value.data;
        } else if (statsRes.value.data && statsRes.value.data.subjects) {
          rawSubjects = statsRes.value.data.subjects;
          simulationBounds = statsRes.value.data.simulationBounds;
        }
      }

      // Find subjects belonging to the active semester
      const activeSubjectIdSet = new Set(
        rawSubjects.map((s: any) => s.id || s.subjectId).filter(Boolean)
      );

      // Check only pending marks matching the active semester (and not exhausted by retries)
      const pendingMarks = filterPendingMarksForSemester(
        useOfflineStore.getState().queue,
        activeSemRes.data,
        activeSubjectIdSet
      );

      const isDirty = pendingMarks.length > 0;
      
      let totalAttended = 0;
      let totalClasses = 0;
      let subjects: SubjectStat[] = [];

      if (statsRes.status === 'fulfilled' && rawSubjects.length > 0) {
        // Map raw server subjects
        const serverSubjects: SubjectStat[] = rawSubjects.map((sub: any) => {
          const att = sub.attended || 0;
          const tot = sub.total || 0;
          const pct = tot > 0 ? (att / tot) * 100 : (sub.percentage || 0);
          return {
            id: sub.id || sub.subjectId || "",
            subjectId: sub.id || sub.subjectId || "",
            name: sub.name || sub.subjectName || "Course",
            code: sub.code || sub.subjectCode || "",
            colorHex: sub.colorHex,
            attended: att,
            total: tot,
            missed: sub.missed !== undefined ? sub.missed : Math.max(0, tot - att),
            off: sub.off || 0,
            percentage: Number(pct.toFixed(1)),
            target: sub.target,
            remainingClasses: sub.remainingClasses,
            maxRemainingClasses: sub.maxRemainingClasses,
            missingBoundaries: sub.missingBoundaries,
            futureBreakdown: sub.futureBreakdown,
            attendance: sub.attendance,
          };
        });

        if (isDirty && get().subjects.length > 0) {
          // Reconcile gracefully:
          // Keep optimistic counts only for subjects with pending marks in this active semester,
          // while accepting fresh server statistics for all other subjects.
          const pendingSubjectIds = new Set(
            pendingMarks.map((p) => p.data?.subjectId).filter(Boolean)
          );
          subjects = reconcileSubjects(serverSubjects, get().subjects, pendingSubjectIds);
        } else {
          subjects = serverSubjects;
        }

        for (const s of subjects) {
          totalAttended += s.attended || 0;
          totalClasses += s.total || 0;
        }
      } else if (get().subjects.length > 0) {
        // Server fetch failed, preserve local store
        subjects = get().subjects;
        totalAttended = get().totalAttended;
        totalClasses = get().totalClasses;
        simulationBounds = get().simulationBounds;
      }
      const overallPercentage = totalClasses > 0 ? (totalAttended / totalClasses) * 100 : 0;

      // 2. Process Detailed Attendance History Logs
      let historyLogs: AttendanceHistoryEntry[] = get().historyLogs || [];
      if (logsRes.status === 'fulfilled' && !isDirty) {

        // --- SILENTLY CACHE FOR OFFLINE SUBJECT DETAIL PAGE ---
        if (logsRes.value.data && !Array.isArray(logsRes.value.data) && logsRes.value.data.logs) {
          const existingCache = useCacheStore.getState().subject_logs || {};
          useCacheStore.getState().setCache("subject_logs", { ...existingCache, "all": logsRes.value.data });
        }
        // ------------------------------------------------------
        const rawLogs = Array.isArray(logsRes.value.data?.logs) 
          ? logsRes.value.data.logs 
          : (Array.isArray(logsRes.value.data) ? logsRes.value.data : []);

        historyLogs = rawLogs.map((item: any) => {
          let time = "";
          if (item.startTime && item.endTime && item.startTime !== "00:00") {
            time = `${item.startTime} - ${item.endTime}`;
          } else if (item.startTime && item.startTime !== "00:00") {
            time = item.startTime;
          }
          return {
            date: item.date || "",
            dateFormatted: item.dateFormatted || item.date || "",
            subject: item.subjectName || item.name || "Class",
            status: (item.status || "not_marked").toUpperCase(),
            time: time || undefined
          };
        });
      } else if (logsRes.status === 'rejected') {
        console.warn("Could not fetch attendance logs for RAG context:", logsRes.reason);
      }

      // 3. Process Calendar Events & Holidays
      let events: CalendarEventEntry[] = get().events || [];
      if (eventsRes.status === 'fulfilled') {
        const rawEvents = Array.isArray(eventsRes.value.data) ? eventsRes.value.data : [];
        events = rawEvents.map((ev: any) => ({
          title: ev.title || "Event",
          type: ev.eventType || "academic",
          date: ev.date || "",
          endDate: ev.endDate || undefined
        }));
      } else if (eventsRes.status === 'rejected') {
        console.warn("Could not fetch events for RAG context:", eventsRes.reason);
      }
      
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
        isLoading: false 
      });
    } catch (error) {
      console.error("Failed to fetch global attendance stats:", error);
      set({ isLoading: false });
    }
  },
  updateSimulationBoundaries: async (startDate: string, endDate: string) => {
    const { activeSemesterId, fetchStats } = useAttendanceStore.getState();
    if (!activeSemesterId) return;
    
    set({ isLoading: true });
    try {
      await api.post("/attendance/boundaries", {
        semesterId: activeSemesterId,
        startDate,
        endDate
      });
      // Re-fetch all stats to get the new simulation data
      await get().fetchStats(false);
    } catch (error) {
      console.error("Failed to update boundaries:", error);
      set({ isLoading: false });
    }
  }
    }),
    {
      name: "attendx-attendance-cache",
      storage: createJSONStorage(() => capacitorStorage),
      onRehydrateStorage: () => (state) => { state?.setHasHydrated(true); },
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
        simulationBounds: state.simulationBounds
      }),
    }
  )
);
