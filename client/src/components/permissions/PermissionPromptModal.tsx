import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlarmClock,
  Bell,
  CheckCircle2,
  Lock,
  Mic,
  ShieldCheck,
  VolumeX,
  X,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import {
  AppPermissionKey,
  AppPermissionSnapshot,
  PermissionService,
} from "../../services/PermissionService";
import { useScrollLock } from "../../hooks/useScrollLock";
import { hapticLight, hapticSuccess } from "../../utils/haptics";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const PERMISSION_ITEMS: Array<{
  key: AppPermissionKey;
  title: string;
  desc: string;
  icon: React.FC<{ className?: string }>;
  required: boolean;
}> = [
  {
    key: "notifications",
    title: "Notifications",
    desc: "Class reminders, summaries & classroom broadcasts",
    icon: Bell,
    required: true,
  },
  {
    key: "exactAlarms",
    title: "Alarms & Reminders",
    desc: "Exact-minute class countdowns & auto-unmute timing",
    icon: AlarmClock,
    required: true,
  },
  {
    key: "microphone",
    title: "Microphone",
    desc: "AttendX AI voice commands & hands-free assistant",
    icon: Mic,
    required: true,
  },
  {
    key: "dndAccess",
    title: "Do Not Disturb Access",
    desc: "Optional 1-tap silent mode during active lectures",
    icon: VolumeX,
    required: false,
  },
];

export const PermissionPromptModal: React.FC<Props> = ({ isOpen, onClose }) => {
  useScrollLock(isOpen);
  const [snapshot, setSnapshot] = useState<AppPermissionSnapshot>(
    PermissionService.getCachedSnapshot(),
  );
  const [requestingKey, setRequestingKey] = useState<AppPermissionKey | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    PermissionService.getSnapshot().then(setSnapshot);
    const unsub = PermissionService.subscribe(setSnapshot);

    const refresh = () => {
      PermissionService.getSnapshot();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    let appHandle: any = null;
    if (Capacitor.isNativePlatform()) {
      import("@capacitor/app")
        .then(({ App: CapApp }) =>
          CapApp.addListener("appStateChange", ({ isActive }) => {
            if (isActive) refresh();
          }),
        )
        .then((h) => {
          appHandle = h;
        })
        .catch(() => {});
    }

    return () => {
      unsub();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      if (appHandle?.remove) appHandle.remove();
    };
  }, [isOpen]);

  const missingRequired = PERMISSION_ITEMS.filter(
    (item) => item.required && !snapshot[item.key],
  );
  const allRequiredGranted = missingRequired.length === 0;

  useEffect(() => {
    if (isOpen && allRequiredGranted) {
      hapticSuccess();
      const timer = setTimeout(() => {
        onClose();
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [isOpen, allRequiredGranted, onClose]);

  const handleRequest = async (key: AppPermissionKey) => {
    hapticLight();
    setRequestingKey(key);
    try {
      const granted = await PermissionService.requestSmart(key);
      if (granted) hapticSuccess();
    } finally {
      setRequestingKey(null);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="perm-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={onClose}
          className="fixed inset-0 z-[115] flex items-center justify-center px-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] sm:p-4 bg-white/55 dark:bg-black/65 backdrop-blur-xl"
        >
          <motion.div
            key="perm-modal-card"
            initial={{ opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white/88 dark:bg-[#0d0e11]/90 backdrop-blur-2xl border border-slate-900/10 dark:border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[86vh]"
          >
            {/* Header */}
            <div className="p-5 pb-4 border-b border-slate-900/10 dark:border-white/10 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition-colors duration-300 ${
                    allRequiredGranted
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                  }`}
                >
                  {allRequiredGranted ? (
                    <ShieldCheck className="w-5 h-5" />
                  ) : (
                    <Lock className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {allRequiredGranted ? "All Levels Unlocked" : "Unlock App Permissions"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {allRequiredGranted
                      ? "Alerts, alarms, and voice controls are ready"
                      : `${missingRequired.length} core permission${missingRequired.length === 1 ? "" : "s"} needed for full access`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  hapticLight();
                  onClose();
                }}
                className="w-8 h-8 rounded-full hover:bg-slate-900/10 dark:hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
                aria-label="Close permissions prompt"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Permission List */}
            <div className="p-4 sm:p-5 space-y-2.5 overflow-y-auto">
              {PERMISSION_ITEMS.map((item) => {
                const granted = snapshot[item.key];
                const Icon = item.icon;
                const isBusy = requestingKey === item.key;

                return (
                  <motion.div
                    key={item.key}
                    layout
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className={`p-3.5 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-3 ${
                      granted
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : "bg-slate-900/[0.04] dark:bg-white/[0.04] border-slate-900/10 dark:border-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300 ${
                          granted
                            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                            : "bg-slate-900/10 dark:bg-white/10 text-slate-600 dark:text-slate-400 grayscale"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-foreground">
                            {item.title}
                          </span>
                          {!granted && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                              <Lock className="w-2.5 h-2.5" />
                              Locked
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                          {item.desc}
                        </p>
                      </div>
                    </div>

                    {granted ? (
                      <motion.span
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full bg-emerald-500/15 shrink-0"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Active
                      </motion.span>
                    ) : (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleRequest(item.key)}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-slate-50 dark:bg-slate-50 dark:text-slate-950 text-xs font-bold shrink-0 hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isBusy ? "Checking..." : "Enable"}
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-900/10 dark:border-white/10 flex items-center justify-between gap-2 bg-white/40 dark:bg-white/[0.02]">
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  onClose();
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-slate-900/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                {allRequiredGranted ? "Done" : "Remind Next Open"}
              </button>

              {!allRequiredGranted && missingRequired[0] && (
                <button
                  type="button"
                  onClick={() => handleRequest(missingRequired[0].key)}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-slate-50 dark:bg-slate-50 dark:text-slate-950 text-xs font-bold hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                >
                  Enable {missingRequired[0].title}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
