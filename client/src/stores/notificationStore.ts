import { create } from 'zustand';
import { capacitorStorage } from './capacitorStorage';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Preferences } from '@capacitor/preferences';

export interface NotificationConfig {
  classReminderOffset: number; // 5, 10, 15
  showLocation: boolean;
  notifyNextClassOnEnd: boolean;
  endOfDaySummary: boolean;
  summaryTime: string; // Legacy fallback
  weeklySummaryTime?: string;
  monthlySummaryTime?: string;
  yearlySummaryTime?: string;
}

interface NotificationState {
  config: NotificationConfig;
  updateConfig: (config: Partial<NotificationConfig>) => void;
}



export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      config: {
        classReminderOffset: 10,
        showLocation: true,
        notifyNextClassOnEnd: true,
        endOfDaySummary: true,
        summaryTime: "18:00",
        weeklySummaryTime: "09:00",
        monthlySummaryTime: "10:00",
        yearlySummaryTime: "11:00",
      },
      updateConfig: (newConfig) =>
        set((state) => ({ config: { ...state.config, ...newConfig } })),
    }),
    {
      name: 'attendx-notification-settings',
      storage: createJSONStorage(() => capacitorStorage),
    }
  )
);
