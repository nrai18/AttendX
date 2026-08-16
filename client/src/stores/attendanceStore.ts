import { create } from "zustand";
import { api } from "../lib/api";
import { useAuthStore } from "./authStore";

interface AttendanceState {
  overallPercentage: number;
  targetPercentage: number;
  hasActiveSemester: boolean | null;
  isLoading: boolean;
  fetchStats: () => Promise<void>;
}

export const useAttendanceStore = create<AttendanceState>((set) => ({
  overallPercentage: 0,
  targetPercentage: 75,
  hasActiveSemester: null,
  isLoading: false,
  fetchStats: async () => {
    set({ isLoading: true });
    try {
      const user = useAuthStore.getState().user;
      const userTarget = user?.targetAttendance || 75;

      const activeSemRes = await api.get("/semesters/active");
      if (!activeSemRes.data) {
        set({ overallPercentage: 0, targetPercentage: userTarget, hasActiveSemester: false, isLoading: false });
        return;
      }
      
      const statsRes = await api.get(`/attendance/stats?semesterId=${activeSemRes.data.id}`);
      const subjects = Array.isArray(statsRes.data) ? statsRes.data : [];
      
      let totalAttended = 0;
      let totalClasses = 0;
      
      subjects.forEach((sub: any) => {
        totalAttended += sub.attended;
        totalClasses += sub.total;
      });
      
      const overallPercentage = totalClasses > 0 ? (totalAttended / totalClasses) * 100 : 0;
      
      set({ overallPercentage, targetPercentage: userTarget, hasActiveSemester: true, isLoading: false });
    } catch (error) {
      console.error("Failed to fetch global attendance stats:", error);
      set({ hasActiveSemester: false, isLoading: false });
    }
  }
}));
