import { create } from 'zustand';
import { capacitorStorage } from './capacitorStorage';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Preferences } from '@capacitor/preferences';

interface CacheState {
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
  frequencyMemory: {
    Weekly?: string;
    Monthly?: string;
    Yearly?: string;
  };
}



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
      reminderFrequency: { type: 'Weekly', subValue: 'Sun' },
      frequencyMemory: { Weekly: 'Sun', Monthly: '1', Yearly: 'Jan' },
      setReminderFrequency: (data) => set((state) => {
        const newMemory = { ...state.frequencyMemory };
        if (data.type === 'Weekly' && data.subValue) newMemory.Weekly = data.subValue;
        if (data.type === 'Monthly' && data.subValue) newMemory.Monthly = data.subValue;
        if (data.type === 'Yearly' && data.subValue) newMemory.Yearly = data.subValue;
        return { reminderFrequency: data, frequencyMemory: newMemory };
      }),
      setCache: (key, data) => set((state) => {
        // FE-H04 FIX: Prevent overwriting store actions
        if (key === 'setCache' || key === 'clearCache' || key === 'setReminderFrequency') return state;
        
        let newData = data;
        if (key === 'today' && data && typeof data === 'object') {
          const keys = Object.keys(data);
          if (keys.length > 14) {
            // Sort chronologically and keep only the 14 most recent days to prevent unbounded DB growth
            keys.sort();
            const keysToRemove = keys.slice(0, keys.length - 14);
            newData = { ...data };
            keysToRemove.forEach(k => delete newData[k]);
          }
        }
        return { ...state, [key]: newData };
      }),
      clearCache: () => set({ 
        today: null, 
        timetable: null,
        archived_timetables: null, 
        semester: null, 
        calendar: null, 
        subjects: null, 
        subjects_overview: null, 
        subject_logs: null,
        insights: null,     // FE-H05 FIX: Wipe insights
        all_logs: null      // FE-H05 FIX: Wipe all logs
      })
    }),
    {
      name: 'attendx-api-cache',
      storage: createJSONStorage(() => capacitorStorage),
    }
  )
);
