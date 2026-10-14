import React, { useRef, useEffect } from "react";
import { cn } from "../../lib/utils";
import { hapticSelection, hapticMedium } from "../../utils/haptics";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  hasError?: boolean;
  isValidated?: boolean;
  onComplete?: (code: string) => void;
  className?: string;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  value,
  onChange,
  length = 6,
  disabled = false,
  autoFocus = true,
  hasError = false,
  isValidated = false,
  onComplete,
  className,
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Derived array of single characters
  const digits = Array.from({ length }, (_, i) => value[i] || "");

  useEffect(() => {
    if (autoFocus && !disabled && !isValidated) {
      const firstEmptyIndex = digits.findIndex((d) => !d);
      const targetIndex = firstEmptyIndex === -1 ? 0 : firstEmptyIndex;
      inputRefs.current[targetIndex]?.focus();
    }
  }, [autoFocus, disabled, isValidated]);

  const handleInputChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const cleaned = rawVal.replace(/\D/g, "");

    if (!cleaned) {
      const newDigits = [...digits];
      newDigits[index] = "";
      const newOtp = newDigits.join("");
      onChange(newOtp);
      return;
    }

    if (cleaned.length > 1) {
      handlePastedDigits(cleaned, index);
      return;
    }

    const singleDigit = cleaned.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = singleDigit;
    const newOtp = newDigits.join("");
    onChange(newOtp);
    hapticSelection();

    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus();
      inputRefs.current[index + 1]?.select();
    }

    if (newOtp.length === length && !newOtp.includes("")) {
      onComplete?.(newOtp);
    }
  };

  const handlePastedDigits = (pastedText: string, startIndex: number = 0) => {
    const cleaned = pastedText.replace(/\D/g, "").slice(0, length);
    if (!cleaned) return;

    hapticMedium();
    const newDigits = [...digits];
    for (let i = 0; i < cleaned.length; i++) {
      if (startIndex + i < length) {
        newDigits[startIndex + i] = cleaned[i];
      }
    }
    const newOtp = newDigits.join("").slice(0, length);
    onChange(newOtp);

    const nextIdx = Math.min(startIndex + cleaned.length, length - 1);
    inputRefs.current[nextIdx]?.focus();

    if (newOtp.length === length) {
      onComplete?.(newOtp);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        e.preventDefault();
        const newDigits = [...digits];
        newDigits[index - 1] = "";
        onChange(newDigits.join(""));
        inputRefs.current[index - 1]?.focus();
        hapticSelection();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, index: number) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    handlePastedDigits(pasted, index === 0 ? 0 : index);
  };

  return (
    <div className={cn("flex items-center justify-between gap-1.5 sm:gap-2.5 w-full max-w-sm mx-auto", className)}>
      {digits.map((digit, index) => {
        const isFilled = Boolean(digit);
        return (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            maxLength={1}
            value={digit}
            placeholder=""
            disabled={disabled || isValidated}
            onChange={(e) => handleInputChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={(e) => handlePaste(e, index)}
            onFocus={(e) => e.target.select()}
            aria-label={`Digit ${index + 1} of ${length}`}
            className={cn(
              "w-11 h-13 sm:w-12 sm:h-14 text-center font-mono text-xl sm:text-2xl font-bold rounded-xl transition-all duration-200 outline-none select-none",
              "bg-slate-50 dark:bg-[#151518] text-slate-900 dark:text-white border shadow-sm",
              !hasError && !isValidated && !isFilled && "border-slate-300 dark:border-[#2C2C32]",
              !hasError && !isValidated && isFilled && "border-slate-400 dark:border-slate-500 bg-white dark:bg-[#19191D]",
              "focus:border-[#E63946] focus:ring-2 focus:ring-[#E63946]/25 dark:focus:ring-[#E63946]/30 focus:bg-white dark:focus:bg-[#1D1D22] focus:scale-[1.04]",
              hasError && "border-rose-500 ring-2 ring-rose-500/20 bg-rose-500/5 text-rose-500",
              isValidated && "border-emerald-500 bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/30",
              (disabled || isValidated) && "opacity-60 cursor-not-allowed pointer-events-none"
            )}
          />
        );
      })}
    </div>
  );
};
