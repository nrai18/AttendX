import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Fingerprint, Lock, LogOut, ShieldCheck } from "lucide-react";
import { useAppLockStore } from "../../stores/appLockStore";
import { useAuthStore } from "../../stores/authStore";
import { biometricService } from "../../services/biometricService";
import { PasscodeKeypad, PasscodePinBoxes } from "./PasscodeKeypad";
import { useScrollLock } from "../../hooks/useScrollLock";
import { SoundFX } from "../../utils/soundEffects";
import { hapticError, hapticSuccess } from "../../utils/haptics";

export const PasscodeLockOverlay: React.FC = () => {
  const {
    isEnabled,
    isLocked,
    isFingerprintEnabled,
    lockoutUntil,
    _hasHydrated,
    verifyPin,
    unlockWithBiometric,
    setBiometricPromptActive,
  } = useAppLockStore();
  const { isAuthenticated, user, logout } = useAuthStore();

  const shouldShow = Boolean(_hasHydrated && isAuthenticated && isEnabled && isLocked);
  useScrollLock(shouldShow);

  const [pin, setPin] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [statusText, setStatusText] = useState<string>("Enter your 4-digit passcode");
  const [cooldownSec, setCooldownSec] = useState(0);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const autoPromptedRef = useRef(false);

  // Sync cooldown countdown when locked out after repeated failures
  useEffect(() => {
    if (!shouldShow || !lockoutUntil) {
      setCooldownSec(0);
      return;
    }
    const updateRemaining = () => {
      const rem = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setCooldownSec(rem);
    };
    updateRemaining();
    const id = setInterval(updateRemaining, 500);
    return () => clearInterval(id);
  }, [shouldShow, lockoutUntil]);

  const triggerBiometricUnlock = useCallback(async () => {
    if (!biometricService.isNativeSupported()) return;
    setBiometricPromptActive(true);
    try {
      const res = await biometricService.authenticate({
        title: "Unlock AttendX",
        subtitle: "Confirm your fingerprint to access your attendance records",
        negativeButtonText: "Use Passcode",
      });
      if (res.verified) {
        hapticSuccess();
        SoundFX.playPasscodeSuccessSound();
        setIsSuccess(true);
        setStatusText("Identity verified");
        setTimeout(() => {
          unlockWithBiometric();
          setIsSuccess(false);
          setPin("");
        }, 160);
      } else if (res.lockout) {
        setStatusText("Too many fingerprint attempts. Use passcode.");
      }
    } finally {
      // Delay clearing slightly so Android appStateChange resume ignores biometric sheet dismissal
      setTimeout(() => setBiometricPromptActive(false), 350);
    }
  }, [setBiometricPromptActive, unlockWithBiometric]);

  useEffect(() => {
    if (!shouldShow) {
      setPin("");
      setIsError(false);
      setIsSuccess(false);
      setConfirmSignOut(false);
      autoPromptedRef.current = false;
      return;
    }

    setStatusText("Enter your 4-digit passcode");
    let cancelled = false;
    biometricService.isAvailable().then((avail) => {
      if (cancelled) return;
      setBiometricAvailable(avail.available);
      if (
        avail.available &&
        isFingerprintEnabled &&
        !autoPromptedRef.current &&
        (!lockoutUntil || Date.now() >= lockoutUntil)
      ) {
        autoPromptedRef.current = true;
        triggerBiometricUnlock();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [shouldShow, isFingerprintEnabled, lockoutUntil, triggerBiometricUnlock]);

  const handleDigit = useCallback(
    (digit: string) => {
      if (cooldownSec > 0 || isSuccess || pin.length >= 4) return;
      const next = pin + digit;
      setPin(next);
      setIsError(false);

      if (next.length === 4) {
        setTimeout(() => {
          const ok = verifyPin(next);
          if (ok) {
            hapticSuccess();
            SoundFX.playPasscodeSuccessSound();
            setIsSuccess(true);
            setStatusText("Unlocked");
            setTimeout(() => {
              setPin("");
              setIsSuccess(false);
            }, 150);
          } else {
            hapticError();
            SoundFX.playPasscodeErrorSound();
            setIsError(true);
            setStatusText("Incorrect passcode");
            setTimeout(() => {
              setPin("");
              setIsError(false);
            }, 420);
          }
        }, 120);
      }
    },
    [cooldownSec, isSuccess, pin, verifyPin],
  );

  const handleBackspace = useCallback(() => {
    if (cooldownSec > 0 || isSuccess) return;
    setPin((prev) => prev.slice(0, -1));
    setIsError(false);
  }, [cooldownSec, isSuccess]);

  if (!shouldShow || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AttendX Passcode Lock"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-50 dark:bg-[#05080b] text-slate-900 dark:text-slate-100 select-none overflow-y-auto"
    >
      <style>{`
        @keyframes vaultShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>

      {/* Subtle ambient background accents */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-28 -left-24 w-80 h-80 rounded-full bg-emerald-500/12 dark:bg-emerald-500/15 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-teal-500/10 dark:bg-sky-500/12 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-slate-200/90 dark:border-white/15 bg-white/85 dark:bg-[#0d1319]/90 backdrop-blur-2xl shadow-2xl p-6 sm:p-7 flex flex-col items-center gap-4">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-bold uppercase tracking-wider">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>AttendX Vault</span>
        </div>

        {/* Lock Emblem */}
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center border transition-all ${
            isError
              ? "bg-rose-500/15 border-rose-500/40 text-rose-500"
              : isSuccess
                ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-500 scale-105"
                : "bg-slate-100 dark:bg-white/[0.06] border-slate-200 dark:border-white/15 text-emerald-600 dark:text-emerald-400"
          }`}
        >
          <Lock className="w-7 h-7" />
        </div>

        <div className="text-center space-y-1">
          <h2 className="text-xl font-black tracking-tight">
            {user?.name ? `Locked • ${user.name.split(" ")[0]}` : "AttendX Locked"}
          </h2>
          <p
            className={`text-xs font-mono font-semibold h-4 ${
              cooldownSec > 0 || isError
                ? "text-rose-500"
                : isSuccess
                  ? "text-emerald-500"
                  : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {cooldownSec > 0
              ? `Too many attempts • Wait ${cooldownSec}s`
              : statusText}
          </p>
        </div>

        <PasscodePinBoxes
          valueLength={pin.length}
          isError={isError}
          isSuccess={isSuccess}
        />

        <PasscodeKeypad
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          showBiometric={biometricAvailable && isFingerprintEnabled}
          onBiometricPress={triggerBiometricUnlock}
          disabled={cooldownSec > 0 || isSuccess}
        />

        {biometricAvailable && isFingerprintEnabled && (
          <button
            type="button"
            onClick={triggerBiometricUnlock}
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
          >
            <Fingerprint className="w-4 h-4" />
            <span>Tap for Fingerprint Unlock</span>
          </button>
        )}

        <div className="pt-2 border-t border-slate-200/80 dark:border-white/10 w-full flex flex-col items-center gap-2">
          {!confirmSignOut ? (
            <button
              type="button"
              onClick={() => setConfirmSignOut(true)}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              Forgot passcode?
            </button>
          ) : (
            <div className="w-full rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-center space-y-2">
              <p className="text-[11px] text-slate-700 dark:text-slate-300">
                Sign out to reset your local passcode. Cloud attendance stays safe.
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmSignOut(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 text-white inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
