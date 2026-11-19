import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import CryptoJS from "crypto-js";
import { capacitorStorage } from "./capacitorStorage";

export const APP_LOCK_STORAGE_KEY = "attendx-app-lock";
const MAX_FAILED_BEFORE_LOCKOUT = 5;
const LOCKOUT_DURATION_MS = 30_000;

function generateSalt(): string {
  return CryptoJS.lib.WordArray.random(16).toString();
}

function hashPin(pin: string, salt: string): string {
  return CryptoJS.SHA256(`${salt}:${pin}`).toString();
}

export interface AppLockState {
  isEnabled: boolean;
  pinHash: string | null;
  pinSalt: string | null;
  isFingerprintEnabled: boolean;
  /** Milliseconds in background before re-locking (0 = immediately on resume). */
  autoLockTimeoutMs: number;
  lastBackgroundAt: number | null;
  failedAttempts: number;
  lockoutUntil: number | null;
  /** Transient runtime state: defaults to `isEnabled` on every cold start. */
  isLocked: boolean;
  isBiometricPromptActive: boolean;
  _hasHydrated: boolean;

  setHasHydrated: (hydrated: boolean) => void;
  setBiometricPromptActive: (active: boolean) => void;
  enablePasscode: (pin: string) => void;
  disablePasscode: () => void;
  verifyPin: (pin: string, options?: { deferUnlock?: boolean }) => boolean;
  unlockWithBiometric: () => void;
  lockNow: () => void;
  setFingerprintEnabled: (enabled: boolean) => void;
  setAutoLockTimeoutMs: (ms: number) => void;
  recordBackground: () => void;
  evaluateForegroundResume: () => void;
}

export const useAppLockStore = create<AppLockState>()(
  persist(
    (set, get) => ({
      isEnabled: false,
      pinHash: null,
      pinSalt: null,
      isFingerprintEnabled: false,
      autoLockTimeoutMs: 0,
      lastBackgroundAt: null,
      failedAttempts: 0,
      lockoutUntil: null,
      isLocked: false,
      isBiometricPromptActive: false,
      _hasHydrated: false,

      setHasHydrated: (_hasHydrated) => set({ _hasHydrated }),

      setBiometricPromptActive: (isBiometricPromptActive) =>
        set({ isBiometricPromptActive }),

      enablePasscode: (pin) => {
        const salt = generateSalt();
        const pinHash = hashPin(pin, salt);
        set({
          isEnabled: true,
          pinSalt: salt,
          pinHash,
          isLocked: false,
          failedAttempts: 0,
          lockoutUntil: null,
          lastBackgroundAt: null,
        });
      },

      disablePasscode: () =>
        set({
          isEnabled: false,
          pinHash: null,
          pinSalt: null,
          isFingerprintEnabled: false,
          isLocked: false,
          failedAttempts: 0,
          lockoutUntil: null,
          lastBackgroundAt: null,
        }),

      verifyPin: (pin, options) => {
        const { isEnabled, pinHash, pinSalt, failedAttempts, lockoutUntil } = get();
        if (!isEnabled || !pinHash || !pinSalt) {
          set({ isLocked: false, lastBackgroundAt: null });
          return true;
        }
        if (lockoutUntil && Date.now() < lockoutUntil) {
          return false;
        }
        const computed = hashPin(pin, pinSalt);
        if (computed === pinHash) {
          if (options?.deferUnlock) {
            set({
              failedAttempts: 0,
              lockoutUntil: null,
              lastBackgroundAt: null,
            });
          } else {
            set({
              isLocked: false,
              failedAttempts: 0,
              lockoutUntil: null,
              lastBackgroundAt: null,
            });
          }
          return true;
        }
        const nextFailed = failedAttempts + 1;
        const shouldLockout = nextFailed % MAX_FAILED_BEFORE_LOCKOUT === 0;
        set({
          failedAttempts: nextFailed,
          lockoutUntil: shouldLockout ? Date.now() + LOCKOUT_DURATION_MS : null,
        });
        return false;
      },

      unlockWithBiometric: () =>
        set({
          isLocked: false,
          failedAttempts: 0,
          lockoutUntil: null,
          lastBackgroundAt: null,
        }),

      lockNow: () => {
        if (!get().isEnabled) return;
        set({ isLocked: true, lastBackgroundAt: Date.now() });
      },

      setFingerprintEnabled: (isFingerprintEnabled) => set({ isFingerprintEnabled }),

      setAutoLockTimeoutMs: (autoLockTimeoutMs) => set({ autoLockTimeoutMs }),

      recordBackground: () => {
        const { isEnabled, isBiometricPromptActive } = get();
        if (!isEnabled || isBiometricPromptActive) return;
        set({ lastBackgroundAt: Date.now() });
      },

      evaluateForegroundResume: () => {
        const {
          isEnabled,
          isLocked,
          lastBackgroundAt,
          autoLockTimeoutMs,
          isBiometricPromptActive,
        } = get();
        if (!isEnabled || isLocked || isBiometricPromptActive || lastBackgroundAt == null) {
          return;
        }
        if (Date.now() - lastBackgroundAt >= autoLockTimeoutMs) {
          set({ isLocked: true, lastBackgroundAt: null });
        } else {
          // Clear stale background timestamp once resumed within timeout so subsequent focus events never re-lock mid-use
          set({ lastBackgroundAt: null });
        }
      },
    }),
    {
      name: APP_LOCK_STORAGE_KEY,
      storage: createJSONStorage(() => capacitorStorage),
      partialize: (state) => ({
        isEnabled: state.isEnabled,
        pinHash: state.pinHash,
        pinSalt: state.pinSalt,
        isFingerprintEnabled: state.isFingerprintEnabled,
        autoLockTimeoutMs: state.autoLockTimeoutMs,
        lastBackgroundAt: state.lastBackgroundAt,
        failedAttempts: state.failedAttempts,
        lockoutUntil: state.lockoutUntil,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Always lock on cold boot whenever passcode protection is active
          state.isLocked = Boolean(state.isEnabled && state.pinHash);
          state.setHasHydrated(true);
        }
      },
    },
  ),
);
