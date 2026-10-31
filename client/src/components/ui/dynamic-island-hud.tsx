import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Send, CheckCircle2, Trash2, GraduationCap, Sparkles, FileText, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { hapticSuccess, hapticMedium, hapticLight, hapticSelection } from "../../utils/haptics";
import { SoundFX } from "../../utils/soundEffects";

export interface HUDConfig {
  id: string;
  title?: string;
  label?: string;
  subtitle?: string;
  type?: "plane" | "butterfly" | "trash" | "cap" | "sparkle" | "success" | "origami" | "hub" | "sun" | "moon";
  durationMs?: number;
  route?: string;
  silent?: boolean;
}

let hudTriggerFn: ((config: HUDConfig) => void) | null = null;
let hudActiveUntil = 0;

export const isDynamicHUDActive = (): boolean => {
  return Date.now() < hudActiveUntil;
};

export const triggerDynamicHUD = (config: Omit<HUDConfig, "id">) => {
  SoundFX.warmUp();
  const duration = config.durationMs || 4500;
  hudActiveUntil = Date.now() + duration;
  // Dismiss any overlapping toast so the dynamic island HUD has exclusive clarity
  try {
    toast.dismiss();
  } catch {}
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("attendx-dynamic-hud", { detail: config }));
  }
  if (hudTriggerFn) {
    hudTriggerFn({ ...config, id: String(Date.now()) });
  }
};

