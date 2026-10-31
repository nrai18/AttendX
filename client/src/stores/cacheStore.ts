import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { capacitorStorage } from './capacitorStorage';
import type { FrequencyData } from '../components/ui/frequency-selector';

const onClearListeners: Array<() => void> = [];
export const registerCacheClearListener = (cb: () => void) => {
  onClearListeners.push(cb);
};

export interface CacheState {
  today: Record<string, any>; // key: dateStr
  calendar: Record<string, any>; // key: monthStr
  timetable: any;
  archived_timetables?: any;
  semester: any;
  subjects: any;
  subjects_overview?: any;
  subject_logs: Record<string, any>; // key: subjectId or 'all'
  all_logs?: any;
  insights: any;
  reminderFrequency: FrequencyData;
  frequencyMemory: Record<string, string | undefined>;
  setReminderFrequency: (data: FrequencyData) => void;
  mutationVersion: number;
  setCache: (key: string, data: any) => void;
  invalidateForMutation: (url?: string, method?: string, responseData?: any) => void;
  clearCache: () => void;
  [key: string]: any;
}

export const useCacheStore = create<CacheState>()(
  persist(
    (set, get) => ({
      today: {},
      calendar: {},
      timetable: null,
      archived_timetables: null,
      semester: null,
      subjects: null,
      subjects_overview: null,
      subject_logs: {},
      all_logs: null,
      insights: null,
      reminderFrequency: { type: 'Daily' },
      frequencyMemory: { Weekly: 'Sun', Monthly: '1', Yearly: 'Jan' },
      setReminderFrequency: (data: FrequencyData) =>
        set((state) => ({
          reminderFrequency: data,
          frequencyMemory: data.subValue
            ? { ...state.frequencyMemory, [data.type]: data.subValue }
            : state.frequencyMemory,
        })),
      mutationVersion: 0,
      setCache: (key, data) => set((state) => ({ ...state, [key]: data })),
      invalidateForMutation: (url, method, responseData) => {
        const m = (method || '').toLowerCase();
        if (!['post', 'put', 'patch', 'delete'].includes(m) || !url) return;

        // Ignore non-academic or preview-only requests
        if (
          url.includes('/auth/') ||
          url.includes('/ai/tts') ||
          url.includes('/system/') ||
          url.includes('/feedback') ||
          url.includes('/documents') ||
          url.includes('/users/onboarding-status') ||
          url.includes('/transfer/') ||
          url.includes('/semesters/notify-transition') ||
          url.includes('/events/import-rag/cache')
        ) {
          return;
        }

        if (
          (url.includes('/timetable/ocr-import') ||
            url.includes('/events/ocr-import') ||
            url.includes('/events/upload-calendar') ||
            url.includes('/events/import-rag')) &&
          !url.includes('/save')
        ) {
          return;
        }

        if (url.includes('/ai/chat') && (!responseData?.actions || responseData.actions.length === 0)) {
          return;
        }

        if (
          url.includes('/users/reset-') ||
          url.includes('/semesters') ||
          url.includes('/data/import')
        ) {
          get().clearCache();
          return;
        }

        if (url.includes('/attendance/')) {
          set((state) => ({
            today: {},
            calendar: {},
            subjects: null,
            subject_logs: {},
            all_logs: null,
            insights: null,
            semester: state.semester ? { ...state.semester, calendarData: null } : null,
            mutationVersion: (state.mutationVersion || 0) + 1,
          }));
          return;
        }

        if (url.includes('/timetable/') || url.includes('/subjects')) {
          set((state) => ({
            today: {},
            calendar: {},
            timetable: null,
            archived_timetables: null,
            semester: null,
            subjects: null,
            subjects_overview: null,
            subject_logs: {},
            all_logs: null,
            insights: null,
            mutationVersion: (state.mutationVersion || 0) + 1,
          }));
          return;
        }

        if (url.includes('/events') || url.includes('/calendar-rag/save')) {
          set((state) => ({
            today: {},
            calendar: {},
            semester: null,
            subjects: null,
            subject_logs: {},
            all_logs: null,
            insights: null,
            mutationVersion: (state.mutationVersion || 0) + 1,
          }));
          return;
        }

        if (url.includes('/users/me')) {
          set((state) => ({
            today: {},
            calendar: {},
            subjects: null,
            subject_logs: {},
            insights: null,
            mutationVersion: (state.mutationVersion || 0) + 1,
          }));
          return;
        }
      },
      clearCache: () => {
        set((state) => ({
          today: {},
          calendar: {},
          timetable: null,
          archived_timetables: null,
          semester: null,
          subjects: null,
          subjects_overview: null,
          subject_logs: {},
          all_logs: null,
          insights: null,
          reminderFrequency: { type: 'Daily' },
          frequencyMemory: { Weekly: 'Sun', Monthly: '1', Yearly: 'Jan' },
          mutationVersion: (state.mutationVersion || 0) + 1,
        }));
        onClearListeners.forEach((cb) => {
          try {
            cb();
          } catch (e) {}
        });
      },
    }),
    {
      name: 'attendx-global-cache',
      storage: createJSONStorage(() => capacitorStorage),
    }
  )
);
