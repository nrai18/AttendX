import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Clock,
  Fingerprint,
  Gem,
  KeyRound,
  Lock,
  ShieldCheck,
  ShieldOff,
  X,
} from "lucide-react";
import { useAppLockStore } from "../../stores/appLockStore";
import { biometricService, BiometricAvailability } from "../../services/biometricService";
import { PasscodeKeypad, PasscodePinBoxes } from "./PasscodeKeypad";
import { useScrollLock } from "../../hooks/useScrollLock";
import { SoundFX } from "../../utils/soundEffects";
import { hapticError, hapticSelection, hapticSuccess } from "../../utils/haptics";
import { toast } from "sonner";

type SetupStep =
  | "intro"
  | "create"
  | "confirm"
  | "fingerprint"
  | "manage"
  | "verify_for_change"
  | "verify_for_disable";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const AUTO_LOCK_OPTIONS = [
  { label: "Immediate", ms: 0 },
  { label: "1 min", ms: 60_000 },
  { label: "5 min", ms: 300_000 },
];

export const PasscodeSetupModal: React.FC<Props> = ({ isOpen, onClose }) => {
  useScrollLock(isOpen);

  const {
    isEnabled,
    isFingerprintEnabled,
    autoLockTimeoutMs,
    enablePasscode,
    disablePasscode,
    verifyPin,
    setFingerprintEnabled,
    setAutoLockTimeoutMs,
    setBiometricPromptActive,
    lockNow,
  } = useAppLockStore();

  const [step, setStep] = useState<SetupStep>("intro");
  const [pinInput, setPinInput] = useState("");
  const [draftPin, setDraftPin] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [feedback, setFeedback] = useState("Tap keys below");
  const [biometricInfo, setBiometricInfo] = useState<BiometricAvailability>({
    available: false,
    biometryType: "none",
  });
  const [vaultTilt, setVaultTilt] = useState({ x: 0, y: 0 });
  const [fingerScanMsg, setFingerScanMsg] = useState("Tap optical sensor to test fingerprint");

  useEffect(() => {
    if (!isOpen) return;
    setStep(isEnabled ? "manage" : "intro");
    setPinInput("");
    setDraftPin("");
    setIsError(false);
    setIsSuccess(false);
    setFeedback("Tap keys below");
    biometricService.isAvailable().then(setBiometricInfo);
  }, [isOpen, isEnabled]);

  const resetPinEntry = (msg: string) => {
    setPinInput("");
    setIsError(false);
    setIsSuccess(false);
    setFeedback(msg);
  };

  const handleDigit = useCallback(
    (digit: string) => {
      if (isSuccess || pinInput.length >= 4) return;
      const next = pinInput + digit;
      setPinInput(next);
      setIsError(false);

      if (next.length < 4) return;

      setTimeout(() => {
        if (step === "create") {
          setDraftPin(next);
          setStep("confirm");
          resetPinEntry("Re-enter the 4 digits to confirm");
          return;
        }

        if (step === "confirm") {
          if (next === draftPin) {
            hapticSuccess();
            SoundFX.playPasscodeSuccessSound();
            setIsSuccess(true);
            setFeedback("✓ Passcode Activated");
            enablePasscode(next);
            setTimeout(() => {
              setIsSuccess(false);
              setPinInput("");
              if (biometricInfo.available) {
                setStep("fingerprint");
                setFingerScanMsg("Tap optical sensor to test fingerprint");
              } else {
                toast.success("Passcode lock enabled");
                setStep("manage");
              }
            }, 550);
          } else {
            hapticError();
            SoundFX.playPasscodeErrorSound();
            setIsError(true);
            setFeedback("Passcodes didn't match. Try again.");
            setTimeout(() => {
              setStep("create");
              setDraftPin("");
              resetPinEntry("Create a 4-digit passcode");
            }, 550);
          }
          return;
        }

        if (step === "verify_for_change" || step === "verify_for_disable") {
          const ok = verifyPin(next);
          if (!ok) {
            hapticError();
            SoundFX.playPasscodeErrorSound();
            setIsError(true);
            setFeedback("Incorrect current passcode");
            setTimeout(() => resetPinEntry("Enter current 4-digit passcode"), 450);
            return;
          }
          hapticSuccess();
          SoundFX.playPasscodeSuccessSound();
          if (step === "verify_for_change") {
            setStep("create");
            setDraftPin("");
            resetPinEntry("Enter your new 4-digit passcode");
          } else {
            disablePasscode();
            toast.success("Passcode lock turned off");
            onClose();
          }
        }
      }, 120);
    },
    [
      biometricInfo.available,
      disablePasscode,
      draftPin,
      enablePasscode,
      isSuccess,
      onClose,
      pinInput,
      step,
      verifyPin,
    ],
  );

  const handleBackspace = useCallback(() => {
    if (isSuccess) return;
    setPinInput((prev) => prev.slice(0, -1));
    setIsError(false);
  }, [isSuccess]);

  const handleScanFingerprint = async () => {
    hapticSelection();
    SoundFX.playKeyClickSound();

    if (!biometricInfo.available) {
      toast.info(
        biometricInfo.reason === "none_enrolled"
          ? "Enroll a fingerprint in Android Settings first."
          : "Biometric hardware unlock is only available on Android devices.",
      );
      return;
    }

    setFingerScanMsg("Waiting for fingerprint sensor...");
    setBiometricPromptActive(true);
    try {
      const res = await biometricService.authenticate({
        title: "Enable Fingerprint Unlock",
        subtitle: "Verify your fingerprint to pair it with AttendX Vault",
        negativeButtonText: "Cancel",
      });
      if (res.verified) {
        hapticSuccess();
        SoundFX.playPasscodeSuccessSound();
        setFingerprintEnabled(true);
        setFingerScanMsg("✓ Fingerprint Verified & Active");
        toast.success("Fingerprint unlock enabled");
      } else {
        setFingerScanMsg(res.errorMessage || "Verification cancelled");
      }
    } finally {
      setTimeout(() => setBiometricPromptActive(false), 350);
    }
  };

  const handleToggleFingerprint = async () => {
    hapticSelection();
    if (isFingerprintEnabled) {
      setFingerprintEnabled(false);
      toast.success("Fingerprint unlock disabled");
      return;
    }
    await handleScanFingerprint();
  };

  if (!isOpen || typeof document === "undefined") return null;

  const isPinScreen =
    step === "create" ||
    step === "confirm" ||
    step === "verify_for_change" ||
    step === "verify_for_disable";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Passcode Lock Settings"
      className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <style>{`
        @keyframes vaultShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        @keyframes scannerRadar {
          0% { top: 14%; opacity: 0.85; }
          50% { top: 82%; opacity: 1; }
          100% { top: 14%; opacity: 0.85; }
        }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-[2rem] border border-slate-200 dark:border-white/15 bg-white/95 dark:bg-[#0b1016]/95 backdrop-blur-2xl text-slate-900 dark:text-slate-100 shadow-2xl p-6 space-y-5 relative"
      >
        {/* Top Modal Navigation Header */}
        <div className="flex items-center justify-between">
          {step === "intro" || step === "manage" ? (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>AttendX Vault</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                hapticSelection();
                if (step === "confirm") {
                  setStep("create");
                  resetPinEntry("Create a 4-digit passcode");
                } else if (step === "fingerprint") {
                  setStep("manage");
                } else {
                  setStep(isEnabled ? "manage" : "intro");
                }
              }}
              className="w-9 h-9 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
            {step === "create"
              ? "Step 1 of 2"
              : step === "confirm"
                ? "Step 2 of 2"
                : step === "fingerprint"
                  ? "Biometrics"
                  : "Security"}
          </span>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* VIEW A: PASSCODE INTRO (3D Liquid Glass Vault Chamber) */}
        {step === "intro" && (
          <div className="flex flex-col items-center text-center space-y-5 pt-2">
            {/* 4 Preview Boxes */}
            <div className="flex items-center gap-2.5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-9 h-11 rounded-lg border border-slate-300 dark:border-white/20 bg-slate-100 dark:bg-white/[0.05] flex items-center justify-center font-mono font-black text-sm text-emerald-600 dark:text-emerald-400"
                >
                  ✦
                </div>
              ))}
            </div>

            {/* Interactive 3D Tiltable Safe Chamber */}
            <div
              className="w-36 h-36 flex items-center justify-center"
              style={{ perspective: "900px" }}
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - r.left - r.width / 2;
                const y = e.clientY - r.top - r.height / 2;
                setVaultTilt({ x: x * 0.25, y: -y * 0.25 });
              }}
              onMouseLeave={() => setVaultTilt({ x: 0, y: 0 })}
            >
              <div
                className="w-32 h-32 rounded-3xl border-2 border-emerald-500/45 bg-gradient-to-br from-emerald-500/10 via-white/80 to-slate-100 dark:from-emerald-950/60 dark:via-slate-900/80 dark:to-black/80 shadow-xl flex items-center justify-center relative transition-transform duration-150"
                style={{
                  transform: `rotateY(${vaultTilt.x}deg) rotateX(${vaultTilt.y}deg)`,
                }}
              >
                <div className="w-22 h-22 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 dark:bg-emerald-950/40 flex items-center justify-center shadow-inner">
                  <div className="w-11 h-11 rounded-full bg-emerald-500/20 border border-emerald-400/60 flex items-center justify-center text-emerald-600 dark:text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.35)]">
                    <Gem className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-black tracking-tight">Passcode Lock</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xs leading-relaxed mx-auto">
                When a passcode is set, a lock icon appears at the top of AttendX. Tap it anytime to protect your attendance records and offline logs.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                hapticSelection();
                SoundFX.playKeyClickSound();
                setStep("create");
                resetPinEntry("Please enter any 4 digits");
              }}
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-lg shadow-emerald-600/25 transition-all cursor-pointer active:scale-[0.98]"
            >
              Enable Passcode
            </button>
          </div>
        )}

        {/* VIEW B: PIN ENTRY (Create / Confirm / Verify Current) */}
        {isPinScreen && (
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl border border-amber-500/40 bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-300 relative shadow-sm">
              <Lock className="w-6 h-6" />
              <KeyRound className="w-3.5 h-3.5 absolute -bottom-1 -right-1 text-emerald-500" />
            </div>

            <div>
              <h2 className="text-lg font-black tracking-tight">
                {step === "create"
                  ? "Create a passcode"
                  : step === "confirm"
                    ? "Confirm your passcode"
                    : step === "verify_for_change"
                      ? "Enter current passcode"
                      : "Confirm passcode to disable"}
              </h2>
              <p
                className={`text-xs font-mono font-bold mt-1 h-4 ${
                  isError
                    ? "text-rose-500"
                    : isSuccess
                      ? "text-emerald-500"
                      : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {feedback}
              </p>
            </div>

            <PasscodePinBoxes
              valueLength={pinInput.length}
              isError={isError}
              isSuccess={isSuccess}
            />

            <PasscodeKeypad
              onDigit={handleDigit}
              onBackspace={handleBackspace}
              disabled={isSuccess}
            />
          </div>
        )}

        {/* VIEW C: FINGERPRINT OPTICAL SENSOR SETUP */}
        {step === "fingerprint" && (
          <div className="flex flex-col items-center text-center space-y-4">
            <span className="px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300">
              BIOMETRIC SENSOR
            </span>

            <div>
              <h2 className="text-lg font-black tracking-tight">Add Fingerprint</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xs mx-auto mt-1">
                Use your device's fingerprint sensor for fast one-touch unlock.
              </p>
            </div>

            <button
              type="button"
              onClick={handleScanFingerprint}
              className="relative w-32 h-32 flex items-center justify-center cursor-pointer group"
            >
              <span className="absolute inset-0 rounded-full border-2 border-emerald-500/30 animate-ping opacity-25" />
              <span className="w-28 h-28 rounded-full border-2 border-emerald-500/60 bg-slate-100 dark:bg-white/[0.04] shadow-xl flex items-center justify-center relative overflow-hidden group-hover:scale-105 active:scale-95 transition-transform">
                <span
                  className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_10px_#34d399]"
                  style={{ animation: "scannerRadar 2.2s ease-in-out infinite" }}
                />
                <Fingerprint className="w-13 h-13 text-emerald-500" />
              </span>
            </button>

            <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 min-h-4">
              {fingerScanMsg}
            </p>

            <div className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-white/15 bg-slate-100/80 dark:bg-white/[0.04] flex items-center justify-between">
              <span className="text-xs font-bold">Enable Fingerprint Unlock</span>
              <button
                type="button"
                role="switch"
                aria-checked={isFingerprintEnabled}
                onClick={handleToggleFingerprint}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  isFingerprintEnabled
                    ? "bg-emerald-600"
                    : "bg-slate-300 dark:bg-zinc-700"
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white shadow transition-transform absolute top-1 ${
                    isFingerprintEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                toast.success("AttendX Vault configured");
                setStep("manage");
              }}
              className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm cursor-pointer"
            >
              Finish Setup
            </button>
          </div>
        )}

        {/* VIEW D: ACTIVE SECURITY MANAGEMENT */}
        {step === "manage" && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-slate-50 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold">Passcode Lock Active</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    4-digit PIN barrier enabled
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  hapticSelection();
                  SoundFX.playLogoutChimeSound();
                  onClose();
                  lockNow();
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-50 dark:bg-slate-50 dark:hover:bg-white dark:text-slate-900 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer shadow-xs transition-colors"
              >
                Lock Now
              </button>
            </div>

            {/* Fingerprint Row */}
            <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/[0.04] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Fingerprint className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold">Unlock with Fingerprint</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {biometricInfo.available
                      ? "Use Android fingerprint sensor"
                      : "Requires Android device with enrolled fingerprint"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isFingerprintEnabled}
                onClick={handleToggleFingerprint}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${
                  isFingerprintEnabled
                    ? "bg-emerald-600"
                    : "bg-slate-300 dark:bg-zinc-700"
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white shadow transition-transform absolute top-1 ${
                    isFingerprintEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Auto-Lock Timeout */}
            <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/[0.04] space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Clock className="w-4 h-4 text-emerald-500" />
                <span>Auto-Lock After Leaving App</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {AUTO_LOCK_OPTIONS.map((opt) => {
                  const active = autoLockTimeoutMs === opt.ms;
                  return (
                    <button
                      key={opt.ms}
                      type="button"
                      onClick={() => {
                        hapticSelection();
                        SoundFX.playKeyClickSound();
                        setAutoLockTimeoutMs(opt.ms);
                      }}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        active
                          ? "bg-emerald-600 text-white border-emerald-500 shadow-sm"
                          : "bg-white dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Change / Disable Actions */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  hapticSelection();
                  setStep("verify_for_change");
                  resetPinEntry("Enter current 4-digit passcode");
                }}
                className="py-3 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-100 dark:bg-white/[0.06] text-xs font-bold cursor-pointer hover:bg-slate-200 dark:hover:bg-white/[0.12]"
              >
                Change Passcode
              </button>
              <button
                type="button"
                onClick={() => {
                  hapticSelection();
                  setStep("verify_for_disable");
                  resetPinEntry("Enter current passcode to disable");
                }}
                className="py-3 rounded-xl border border-rose-500/35 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-rose-500/20"
              >
                <ShieldOff className="w-3.5 h-3.5" />
                <span>Turn Off</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
