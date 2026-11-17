import React, { useEffect } from "react";
import { Delete, Fingerprint } from "lucide-react";
import { SoundFX } from "../../utils/soundEffects";
import { hapticLight, hapticSelection } from "../../utils/haptics";

const KEYPAD_ROWS = [
  [
    { digit: "1", sub: "" },
    { digit: "2", sub: "ABC" },
    { digit: "3", sub: "DEF" },
  ],
  [
    { digit: "4", sub: "GHI" },
    { digit: "5", sub: "JKL" },
    { digit: "6", sub: "MNO" },
  ],
  [
    { digit: "7", sub: "PQRS" },
    { digit: "8", sub: "TUV" },
    { digit: "9", sub: "WXYZ" },
  ],
];

interface PinBoxesProps {
  valueLength: number;
  maxLength?: number;
  isError?: boolean;
  isSuccess?: boolean;
}

export const PasscodePinBoxes: React.FC<PinBoxesProps> = ({
  valueLength,
  maxLength = 4,
  isError = false,
  isSuccess = false,
}) => {
  return (
    <div
      className={`flex items-center justify-center gap-3 py-2 ${
        isError ? "animate-[vaultShake_0.36s_ease-in-out]" : ""
      }`}
    >
      {Array.from({ length: maxLength }).map((_, i) => {
        const isFilled = i < valueLength;
        const isActive = !isSuccess && !isError && i === valueLength;
        return (
          <div
            key={i}
            className={`w-12 h-14 rounded-xl flex items-center justify-center font-mono font-black text-xl transition-all duration-200 border ${
              isError
                ? "bg-rose-500/15 border-rose-500 text-rose-500 scale-95 shadow-[0_0_14px_rgba(244,63,94,0.35)]"
                : isSuccess || isFilled
                  ? "bg-emerald-500/20 dark:bg-emerald-500/25 border-emerald-500 text-emerald-700 dark:text-emerald-300 scale-105 shadow-[0_0_16px_rgba(16,185,129,0.35)]"
                  : isActive
                    ? "bg-white dark:bg-white/[0.06] border-emerald-500/80 shadow-[0_0_14px_rgba(16,185,129,0.28)] scale-105"
                    : "bg-slate-100/90 dark:bg-white/[0.03] border-slate-300 dark:border-white/20"
            }`}
          >
            {isFilled ? "✦" : ""}
          </div>
        );
      })}
    </div>
  );
};

interface KeypadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onBiometricPress?: () => void;
  showBiometric?: boolean;
  disabled?: boolean;
  listenKeyboard?: boolean;
}

export const PasscodeKeypad: React.FC<KeypadProps> = ({
  onDigit,
  onBackspace,
  onBiometricPress,
  showBiometric = false,
  disabled = false,
  listenKeyboard = true,
}) => {
  useEffect(() => {
    if (!listenKeyboard || disabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        hapticLight();
        SoundFX.playKeyClickSound();
        onDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        hapticSelection();
        SoundFX.playKeyClickSound();
        onBackspace();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [listenKeyboard, disabled, onDigit, onBackspace]);

  const handleDigitClick = (digit: string) => {
    if (disabled) return;
    hapticLight();
    SoundFX.playKeyClickSound();
    onDigit(digit);
  };

  const handleDeleteClick = () => {
    if (disabled) return;
    hapticSelection();
    SoundFX.playKeyClickSound();
    onBackspace();
  };

  const keyBtnClass =
    "h-13 rounded-2xl border border-slate-200 dark:border-white/15 bg-white/90 dark:bg-white/[0.06] hover:bg-emerald-50 dark:hover:bg-white/[0.12] active:scale-95 active:bg-emerald-500/15 active:border-emerald-500/60 text-slate-900 dark:text-white shadow-sm backdrop-blur-md transition-all flex flex-col items-center justify-center cursor-pointer select-none disabled:opacity-40 disabled:pointer-events-none";

  return (
    <div className="grid grid-cols-3 gap-2.5 w-full max-w-[290px] mx-auto pt-1">
      {KEYPAD_ROWS.map((row) =>
        row.map(({ digit, sub }) => (
          <button
            key={digit}
            type="button"
            disabled={disabled}
            onClick={() => handleDigitClick(digit)}
            className={keyBtnClass}
          >
            <span className="text-lg font-bold leading-none">{digit}</span>
            {sub ? (
              <span className="text-[9px] font-mono tracking-wider opacity-45 mt-0.5">
                {sub}
              </span>
            ) : (
              <span className="h-2.5" />
            )}
          </button>
        )),
      )}

      {/* Bottom Row: Biometric button (or spacer) | 0 | Backspace */}
      {showBiometric && onBiometricPress ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            hapticSelection();
            SoundFX.playKeyClickSound();
            onBiometricPress();
          }}
          aria-label="Unlock with fingerprint"
          className={`${keyBtnClass} text-emerald-600 dark:text-emerald-400 border-emerald-500/30`}
        >
          <Fingerprint className="w-5 h-5" />
        </button>
      ) : (
        <div />
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => handleDigitClick("0")}
        className={keyBtnClass}
      >
        <span className="text-lg font-bold leading-none">0</span>
        <span className="text-[9px] font-mono opacity-45 mt-0.5">+</span>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={handleDeleteClick}
        aria-label="Delete digit"
        className={keyBtnClass}
      >
        <Delete className="w-5 h-5 opacity-80" />
      </button>
    </div>
  );
};
