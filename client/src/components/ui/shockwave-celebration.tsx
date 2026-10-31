import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Sparkles } from "lucide-react";

export interface ShockwaveConfig {
  id: string;
  title?: string;
  subtitle?: string;
  durationMs?: number;
}

let triggerShockwaveFn: ((config: Omit<ShockwaveConfig, "id">) => void) | null = null;

export const triggerShockwaveCelebration = (config: Omit<ShockwaveConfig, "id"> = {}) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("attendx-shockwave-celebration", { detail: config }));
  }
  if (triggerShockwaveFn) {
    triggerShockwaveFn(config);
  }
};

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
}

const PARTICLE_COLORS = [
  "#10B981", // emerald-500
  "#34D399", // emerald-400
  "#F59E0B", // amber-500
  "#FBBF24", // amber-400
  "#6EE7B7", // emerald-300
  "#38BDF8", // sky-400
  "#FFFFFF", // crisp white
];

function generateParticles(count = 36): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI + (Math.random() - 0.5) * 0.3;
    const distance = 90 + Math.random() * 240;
    particles.push({
      id: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 20, // subtle upward bias
      size: 3 + Math.random() * 5,
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      delay: Math.random() * 0.2,
      duration: 2.4 + Math.random() * 1.4,
    });
  }
  return particles;
}

