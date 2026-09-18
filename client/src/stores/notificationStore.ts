import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Preferences } from '@capacitor/preferences';

export interface NotificationConfig {
  classReminderOffset: number; // 5, 10, 15
  showLocation: boolean;
  notifyNextClassOnEnd: boolean;
  endOfDaySummary: boolean;
  summaryTime: string;
}

interface NotificationState {
  config: NotificationConfig;
  updateConfig: (config: Partial<NotificationConfig>) => void;
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

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      config: {
        classReminderOffset: 10,
        showLocation: true,
        notifyNextClassOnEnd: true,
        endOfDaySummary: true,
        summaryTime: "18:00",
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
