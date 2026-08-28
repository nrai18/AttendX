import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Preferences } from '@capacitor/preferences';

interface CacheState {
  today: any;
  timetable: any;
  semester: any;
  calendar: any;
  subjects: any;
  setCache: (key: string, data: any) => void;
  clearCache: () => void;
  reminderFrequency: { type: 'Daily' | 'Weekly' | 'Monthly' | 'Yearly', subValue?: string };
  setReminderFrequency: (data: { type: 'Daily' | 'Weekly' | 'Monthly' | 'Yearly', subValue?: string }) => void;
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
      semester: null,
      calendar: null,
      subjects: null,
      reminderFrequency: { type: 'Weekly', subValue: 'Mon' },
      setReminderFrequency: (data) => set({ reminderFrequency: data }),
      setCache: (key, data) => set((state) => ({ ...state, [key]: data })),
      clearCache: () => set({ today: null, timetable: null, semester: null, calendar: null, subjects: null })
    }),
    {
      name: 'attendx-api-cache',
      storage: createJSONStorage(() => capacitorStorage),
    }
  )
);
