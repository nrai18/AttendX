import { create } from "zustand";

export interface User {
  id: string;
  email: string;
  name: string;
  rollNumber?: string;
  avatarUrl?: string;
  role: "student" | "cr" | "admin" | "superadmin";
  department?: string;
  batch?: string;
  targetAttendance: number;
  theme?: "light" | "dark" | "system";
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  setAuth: (user: User, accessToken: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: {
    id: "dev-user-id",
    email: "dev@iiitu.ac.in",
    name: "Developer",
    role: "admin",
    targetAttendance: 75,
    theme: "system",
  },
  accessToken: "dummy-token",
  isAuthenticated: true,
  isLoading: false,

  setUser: (user) => set({ user }),
  setAccessToken: (accessToken) => set({ accessToken }),

  setAuth: (user, accessToken) =>
    set({
      user,
      accessToken,
      isAuthenticated: true,
      isLoading: false,
    }),

  logout: () =>
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    }),

  setLoading: (isLoading) => set({ isLoading }),
}));
