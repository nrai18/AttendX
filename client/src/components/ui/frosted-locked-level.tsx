import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Lock, Sparkles, Unlock } from "lucide-react";
import { hapticLight, hapticSuccess } from "../../utils/haptics";

interface FrostedLockedLevelProps {
  isLocked: boolean;
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  onUnlock: () => void | Promise<void>;
  children: React.ReactNode;
  className?: string;
}

export const FrostedLockedLevel: React.FC<FrostedLockedLevelProps> = ({
  isLocked,
  title = "Permission Required",
  subtitle = "Enable access to unlock this feature",
  actionLabel = "Unlock Level",
  onUnlock,
  children,
  className = "",
}) => {
  const wasLockedRef = useRef<boolean>(isLocked);
  const [showUnlockBurst, setShowUnlockBurst] = useState(false);

  useEffect(() => {
    if (wasLockedRef.current && !isLocked) {
      setShowUnlockBurst(true);
      hapticSuccess();
      const t = setTimeout(() => setShowUnlockBurst(false), 1100);
      wasLockedRef.current = isLocked;
      return () => clearTimeout(t);
    }
    wasLockedRef.current = isLocked;
  }, [isLocked]);

  return (
    <div
      className={`relative rounded-2xl overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        showUnlockBurst
          ? "ring-2 ring-emerald-500/60 shadow-[0_0_28px_-4px_rgba(16,185,129,0.4)]"
          : ""
      } ${className}`}
    >
      {/* Underlying interactive card smoothly transitions from frosted/desaturated -> vivid/unlocked */}
      <div
        aria-hidden={isLocked}
        className={`transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] origin-center ${
          isLocked
            ? "grayscale-[88%] opacity-35 scale-[0.985] blur-[1px] pointer-events-none select-none"
            : "grayscale-0 opacity-100 scale-100 blur-0"
        }`}
      >
        {children}
      </div>

      {/* Activation Unlock Transition Sweep */}
      <AnimatePresence>
        {showUnlockBurst && (
          <motion.div
            key="unlock-burst"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.92, 1.02, 1, 1.04] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500/15 via-transparent to-emerald-400/20"
          >
            <motion.div
              initial={{ scale: 0.7, y: 8, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: -10, opacity: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/30"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Unlocked</span>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game-Level Frosted Lock Veil */}
      <AnimatePresence>
        {isLocked && (
          <motion.div
            key="frosted-lock"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.03 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => {
              hapticLight();
              onUnlock();
            }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4 sm:p-5 text-center cursor-pointer bg-white/55 dark:bg-[#07080b]/60 backdrop-blur-[5px] border border-slate-900/15 dark:border-white/15 rounded-2xl group"
          >
            <motion.div
              initial={{ scale: 0.85, y: 6 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.75, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
              className="flex flex-col items-center gap-2.5 max-w-xs"
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-white/85 dark:bg-[#13151a]/90 border border-slate-900/15 dark:border-white/20 shadow-lg flex items-center justify-center text-slate-800 dark:text-slate-100 group-hover:scale-105 transition-transform duration-200">
                  <Lock className="w-5 h-5" />
                </div>
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-500 ring-2 ring-white dark:ring-[#0c0d0e] animate-pulse" />
              </div>

              <div className="space-y-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-900/10 dark:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-900/10 dark:border-white/10">
                  Locked Feature
                </span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                  {title}
                </h4>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                  {subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  hapticLight();
                  onUnlock();
                }}
                className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-slate-50 dark:bg-slate-50 dark:text-slate-950 text-xs font-bold shadow-md hover:opacity-90 active:scale-95 transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
                <span>{actionLabel}</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