export const DynamicIslandHUD: React.FC = () => {
  const [currentHUD, setCurrentHUD] = useState<HUDConfig | null>(null);

  useEffect(() => {
    const handleTrigger = (config: HUDConfig) => {
      setCurrentHUD(config);
      if (!config.silent) {
        SoundFX.playWhooshSound(0.20);
        SoundFX.playDynamicHUDSound(config.type);
      }
      if (config.type === "plane" || config.type === "success" || config.type === "cap" || config.type === "hub") {
        hapticSuccess();
      } else if (config.type === "trash" || config.type === "butterfly" || config.type === "origami") {
        hapticMedium();
      } else if (config.type === "sun" || config.type === "moon") {
        hapticSelection();
      } else {
        hapticLight();
      }
    };

    hudTriggerFn = handleTrigger;

    const handleCustomEvent = (e: any) => {
      if (e?.detail) {
        handleTrigger({ ...e.detail, id: String(Date.now()) });
      }
    };
    window.addEventListener("attendx-dynamic-hud", handleCustomEvent);

    return () => {
      hudTriggerFn = null;
      window.removeEventListener("attendx-dynamic-hud", handleCustomEvent);
    };
  }, []);

  useEffect(() => {
    if (!currentHUD) return;
    const timer = setTimeout(() => {
      setCurrentHUD(null);
    }, currentHUD.durationMs || 4500);
    return () => clearTimeout(timer);
  }, [currentHUD]);

  // Glow halo tint mapped by HUD type
  const getGlowShadow = (type?: string) => {
    switch (type) {
      case "plane":
      case "success":
        return "shadow-[0_10px_28px_rgba(16,185,129,0.2),0_2px_8px_rgba(15,23,42,0.06)] dark:shadow-[0_12px_36px_rgba(16,185,129,0.35),0_2px_8px_rgba(0,0,0,0.6)]";
      case "trash":
        return "shadow-[0_10px_28px_rgba(244,63,94,0.2),0_2px_8px_rgba(15,23,42,0.06)] dark:shadow-[0_12px_36px_rgba(244,63,94,0.35),0_2px_8px_rgba(0,0,0,0.6)]";
      case "hub":
      case "cap":
      case "origami":
        return "shadow-[0_10px_28px_rgba(245,158,11,0.2),0_2px_8px_rgba(15,23,42,0.06)] dark:shadow-[0_12px_36px_rgba(245,158,11,0.35),0_2px_8px_rgba(0,0,0,0.6)]";
      case "butterfly":
        return "shadow-[0_10px_28px_rgba(168,85,247,0.2),0_2px_8px_rgba(15,23,42,0.06)] dark:shadow-[0_12px_36px_rgba(168,85,247,0.35),0_2px_8px_rgba(0,0,0,0.6)]";
      case "sun":
        return "shadow-[0_10px_28px_rgba(245,158,11,0.25),0_2px_8px_rgba(15,23,42,0.06)] dark:shadow-[0_12px_36px_rgba(245,158,11,0.35),0_2px_8px_rgba(0,0,0,0.6)]";
      case "moon":
        return "shadow-[0_10px_28px_rgba(99,102,241,0.2),0_2px_8px_rgba(15,23,42,0.06)] dark:shadow-[0_12px_36px_rgba(255,255,255,0.18),0_2px_8px_rgba(0,0,0,0.6)]";
      case "sparkle":
      default:
        return "shadow-[0_10px_28px_rgba(59,130,246,0.2),0_2px_8px_rgba(15,23,42,0.06)] dark:shadow-[0_12px_36px_rgba(59,130,246,0.35),0_2px_8px_rgba(0,0,0,0.6)]";
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: "calc(env(safe-area-inset-top, 0px) + 8px)",
        left: 0,
        right: 0,
        zIndex: 2147483647,
        pointerEvents: "none",
        display: "flex",
        justifyContent: "center",
        paddingLeft: "16px",
        paddingRight: "16px",
      }}
    >
      <AnimatePresence mode="wait">
        {currentHUD && (
          <motion.div
            key={currentHUD.id}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.35}
            onDragEnd={(_e, info) => {
              if (info.offset.y < -15 || info.velocity.y < -100) {
                SoundFX.playWhooshSound(0.18);
                hapticLight();
                setCurrentHUD(null);
              }
            }}
            onClick={() => {
              SoundFX.playWhooshSound(0.18);
              hapticLight();
              if (currentHUD.route) {
                try {
                  sessionStorage.setItem("pending_push_route", currentHUD.route);
                } catch (_) {}
                window.dispatchEvent(new CustomEvent("push_route", { detail: currentHUD.route }));
              }
              setCurrentHUD(null);
            }}
            initial={{ 
              y: -85, 
              scale: 0.68, 
              opacity: 0, 
              filter: "blur(10px)", 
              rotateX: 28,
              transformPerspective: 800
            }}
            animate={{ 
              y: 0, 
              scale: 1, 
              opacity: 1, 
              filter: "blur(0px)", 
              rotateX: 0,
              transformPerspective: 800
            }}
            exit={{ 
              y: -80, 
              scale: 0.72, 
              opacity: 0, 
              filter: "blur(10px)", 
              rotateX: -22,
              transformPerspective: 800,
              transition: { duration: 0.28, ease: [0.32, 0, 0.67, 0] }
            }}
            transition={{ type: "spring", stiffness: 440, damping: 25, mass: 0.72 }}
            className={`pointer-events-auto select-none cursor-pointer flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/95 dark:bg-[#0a0a0c]/95 backdrop-blur-2xl border border-slate-200/90 dark:border-white/15 text-slate-900 dark:text-white max-w-[calc(100vw-24px)] sm:max-w-lg transition-all active:scale-95 ${getGlowShadow(
              currentHUD.type
            )}`}
          >
            {/* Animated Icon Badge */}
            <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/10 border border-slate-200/80 dark:border-white/20 flex items-center justify-center shrink-0 overflow-hidden">
              {currentHUD.type === "plane" && (
                <motion.div
                  initial={{ x: -12, y: 10, rotate: -20, opacity: 0 }}
                  animate={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                >
                  <Send className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 rotate-45" />
                </motion.div>
              )}
              {currentHUD.type === "butterfly" && (
                <motion.div
                  animate={{ rotate: [-8, 8, -8], scale: [0.9, 1.1, 0.9] }}
                  transition={{ repeat: Infinity, duration: 0.6 }}
                >
                  <span className="text-xs">🦋</span>
                </motion.div>
              )}
              {currentHUD.type === "trash" && (
                <motion.div
                  initial={{ rotate: 12, scale: 0.8 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 450, damping: 20 }}
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                </motion.div>
              )}
              {(currentHUD.type === "cap" || currentHUD.type === "hub") && (
                <motion.div
                  initial={{ rotate: -15, scale: 0.8 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 450, damping: 20 }}
                >
                  <GraduationCap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                </motion.div>
              )}
              {currentHUD.type === "sparkle" && (
                <Sparkles className="w-3.5 h-3.5 text-sky-600 dark:text-blue-400" />
              )}
              {currentHUD.type === "origami" && (
                <motion.div
                  animate={{ rotate: [0, 45, 90, 180, 360], scale: [1, 0.85, 0.65, 0.4, 0.85] }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                >
                  <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                </motion.div>
              )}
              {currentHUD.type === "sun" && (
                <motion.div
                  initial={{ rotate: -90, scale: 0.5, opacity: 0 }}
                  animate={{ rotate: 0, scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 450, damping: 18 }}
                >
                  <Sun className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
                </motion.div>
              )}
              {currentHUD.type === "moon" && (
                <motion.div
                  initial={{ rotate: 90, scale: 0.5, opacity: 0 }}
                  animate={{ rotate: 0, scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 450, damping: 18 }}
                >
                  <Moon className="w-3.5 h-3.5 text-sky-500 dark:text-neutral-200 fill-sky-500/20 dark:fill-white/10" />
                </motion.div>
              )}
              {(!currentHUD.type || currentHUD.type === "success") && (
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 450, damping: 20 }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </motion.div>
              )}
            </div>

            {/* Text Info */}
            <div className="flex flex-col pr-1 min-w-0 flex-1">
              <span className="text-xs font-bold tracking-tight text-slate-900 dark:text-white/95 leading-tight break-words">
                {currentHUD.title || currentHUD.label}
              </span>
              {currentHUD.subtitle && (
                <span className="text-[10.5px] text-slate-600 dark:text-white/70 font-medium leading-tight mt-0.5 break-words">
                  {currentHUD.subtitle}
                </span>
              )}
            </div>

            {/* Subtle Dismiss Cue */}
            <div className="w-1.5 h-1.5 rounded-full bg-slate-400/50 dark:bg-white/30 shrink-0 ml-auto" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
};
