import { create } from "zustand";
import { api } from "../lib/api";

interface AttendanceState {
  overallPercentage: number;
  targetPercentage: number;
  isLoading: boolean;
  fetchStats: () => Promise<void>;
}

export const useAttendanceStore = create<AttendanceState>((set) => ({
  overallPercentage: 0,
  targetPercentage: 75,
  isLoading: false,
  fetchStats: async () => {
    set({ isLoading: true });
    try {
      const activeSemRes = await api.get("/semesters/active");
      if (!activeSemRes.data) {
        set({ overallPercentage: 0, isLoading: false });
        return;
      }
      
      const statsRes = await api.get(`/attendance/stats?semesterId=${activeSemRes.data.id}`);
      const subjects = statsRes.data;
      
      let totalAttended = 0;
      let totalClasses = 0;
      
      subjects.forEach((sub: any) => {
        totalAttended += sub.attended;
        totalClasses += sub.total;
      });
      
      const overallPercentage = totalClasses > 0 ? (totalAttended / totalClasses) * 100 : 0;
      
      set({ overallPercentage, isLoading: false });
    } catch (error) {
      console.error("Failed to fetch global attendance stats:", error);
      set({ isLoading: false });
    }
  }
}));
