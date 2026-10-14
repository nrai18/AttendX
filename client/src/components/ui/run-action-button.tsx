import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, type Transition } from "motion/react";
import { Zap } from "lucide-react";
import { HiBadgeCheck } from "react-icons/hi";
import { IoCloseSharp } from "react-icons/io5";
import { FaInbox } from "react-icons/fa6";
import { RiBubbleChartFill } from "react-icons/ri";
import { BsFileTextFill, BsSendFill, BsTagFill } from "react-icons/bs";
import { TbClockHour12Filled } from "react-icons/tb";

function AnimatedText({
  text,
  className,
  delayStep = 0.012,
}: {
  text: string;
  className?: string;
  delayStep?: number;
}) {
  const chars = text.split("");

  return (
    <span className={className} style={{ display: "inline-flex" }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          style={{ display: "inline-flex", willChange: "transform" }}
        >
          {chars.map((char, i) => (
            <motion.span
              key={i}
              initial={{
                y: 8,
                opacity: 0,
                scale: 0.7,
              }}
              animate={{
                y: 0,
                opacity: 1,
                scale: 1,
              }}
              exit={{
                y: -8,
                opacity: 0,
                scale: 0.7,
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 20,
                mass: 0.9,
                delay: i * delayStep,
              }}
              style={{
                display: "inline-block",
                whiteSpace: char === " " ? "pre" : undefined,
              }}
            >
              {char}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

const spring: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 22,
  mass: 0.8,
};

const DEFAULT_STEPS = [
  { id: 1, label: "Importing Survey Data", icon: FaInbox },
  { id: 2, label: "Refining Responses", icon: RiBubbleChartFill },
  { id: 3, label: "Labelling Responses", icon: BsTagFill },
  { id: 4, label: "Analyzing Sentiment", icon: TbClockHour12Filled },
  { id: 5, label: "Creating Reports", icon: BsFileTextFill },
  { id: 6, label: "Sharing Survey Report", icon: BsSendFill },
];

export interface RunActionButtonProps {
  steps?: {
    id: number;
    label: string;
    icon: React.ElementType;
  }[];
  action?: (signal?: AbortSignal) => Promise<void>;
  onCancel?: () => void;
  disabled?: boolean;
  idleLabel?: string;
  doneLabel?: string;
  idleIcon?: React.ReactNode;
  widths?: { idle: number | string; running: number | string; done: number | string };
  fullWidth?: boolean;
  height?: number | string;
  stepIntervalMs?: number;
  showTimer?: boolean;
  isAi?: boolean;
  subLabel?: string;
  className?: string;
}

export function RunActionButton({
  steps = DEFAULT_STEPS,
  action,
  onCancel,
  disabled,
  idleLabel = "Run Action",
  doneLabel = "Finalizing Data",
  idleIcon = <Zap className="h-5 w-5 fill-current text-primary-foreground opacity-90" />,
  widths = { idle: 160, running: 260, done: 160 },
  fullWidth = false,
  height = 48,
  stepIntervalMs = 1650,
  showTimer = true,
  isAi = false,
  subLabel,
  className,
}: RunActionButtonProps) {
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsedTenths, setElapsedTenths] = useState(0);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const reset = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus("idle");
    setCurrentStep(0);
    setElapsedTenths(0);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    onCancel?.();
    reset();
  };

  const startAction = async () => {
    if (disabled || status === "running") return;
    setStatus("running");
    setCurrentStep(0);
    setElapsedTenths(0);

    if (action) {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      try {
        await action(controller.signal);
        if (!controller.signal.aborted) {
          setStatus("done");
          setTimeout(() => {
            setStatus((curr) => (curr === "done" ? "idle" : curr));
          }, 2500);
        }
      } catch (e: any) {
        setStatus("idle");
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    }
  };

  // Adaptive step progression — progresses cleanly through all steps
  // and stays locked on the final step without looping backwards.
  useEffect(() => {
    if (status !== "running") return;

    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleNext = (stepIdx: number) => {
      // If we've reached the last step, do NOT schedule further steps.
      // Lock on final step and let live timer run until action resolves.
      if (stepIdx >= steps.length - 1) {
        if (!action) {
          setStatus("done");
          setTimeout(() => setStatus("idle"), 2500);
        }
        return;
      }

      const ratio = steps.length > 1 ? stepIdx / (steps.length - 1) : 0;
      const adaptiveDelay = action
        ? Math.round(stepIntervalMs * (1 + ratio * 1.8))
        : stepIntervalMs;

      timeoutId = setTimeout(() => {
        setCurrentStep((prev) => {
          if (prev < steps.length - 1) {
            const next = prev + 1;
            scheduleNext(next);
            return next;
          }
          return prev;
        });
      }, adaptiveDelay);
    };

    scheduleNext(0);
    return () => clearTimeout(timeoutId);
  }, [status, steps.length, action, stepIntervalMs]);

  // High-frequency 100ms elapsed timer so user always sees live activity
  useEffect(() => {
    if (status !== "running" || !showTimer) return;
    const startMs = Date.now();
    const timer = setInterval(() => {
      setElapsedTenths(Math.floor((Date.now() - startMs) / 100));
    }, 100);
    return () => clearInterval(timer);
  }, [status, showTimer]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const formattedTime = `${(elapsedTenths / 10).toFixed(1)}s`;
  const progressPercent =
    steps.length > 1
      ? Math.min(96, Math.round(((currentStep + 1) / steps.length) * 100))
      : 75;

  const effectiveWidths = fullWidth
    ? { idle: "100%", running: "100%", done: "100%" }
    : widths;

  return (
    <div className={`flex items-center justify-center min-w-0 max-w-full ${fullWidth ? "w-full" : ""} ${className || ""}`}>
      <motion.div
        initial={false}
        animate={{ width: effectiveWidths[status] }}
        transition={spring}
        style={{
          width: effectiveWidths[status],
          maxWidth: "100%",
          height: typeof height === "number" ? `${height}px` : height,
        }}
        className={`relative flex items-center justify-between overflow-hidden rounded-2xl shadow-xs transition-colors ${
          status === "running"
            ? "border border-primary/40 dark:border-primary/30 bg-primary/5 dark:bg-primary/10"
            : "border border-transparent"
        } ${disabled && status === "idle" ? "opacity-50 pointer-events-none" : ""}`}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {status === "idle" && (
            <motion.button
              key="btn-start"
              type="button"
              exit={{ y: -20, opacity: 0, filter: "blur(2px)" }}
              transition={spring}
              className="flex h-full w-full items-center justify-center gap-2 bg-primary font-bold text-sm text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer px-4 select-none min-w-0"
              onClick={startAction}
              disabled={disabled}
            >
              {idleIcon}
              <span className="truncate">{idleLabel}</span>
            </motion.button>
          )}

          {status === "running" && (
            <motion.div
              key="running"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={spring}
              className="relative flex flex-1 h-full items-center justify-between gap-1.5 px-3 min-w-0 w-full overflow-hidden"
            >
              {/* Left: icon + label + sublabel with fluid truncation */}
              <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, scale: 0.4, rotate: -15 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.4, rotate: 15 }}
                    transition={spring}
                    className="relative flex items-center justify-center shrink-0 w-5 h-5"
                  >
                    <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                    {React.createElement(steps[currentStep]?.icon || Zap, {
                      className: "relative w-3.5 h-3.5 text-primary shrink-0",
                    })}
                  </motion.div>
                </AnimatePresence>

                <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={steps[currentStep]?.label || currentStep}
                      initial={{ y: 5, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -5, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="text-xs font-bold text-foreground truncate leading-tight"
                    >
                      {steps[currentStep]?.label || "Processing..."}
                    </motion.span>
                  </AnimatePresence>
                  <span className="text-[10px] font-medium text-muted-foreground leading-tight truncate">
                    Step {currentStep + 1} of {steps.length} • {subLabel || (isAi ? "AI active" : "In progress")}
                  </span>
                </div>
              </div>

              {/* Right: Timer pill & Cancel button */}
              <div className="flex items-center gap-1.5 shrink-0 pl-1">
                {showTimer && (
                  <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-background/90 dark:bg-black/70 border border-border/80 text-[11px] font-mono font-bold text-foreground tabular-nums shadow-xs shrink-0 select-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)] shrink-0 animate-pulse" />
                    <span className="min-w-[28px] text-right">{formattedTime}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleCancel}
                  title="Cancel action"
                  aria-label="Cancel action"
                  className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-destructive/15 hover:bg-destructive/25 active:scale-95 text-destructive transition-colors cursor-pointer shrink-0"
                >
                  <IoCloseSharp className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Animated Progress Bar along the bottom edge */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-border/40 overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: "8%" }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          )}

          {status === "done" && (
            <motion.button
              key="done"
              type="button"
              onClick={reset}
              initial={{ opacity: 0, scale: 0.85, filter: "blur(2px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.85, filter: "blur(2px)" }}
              transition={spring}
              className="flex flex-1 h-full w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 px-4 text-emerald-600 dark:text-emerald-400 font-bold text-sm whitespace-nowrap select-none"
            >
              <HiBadgeCheck className="h-5 w-5 text-emerald-500 shrink-0" />
              <span className="truncate">{doneLabel}</span>
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
