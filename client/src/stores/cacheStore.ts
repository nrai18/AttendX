import { create } from 'zustand';

interface CacheState {
  today: any;
  timetable: any;
  semester: any;
  calendar: any;
  subjects: any;
  setCache: (key: string, data: any) => void;
  clearCache: () => void;
}

export const useCacheStore = create<CacheState>((set) => ({
  today: null,
  timetable: null,
  semester: null,
  calendar: null,
  subjects: null,
  setCache: (key, data) => set((state) => ({ ...state, [key]: data })),
  clearCache: () => set({ today: null, timetable: null, semester: null, calendar: null, subjects: null })
}));
