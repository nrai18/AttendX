import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Preferences } from '@capacitor/preferences';

interface CacheState {
  _hasHydrated: boolean;
  setHasHydrated: (h: boolean) => void;
  today: any;
  timetable: any;
  archived_timetables?: any;
  semester: any;
  calendar: any;
  subjects: any;
  subjects_overview?: any;
  subject_logs?: any;
  insights: any;
  all_logs?: any;
  setCache: (key: string, data: any) => void;
  clearCache: () => void;
  reminderFrequency: { type: 'Never' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly', subValue?: string };
  setReminderFrequency: (data: { type: 'Never' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly', subValue?: string }) => void;
}

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

export const useCacheStore = create<CacheState>()(
  persist(
    (set) => ({
      today: null,
      timetable: null,
      archived_timetables: null,
      semester: null,
      calendar: null,
      subjects: null,
      subjects_overview: null,
      subject_logs: null,
      insights: null,
      _hasHydrated: false,
      setHasHydrated: (h: boolean) => set({ _hasHydrated: h }),
      reminderFrequency: { type: 'Weekly', subValue: 'Mon' },
      setReminderFrequency: (data) => set({ reminderFrequency: data }),
      setCache: (key, data) => set((state) => ({ ...state, [key]: data })),
      clearCache: () => set({ today: null, timetable: null,
      archived_timetables: null, semester: null, calendar: null, subjects: null, subjects_overview: null, subject_logs: null })
    }),
    {
      name: 'attendx-api-cache',
      storage: createJSONStorage(() => capacitorStorage),
      onRehydrateStorage: () => (state) => { state?.setHasHydrated(true); },
    }
  )
);
