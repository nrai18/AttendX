import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";

export type NotificationType = "success" | "info" | "warning" | "error";
export type NotificationCategory = "semester" | "delete" | "reset" | "attendance" | "general";

export interface InAppNotification {
  id: string;
  title: string;
  description: string;
  timestamp: number;
  read: boolean;
  type: NotificationType;
  category: NotificationCategory;
}

interface NotificationState {
  notifications: InAppNotification[];
  unreadCount: number;
  notify: (payload: {
    title: string;
    description?: string;
    type?: NotificationType;
    category?: NotificationCategory;
    silentToast?: boolean;
  }) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,

      notify: ({
        title,
        description = "",
        type = "info",
        category = "general",
        silentToast = false,
      }) => {
        const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const newNotif: InAppNotification = {
          id,
          title,
          description,
          timestamp: Date.now(),
          read: false,
          type,
          category,
        };

        set((state) => {
          const updated = [newNotif, ...state.notifications].slice(0, 50); // Keep last 50
          return {
            notifications: updated,
            unreadCount: updated.filter((n) => !n.read).length,
          };
        });

        // Trigger Sonner toast UI
        if (!silentToast) {
          if (type === "success") {
            toast.success(title, { description: description || undefined });
          } else if (type === "error") {
            toast.error(title, { description: description || undefined });
          } else if (type === "warning") {
            toast.warning(title, { description: description || undefined });
          } else {
            toast.info(title, { description: description || undefined });
          }
        }
      },

      markAsRead: (id: string) => {
        set((state) => {
          const updated = state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          );
          return {
            notifications: updated,
            unreadCount: updated.filter((n) => !n.read).length,
          };
        });
      },

      markAllAsRead: () => {
        set((state) => {
          const updated = state.notifications.map((n) => ({ ...n, read: true }));
          return {
            notifications: updated,
            unreadCount: 0,
          };
        });
      },

      removeNotification: (id: string) => {
        set((state) => {
          const updated = state.notifications.filter((n) => n.id !== id);
          return {
            notifications: updated,
            unreadCount: updated.filter((n) => !n.read).length,
          };
        });
      },

      clearAll: () => {
        set({
          notifications: [],
          unreadCount: 0,
        });
      },
    }),
    {
      name: "attendx-notifications-storage",
    }
  )
);
