import { create } from "zustand";
import { capacitorStorage } from "./capacitorStorage";
import { persist, createJSONStorage } from "zustand/middleware";
import { Preferences } from "@capacitor/preferences"; // FE-H06 FIX: Import Capacitor Preferences

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
      storage: createJSONStorage(() => capacitorStorage), // FE-H06 FIX: Apply storage wrapper
    }
  )
);
