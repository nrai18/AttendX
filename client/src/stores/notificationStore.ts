import { create } from 'zustand';
import { capacitorStorage } from './capacitorStorage';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Preferences } from '@capacitor/preferences';

export interface NotificationConfig {
  classReminderOffset: number; // 5, 10, 15
  showLocation: boolean;
  notifyNextClassOnEnd: boolean;
  endOfDaySummary: boolean;
  dailySummaryTime?: string;
  summaryTime: string; // Global canonical daily summary time (default "18:00")
  weeklySummaryTime?: string;
  monthlySummaryTime?: string;
  yearlySummaryTime?: string;
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  classReminderOffset: 10,
  showLocation: true,
  notifyNextClassOnEnd: true,
  endOfDaySummary: true,
  dailySummaryTime: "18:00",
  summaryTime: "18:00",
  weeklySummaryTime: "18:00",
  monthlySummaryTime: "19:00",
  yearlySummaryTime: "20:00",
};

interface NotificationState {
  config: NotificationConfig;
  updateConfig: (config: Partial<NotificationConfig>) => void;
  resetConfig: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      config: { ...DEFAULT_NOTIFICATION_CONFIG },
      updateConfig: (newConfig) =>
        set((state) => {
          const updated = { ...state.config, ...newConfig };
          // Keep dailySummaryTime and summaryTime in sync
          if (newConfig.dailySummaryTime && !newConfig.summaryTime) {
            updated.summaryTime = newConfig.dailySummaryTime;
          } else if (newConfig.summaryTime && !newConfig.dailySummaryTime) {
            updated.dailySummaryTime = newConfig.summaryTime;
          }
          // Do NOT overwrite weekly, monthly, or yearly summary times!
          return { config: updated };
        }),
      resetConfig: () => set({ config: { ...DEFAULT_NOTIFICATION_CONFIG } }),
    }),
    {
      name: 'attendx-notification-settings',
      storage: createJSONStorage(() => capacitorStorage),
    }
  )
);
