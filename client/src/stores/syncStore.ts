import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SyncState {
  activeCode: string;
  expiresAt: number | null;
  setActiveCode: (code: string, expiresInSeconds: number) => void;
  clearActiveCode: () => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      activeCode: "",
      expiresAt: null,
      setActiveCode: (code, expiresInSeconds) =>
        set({
          activeCode: code,
          expiresAt: Date.now() + expiresInSeconds * 1000,
        }),
      clearActiveCode: () => set({ activeCode: "", expiresAt: null }),
    }),
    {
      name: "attendx-sync-storage",
    }
  )
);
