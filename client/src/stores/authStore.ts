import { create } from "zustand";
import { capacitorStorage } from "./capacitorStorage";
import { persist, createJSONStorage } from "zustand/middleware";
import { Preferences } from "@capacitor/preferences";

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
  isAuthenticated: boolean;
  isLoading: boolean;
  _hasHydrated: boolean;
  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  setAuth: (user: User, accessToken: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setHasHydrated: (h: boolean) => void;
}



export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      _hasHydrated: false,

      setUser: (user) => set({ user }),
      setAccessToken: (accessToken) => set({ accessToken }),

      setAuth: (user, accessToken) =>
        set({
          user,
          accessToken,
          isAuthenticated: true,
          isLoading: false,
        }),

      logout: () => {
        const keysToRemove = [
          'attendx-auth',
          'attendx-attendance-cache',
          'attendx-api-cache',
          'attendx-assignments',
          'attendx-sync-storage'
        ];
        keysToRemove.forEach(k => {
          Preferences.remove({ key: k }).catch(() => {});
          localStorage.removeItem(k);
        });
        import('../services/NotificationService')
          .then(m => m.NotificationService.cancelAll())
          .catch((err) => console.error('Failed to cancel notifications on logout:', err));
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
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

