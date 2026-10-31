import { create } from 'zustand';
import { capacitorStorage } from './capacitorStorage';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Preferences } from '@capacitor/preferences';

export interface NotificationConfig {
  classReminderOffset: number; // 5, 10, 15
  showLocation: boolean;
  notifyNextClassOnEnd: boolean;
  endOfDaySummary: boolean;
  summaryTime: string; // Global canonical summary time (default "18:00")
  weeklySummaryTime?: string;
  monthlySummaryTime?: string;
  yearlySummaryTime?: string;
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  classReminderOffset: 10,
  showLocation: true,
  notifyNextClassOnEnd: true,
  endOfDaySummary: true,
  summaryTime: "18:00",
  weeklySummaryTime: "18:00",
  monthlySummaryTime: "18:00",
  yearlySummaryTime: "18:00",
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
          const globalTime =
            newConfig.summaryTime ||
            newConfig.weeklySummaryTime ||
            newConfig.monthlySummaryTime ||
            newConfig.yearlySummaryTime;
          if (globalTime) {
            updated.summaryTime = globalTime;
            updated.weeklySummaryTime = globalTime;
            updated.monthlySummaryTime = globalTime;
            updated.yearlySummaryTime = globalTime;
          }
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
