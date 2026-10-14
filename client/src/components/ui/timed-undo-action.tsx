"use client";

import { cn } from "../../lib/utils";
import { Undo2, Trash2 } from "lucide-react";
import { useEffect, useState, type FC, type ReactNode } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import useMeasure from "react-use-measure";

export interface TimedUndoActionProps {
  initialSeconds?: number;
  deleteLabel?: string;
  undoLabel?: string;
  icon?: ReactNode;
  undoIcon?: ReactNode;
  onConfirm?: () => void;
  disabled?: boolean;
}

export const TimedUndoAction: FC<TimedUndoActionProps> = ({
  initialSeconds = 10,
  deleteLabel = "Delete Account",
  undoLabel = "Cancel Delete",
  icon,
  undoIcon,
  onConfirm,
  disabled = false,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [countDown, setCountDown] = useState(initialSeconds);
  const [ref, bounds] = useMeasure({ offsetSize: true });

  const handleDelete = () => {
    setIsDeleting((prev) => {
      const next = !prev;

      if (next) {
        setCountDown(initialSeconds);
      }

      return next;
    });
  };

  useEffect(() => {
    if (!isDeleting) return;

    const interval = setInterval(() => {
      setCountDown((prev) => {
        if (prev <= 1) {
          return 0; // Stop at 0
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isDeleting]);

  // Handle side-effects in a separate effect when countDown reaches 0
  useEffect(() => {
    if (isDeleting && countDown === 0) {
      setIsDeleting(false);
      onConfirm?.();
    }
  }, [countDown, isDeleting, onConfirm]);

  return (
    <div className="flex items-center justify-center font-sans">
      <div className="flex flex-col items-center justify-center will-change-transform">
        <MotionConfig
          transition={{
            type: "spring",
            stiffness: 250,
            damping: 22,
          }}
        >
          <motion.div
            className={cn(
              "relative flex h-[42px] items-center justify-start overflow-hidden rounded-xl border transition-all duration-300",
              isDeleting
                ? "bg-rose-950/80 border-rose-500/50 shadow-md shadow-rose-950/40 text-rose-100"
                : "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/25 hover:border-rose-500/40",
              disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "cursor-pointer"
            )}
            animate={{
              width: bounds.width > 0 ? bounds.width : "auto",
            }}
            onClick={disabled ? undefined : handleDelete}
          >
            <div
              className={cn(
                "flex h-[42px] items-center justify-center gap-2 px-4 select-none",
                isDeleting && "px-3 gap-2.5"
              )}
              ref={ref}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {isDeleting ? (
                  <motion.div
                    key="undo-icon"
                    className="flex items-center justify-center w-6 h-6 rounded-lg bg-rose-500/25 border border-rose-500/40 text-rose-200 shrink-0"
                    initial={{ opacity: 0, scale: 0.6, filter: "blur(2px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 0.6, filter: "blur(2px)" }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    {undoIcon ?? <Undo2 className="w-3.5 h-3.5" />}
                  </motion.div>
                ) : (
                  <motion.div
                    key="delete-icon"
                    className="flex items-center justify-center text-rose-400 shrink-0"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    {icon ?? <Trash2 className="w-4 h-4" />}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-center">
                <AnimatedText
                  text={isDeleting ? undoLabel : deleteLabel}
                  className={cn(
                    "text-sm font-bold tracking-tight whitespace-nowrap",
                    isDeleting ? "text-rose-100" : "text-rose-400"
                  )}
                />
              </div>

              <AnimatePresence mode="popLayout">
                {isDeleting && (
                  <motion.div
                    className="flex items-center justify-center w-6 h-6 rounded-lg bg-rose-500 text-white font-mono text-xs font-bold shrink-0 overflow-hidden shadow-sm"
                    initial={{ opacity: 0, scale: 0.5, filter: "blur(2px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 0.5, filter: "blur(2px)" }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <AnimatePresence mode="popLayout">
                      <motion.span
                        key={countDown}
                        className="inline-block text-xs font-bold tabular-nums leading-none"
                        initial={{ opacity: 0, y: -12, scale: 0.7 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 12, scale: 0.7 }}
                        transition={{
                          type: "spring",
                          stiffness: 280,
                          damping: 18,
                          mass: 0.8,
                        }}
                      >
                        {countDown}
                      </motion.span>
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </MotionConfig>
      </div>
    </div>
  );
};

function AnimatedText({
  text,
  className,
  delayStep = 0.014,
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
          style={{ display: "inline-flex ", willChange: "transform" }}
        >
          {chars.map((char, i) => (
            <motion.span
              key={i}
              initial={{
                y: 10,
                opacity: 0,
                scale: 0.5,
                filter: "blur(2px)",
              }}
              animate={{
                y: 0,
                opacity: 1,
                scale: 1,
                filter: "blur(0px)",
              }}
              exit={{
                y: -10,
                opacity: 0,
                scale: 0.5,
                filter: "blur(2px)",
              }}
              transition={{
                type: "spring",
                stiffness: 240,
                damping: 16,
                mass: 1.2,
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

export default TimedUndoAction;