export const ShockwaveCelebrationOverlay: React.FC = () => {
  const [activeCelebration, setActiveCelebration] = useState<ShockwaveConfig | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const trigger = (config: Omit<ShockwaveConfig, "id">) => {
      setActiveCelebration({
        ...config,
        id: String(Date.now()),
        durationMs: config.durationMs || 4200,
      });
      setParticles(generateParticles(42));
    };

    triggerShockwaveFn = trigger;
    const handleCustomEvent = (e: any) => {
      if (e?.detail) trigger(e.detail);
    };
    window.addEventListener("attendx-shockwave-celebration", handleCustomEvent);

    return () => {
      triggerShockwaveFn = null;
      window.removeEventListener("attendx-shockwave-celebration", handleCustomEvent);
    };
  }, []);

  useEffect(() => {
    if (!activeCelebration) return;
    const timer = setTimeout(() => {
      setActiveCelebration(null);
    }, activeCelebration.durationMs || 4200);
    return () => clearTimeout(timer);
  }, [activeCelebration]);

  return (
    <div className="fixed inset-0 z-[9990] pointer-events-none overflow-hidden flex items-center justify-center">
      <AnimatePresence>
        {activeCelebration && (
          <div key={activeCelebration.id} className="relative w-full h-full flex items-center justify-center">
            {/* Dark contrast backdrop vignette */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.45, 0.45, 0] }}
              transition={{ duration: 3.8, times: [0, 0.15, 0.85, 1] }}
              className="absolute inset-0 bg-black/50 backdrop-blur-[2px] pointer-events-none"
            />

            {/* Ambient Radial Flash & Bloom (Phase 1: 0.0s - 1.2s) */}
            <motion.div
              initial={{ scale: 0.2, opacity: 0 }}
              animate={{ scale: [0.2, 1.8, 2.6], opacity: [0, 0.45, 0] }}
              transition={{ duration: 1.4, ease: "easeOut" }}
              className="absolute w-[500px] h-[500px] rounded-full bg-radial from-emerald-500/30 via-amber-400/15 to-transparent blur-3xl"
            />

            {/* Shockwave Ring 1 (Emerald Fast Pulse - Phase 1 & 2) */}
            <motion.div
              initial={{ scale: 0, opacity: 0.95 }}
              animate={{ scale: [0, 3.8], opacity: [0.95, 0] }}
              transition={{ duration: 2.0, ease: [0.16, 1, 0.3, 1] }}
              className="absolute w-64 h-64 rounded-full border-2 border-emerald-400/80 shadow-[0_0_50px_rgba(52,211,153,0.8),inset_0_0_30px_rgba(52,211,153,0.4)]"
            />

            {/* Shockwave Ring 2 (Golden Cascade - Phase 2) */}
            <motion.div
              initial={{ scale: 0, opacity: 0.85 }}
              animate={{ scale: [0, 4.4], opacity: [0.85, 0] }}
              transition={{ duration: 2.4, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="absolute w-64 h-64 rounded-full border-2 border-amber-300/70 shadow-[0_0_40px_rgba(252,211,77,0.7),inset_0_0_20px_rgba(252,211,77,0.3)]"
            />

            {/* Shockwave Ring 3 (Celestial Teal Echo - Phase 2) */}
            <motion.div
              initial={{ scale: 0, opacity: 0.7 }}
              animate={{ scale: [0, 5.0], opacity: [0.7, 0] }}
              transition={{ duration: 2.8, delay: 0.38, ease: [0.16, 1, 0.3, 1] }}
              className="absolute w-64 h-64 rounded-full border border-teal-300/60 shadow-[0_0_35px_rgba(94,234,212,0.6)]"
            />

            {/* Micro-Physics Stardust Sparks (Phase 2 & 3: 0.2s - 4.2s) */}
            {particles.map((p) => (
              <motion.div
                key={p.id}
                initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                animate={{
                  x: [0, p.x * 0.7, p.x, p.x * 1.05],
                  y: [0, p.y * 0.7, p.y, p.y + 45], // gravity pull downward
                  scale: [0, 1.4, 1, 0],
                  opacity: [1, 1, 0.8, 0],
                }}
                transition={{
                  duration: p.duration,
                  delay: p.delay,
                  ease: [0.22, 1, 0.36, 1],
                }}
                style={{
                  position: "absolute",
                  width: p.size,
                  height: p.size,
                  borderRadius: "50%",
                  backgroundColor: p.color,
                  boxShadow: `0 0 10px ${p.color}, 0 0 20px ${p.color}`,
                }}
              />
            ))}

            {/* Central Levitation & Graduation Cap Emblem (Phase 1, 2, 3) */}
            <motion.div
              initial={{ scale: 0, y: 40, rotate: -25, opacity: 0 }}
              animate={{
                scale: [0, 1.25, 1, 1.05, 0.9],
                y: [40, -10, 0, -8, -35],
                rotate: [-25, 10, -3, 0, 0],
                opacity: [0, 1, 1, 1, 0],
              }}
              transition={{
                duration: 4.0,
                times: [0, 0.2, 0.35, 0.8, 1],
                ease: "easeInOut",
              }}
              className="relative z-10 flex flex-col items-center justify-center"
            >
              {/* Outer Radiant Glow */}
              <div className="relative flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                  className="absolute w-28 h-28 rounded-full border border-dashed border-amber-400/40 opacity-70"
                />

                <div className="w-20 h-20 rounded-3xl bg-linear-to-tr from-emerald-600 via-teal-500 to-amber-400 p-[2px] shadow-[0_0_50px_rgba(16,185,129,0.7)] flex items-center justify-center">
                  <div className="w-full h-full rounded-[22px] bg-[#101014]/90 backdrop-blur-2xl flex items-center justify-center relative overflow-hidden">
                    {/* Shimmer sweep */}
                    <motion.div
                      animate={{ x: [-80, 80] }}
                      transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                      className="absolute inset-0 w-8 bg-linear-to-r from-transparent via-white/30 to-transparent skew-x-12"
                    />
                    <GraduationCap className="w-10 h-10 text-amber-300 drop-shadow-[0_0_12px_rgba(252,211,77,0.9)]" />
                  </div>
                </div>

                {/* Orbiting Sparkles */}
                <motion.div
                  animate={{ scale: [0.8, 1.3, 0.8], rotate: [0, 180, 360] }}
                  transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                  className="absolute -top-3 -right-3 text-amber-300 drop-shadow-[0_0_10px_rgba(252,211,77,0.8)]"
                >
                  <Sparkles className="w-6 h-6" />
                </motion.div>
              </div>

              {/* Celebratory Text Card */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: [0, 1, 1, 0], y: [15, 0, 0, -10] }}
                transition={{ duration: 3.8, times: [0, 0.25, 0.85, 1], delay: 0.1 }}
                className="mt-4 px-5 py-2.5 rounded-2xl bg-black/80 backdrop-blur-2xl border border-white/20 text-center shadow-2xl"
              >
                <div className="text-sm font-extrabold text-transparent bg-clip-text bg-linear-to-r from-emerald-400 via-teal-200 to-amber-300">
                  {activeCelebration.title || "Semester Activated!"}
                </div>
                {activeCelebration.subtitle && (
                  <div className="text-[11px] font-medium text-slate-300 mt-0.5">
                    {activeCelebration.subtitle}
                  </div>
                )}
              </motion.div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
