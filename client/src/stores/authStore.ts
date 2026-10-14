import { create } from "zustand";
import { capacitorStorage } from "./capacitorStorage";
import { persist, createJSONStorage } from "zustand/middleware";
import { Preferences } from "@capacitor/preferences";
import { api } from "../lib/api";

export interface User {
  id: string;
  email: string;
  name: string;
  rollNumber?: string;
  avatarUrl?: string;
  role: "student" | "cr" | "admin" | "superadmin";
  department?: string;
  batch?: string;
  autoTerminateMonths?: number;
  targetAttendance: number;
  theme?: "light" | "dark";
  gender?: string;
  birthday?: string;
  googleId?: string;
  hasPassword?: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken?: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  _hasHydrated: boolean;
  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  setRefreshToken: (token: string | null) => void;
  setAuth: (user: User, accessToken: string, refreshToken?: string) => void;
  logout: (skipBackendCall?: boolean) => void;
  setLoading: (loading: boolean) => void;
  setHasHydrated: (h: boolean) => void;
}



export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      _hasHydrated: false,

      setUser: (user) => set({ user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setRefreshToken: (refreshToken) => set({ refreshToken }),

      setAuth: (user, accessToken, refreshToken) => {
        set((state: any) => ({
          user,
          accessToken,
          ...(refreshToken ? { refreshToken } : {}),
          isAuthenticated: true,
          isLoading: false,
        }));
        // Sync the FCM push token acquired during app boot to this authenticated session.
        // This is the fix for the "broadcast doesn't arrive after login" bug:
        // PushNotifications.register() fires on startup (before login), saves token to localStorage,
        // but the PATCH /users/me call fails because the user isn't authenticated yet.
        // Now that we are authenticated, we retry that sync immediately.
        import('../services/NotificationService').then(({ NotificationService }) => {
          NotificationService.syncFcmToken().catch(() => {});
        });
      },

      logout: async (skipBackendCall = false) => {
        const wasAuthenticated = get().isAuthenticated;
        const currentRefreshToken = get().refreshToken;

        if (!skipBackendCall && wasAuthenticated) {
          try {
            // Clear FCM token and delete DeviceSession (RefreshToken) in Linked Devices in parallel
            await Promise.allSettled([
              api.patch('/users/me', { fcmToken: null }),
              api.post('/auth/logout', { refreshToken: currentRefreshToken }),
            ]);
          } catch (error) {
            console.error("Failed to clean up session on logout:", error);
          }
        }

        import('./offlineStore').then(({ useOfflineStore }) => useOfflineStore.getState().clearQueue()).catch(() => {});
        const keysToRemove = [
          'attendx-auth',
          'attendx-attendance-cache',
          'attendx-api-cache',
          'attendx-assignments',
          'attendx-sync-storage',
          'attendx-offline-queue',
          'onboarding_voice_mode',
          'onboarding_predictive',
          'onboarding_peer_sync',
          'onboarding_dismissed'
        ];
        keysToRemove.forEach(k => {
          Preferences.remove({ key: k }).catch(() => {});
          localStorage.removeItem(k);
        });
        try {
          sessionStorage.removeItem('attendx_settings_scroll');
        } catch (e) {}
        try {
          const m = await import('../services/NotificationService');
          await m.NotificationService.cancelAll();
        } catch (err) {
          console.error('Failed to cancel notifications on logout:', err);
        }
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
        
        if (wasAuthenticated) {
          setTimeout(() => {
            window.location.href = "/";
          }, 100);
        }
      },

      setLoading: (isLoading) => set({ isLoading }),
      setHasHydrated: (h) => set({ _hasHydrated: h }),
    }),
    {
      name: "attendx-auth",
      storage: createJSONStorage(() => capacitorStorage),
      onRehydrateStorage: () => (state) => {
        if (state) state.setHasHydrated(true);
      },
    }
  )
);

