import { create } from "zustand";
import { api } from "../lib/api";
import { useAuthStore } from "./authStore";

export interface SubjectStat {
  id: string;
  subjectId: string;
  name: string;
  code: string;
  colorHex?: string;
  attended: number;
  total: number;
  percentage: number;
  target?: number;
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
  fetchStats: () => Promise<void>;
}

export const useAttendanceStore = create<AttendanceState>((set) => ({
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
  fetchStats: async () => {
    set({ isLoading: true });
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

      // 1. Fetch Subject Stats
      const statsRes = await api.get(`/attendance/stats?semesterId=${activeSemRes.data.id}`);
      const rawSubjects = Array.isArray(statsRes.data) ? statsRes.data : [];
      
      let totalAttended = 0;
      let totalClasses = 0;
      
      const subjects: SubjectStat[] = rawSubjects.map((sub: any) => {
        const att = sub.attended || 0;
        const tot = sub.total || 0;
        totalAttended += att;
        totalClasses += tot;
        const pct = tot > 0 ? (att / tot) * 100 : (sub.percentage || 0);
        return {
          id: sub.id || sub.subjectId || "",
          subjectId: sub.id || sub.subjectId || "",
          name: sub.name || sub.subjectName || "Course",
          code: sub.code || sub.subjectCode || "",
          colorHex: sub.colorHex,
          attended: att,
          total: tot,
          percentage: Number(pct.toFixed(1)),
          target: sub.target,
        };
      });
      
      const overallPercentage = totalClasses > 0 ? (totalAttended / totalClasses) * 100 : 0;

      // 2. Fetch Detailed Attendance History Logs
      let historyLogs: AttendanceHistoryEntry[] = [];
      try {
        const logsRes = await api.get("/attendance/logs");
        const rawLogs = Array.isArray(logsRes.data?.logs) 
          ? logsRes.data.logs 
          : (Array.isArray(logsRes.data) ? logsRes.data : []);

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
      } catch (err) {
        console.warn("Could not fetch attendance logs for RAG context:", err);
      }

      // 3. Fetch Calendar Events & Holidays
      let events: CalendarEventEntry[] = [];
      try {
        const eventsRes = await api.get(`/events?semesterId=${activeSemRes.data.id}`);
        const rawEvents = Array.isArray(eventsRes.data) ? eventsRes.data : [];
        events = rawEvents.map((ev: any) => ({
          title: ev.title || "Event",
          type: ev.eventType || "academic",
          date: ev.date || "",
          endDate: ev.endDate || undefined
        }));
      } catch (err) {
        console.warn("Could not fetch events for RAG context:", err);
      }
      
      set({ 
        overallPercentage: Number(overallPercentage.toFixed(1)), 
        targetPercentage: userTarget, 
        totalAttended, 
        totalClasses, 
        subjects, 
        historyLogs,
        events,
        hasActiveSemester: true, 
        activeSemesterId: activeSemRes.data.id,
        isLoading: false 
      });
    } catch (error) {
      console.error("Failed to fetch global attendance stats:", error);
      set({ 
        overallPercentage: 0, 
        totalAttended: 0, 
        totalClasses: 0, 
        subjects: [], 
        historyLogs: [], 
        events: [], 
        hasActiveSemester: false, 
        activeSemesterId: null, 
        isLoading: false 
      });
    }
  }
}));
