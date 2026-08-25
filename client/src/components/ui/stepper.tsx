"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HiMinus, HiPlus } from "react-icons/hi";

export interface StepperProps {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  onChange?: (val: number) => void;
  size?: "sm" | "md" | "lg";
}

const digitVariants = {
  initial: (dir: number) => ({
    y: dir > 0 ? 20 : -20,
    opacity: 0,
    scale: 0.5,
    z: 0,
    filter: "blur(2px)",
  }),
  animate: {
    y: 0,
    opacity: 1,
    scale: 1,
    z: 10,
    filter: "blur(0px)",
  },
  exit: (dir: number) => ({
    y: dir > 0 ? -20 : 20,
    opacity: 0,
    scale: 0.5,
    z: 0,
    filter: "blur(2px)",
  }),
};

export function Stepper({
  value,
  defaultValue = 0,
  min = 0,
  max = 999,
  onChange,
  size = "md"
}: StepperProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState(defaultValue);
  const [direction, setDirection] = React.useState(0);

  const current = isControlled ? value! : internal;
  const digits = current.toString().split("");

  const digitTicksRef = React.useRef<number[]>([]);
  const prevDigitsRef = React.useRef<string[]>([]);

  const prevDigits = prevDigitsRef.current;
  const prevTicks = digitTicksRef.current;

  const len = digits.length;
  const prevLen = prevDigits.length;

  const lenDiff = len - prevLen;

  const nextTicks = digits.map((digit, i) => {
    const prevI = i - lenDiff;
    const prevDigit = prevI >= 0 ? prevDigits[prevI] : undefined;
    const prevTick = prevI >= 0 ? prevTicks[prevI] : 0;

    return digit !== prevDigit ? (prevTick ?? 0) + 1 : prevTick ?? 0;
  });

  React.useEffect(() => {
    digitTicksRef.current = nextTicks;
    prevDigitsRef.current = digits;
  }, [nextTicks, digits]);

  const step = (dir: number) => {
    const next = Math.min(max, Math.max(min, current + dir));
    if (next === current) return;
    setDirection(dir);
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  const containerClasses = size === "sm" ? "gap-1.5 px-1 py-1" : size === "lg" ? "gap-4 px-2 py-2 sm:gap-6" : "gap-3 px-1 py-1 sm:gap-5";
  const btnClasses = size === "sm" ? "h-6 w-6" : size === "lg" ? "h-14 w-14 sm:h-16 sm:w-16" : "h-11 w-11 sm:h-14 sm:w-14";
  const textClasses = size === "sm" ? "text-sm sm:h-5 sm:text-base gap-0.5" : size === "lg" ? "text-3xl sm:h-10 sm:text-5xl gap-1.5" : "text-xl sm:h-8 sm:text-3xl gap-1";
  const digitWidth = size === "sm" ? "w-2 sm:w-2.5" : size === "lg" ? "w-5 sm:w-6" : "w-3 sm:w-4";

  return (
    <div className="flex w-full justify-center">
      <div className={`flex items-center rounded-full border-2 border-[#E6E6EF] bg-transparent shadow-sm dark:border-zinc-800 ${containerClasses}`}>
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          onClick={() => step(-1)}
          disabled={current <= min}
          className={`flex shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#F0EFF6] text-[#5A5A63] disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-400 ${btnClasses}`}
        >
          <HiMinus className={size === "sm" ? "h-3 w-3" : "h-4 w-4 sm:h-5 sm:w-5"} />
        </motion.button>

        <div className={`relative flex shrink-0 items-center justify-center font-bold text-[#242426] perspective-midrange transform-3d dark:text-white ${textClasses}`}>
          {digits.map((digit, index) => (
            <div
              key={`${index}-${len}`}
              className={`relative transform-3d ${digitWidth}`}
            >
              <AnimatePresence
                mode="popLayout"
                initial={false}
                custom={direction}
              >
                <motion.span
                  key={nextTicks[index]}
                  custom={direction}
                  variants={digitVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 16,
                    mass: 1.2,
                  }}
                  className="absolute inset-0 flex items-center justify-center tabular-nums"
                >
                  {digit}
                </motion.span>
              </AnimatePresence>
            </div>
          ))}
        </div>

        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          onClick={() => step(1)}
          disabled={current >= max}
          className={`flex shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#F0EFF6] text-[#5A5A63] disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-400 ${btnClasses}`}
        >
          <HiPlus className={size === "sm" ? "h-3 w-3" : "h-4 w-4 sm:h-5 sm:w-5"} />
        </motion.button>
      </div>
    </div>
  );
}
