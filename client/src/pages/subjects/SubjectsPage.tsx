import { useCacheStore } from "../../stores/cacheStore";
import React, { useState, useEffect, useRef } from "react";
import { Plus, Pencil, Trash2, Loader2, AlertCircle, TrendingUp, TrendingDown, CheckCircle2, XCircle, Shield, LayoutDashboard, Sparkles } from "lucide-react";
import { PageSkeleton } from "../../components/common/PageSkeleton";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { CreateSemesterModal } from "../../components/semester/CreateSemesterModal";
import { SubjectModal } from "../../components/subjects/SubjectModal";
import { useAuthStore } from "../../stores/authStore";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { useNavigate, useLocation } from "react-router-dom";
import { useBackHandlerStore } from "../../stores/backHandlerStore";
import { hapticMedium, hapticHeavy, hapticSelection, hapticSuccess } from "../../utils/haptics";
import { SoundFX } from "../../utils/soundEffects";
import { triggerDynamicHUD } from "../../components/ui/dynamic-island-hud";
import { confirmDeleteToast } from "../../components/ui/confirm-delete-toast";

interface Subject {
  id: string;
  name: string;
  code?: string;
  faculty?: string;
  colorHex?: string;
  targetAttendance?: number;
  _count?: { attendance: number };
}

interface SubjectStat {
  id: string;
  name: string;
  code?: string;
  colorHex?: string;
  target: number;
  attended: number;
  missed: number;
  off: number;
  total: number;
  percentage: number;
  canMiss: number;
  needAttend: number;
}

const getStatusMessage = (stat: SubjectStat): { text: string; color: string } => {
  if (stat.total === 0) return { text: "No classes recorded yet", color: "text-foreground dark:text-white/70" };
  if (stat.percentage >= stat.target) {
    return stat.canMiss > 0
      ? { text: `Can miss ${stat.canMiss} lecture${stat.canMiss > 1 ? "s" : ""}`, color: "text-emerald-600 dark:text-emerald-300" }
      : { text: "Can't miss the next lecture", color: "text-amber-600 dark:text-yellow-300" };
  }
  return {
    text: `Need to attend ${stat.needAttend} lecture${stat.needAttend > 1 ? "s" : ""}`,
    color: "text-red-600 dark:text-red-300",
  };
};

const StatBadge: React.FC<{ stat: SubjectStat }> = ({ stat }) => {
  const rawPct = Number(stat.percentage);
  const pct = isNaN(rawPct) ? 0 : Math.round(rawPct * 10) / 10;
  const target = Number(stat.target) || 75;
  const isGood = pct >= target;
  const isWarning = pct >= target && (stat.canMiss ?? 0) === 0;

  let bgColor = isGood ? (isWarning ? "bg-yellow-500/20 border-yellow-500/30" : "bg-emerald-500/20 border-emerald-500/30") : "bg-red-500/20 border-red-500/30";
  let textColor = isGood ? (isWarning ? "text-amber-600 dark:text-yellow-300" : "text-emerald-600 dark:text-emerald-300") : "text-red-600 dark:text-red-300";

  return (
    <div className={`flex flex-col items-center justify-center rounded-xl border px-3 py-2 min-w-[72px] ${bgColor}`}>
      <span className={`text-xl font-bold leading-none ${textColor}`}>{pct}</span>
      <div className="w-full h-px bg-black/10 dark:bg-white/10 my-1" />
      <span className={`text-xs font-semibold ${textColor}`}>{target}</span>
    </div>
  );
};

const SubjectCard: React.FC<{
  stat: SubjectStat;
  onEdit: () => void;
  onDelete: () => void;
  isFluttering?: boolean;
  isPopping?: boolean;
}> = ({ stat, onEdit, onDelete, isFluttering, isPopping }) => {
  const navigate = useNavigate();
  const statusMsg = getStatusMessage(stat);
  const pct = stat.percentage;

  // When deleting: render the Break-into-Butterfly Metamorphosis & 3D Flight Rig
  if (isFluttering) {
    return (
      <div 
        id={`subject-card-${stat.id}`}
        className="relative w-full pointer-events-none select-none"
        style={{
          minHeight: "135px",
          perspective: "1200px",
          zIndex: 60,
          animation: "cardSlotCollapse 4.0s ease-in-out forwards",
        }}
      >
        {/* Phase 1: Card Physically Breaks into 4 Geometric Shards (0.0s – 0.75s) */}
        <div className="relative w-full h-[135px] overflow-visible">
          {/* Top-Left Shard */}
          <div
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{
              clipPath: "polygon(0 0, 53% 0, 47% 50%, 0 47%)",
              animation: "shardBreakTL 0.75s cubic-bezier(0.25, 0.8, 0.25, 1) forwards",
            }}
          >
            <div className="w-full bg-white/70 dark:bg-black/40 backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl p-4 relative shadow-lg">
              <div className="absolute top-0 left-0 w-1.5 h-full rounded-l-2xl" style={{ backgroundColor: stat.colorHex || "#8b5cf6" }} />
              <div className="pl-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-foreground dark:text-white leading-tight truncate">{stat.name}</h3>
                    <p className={`text-xs mt-0.5 font-medium ${statusMsg.color}`}>{statusMsg.text}</p>
                  </div>
                  <StatBadge stat={stat} />
                </div>
                <div className="h-1.5 bg-black/20 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: pct >= stat.target ? (stat.canMiss === 0 ? "#eab308" : "#10b981") : "#ef4444" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Top-Right Shard */}
          <div
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{
              clipPath: "polygon(53% 0, 100% 0, 100% 53%, 47% 50%)",
              animation: "shardBreakTR 0.75s cubic-bezier(0.25, 0.8, 0.25, 1) forwards",
            }}
          >
            <div className="w-full bg-white/70 dark:bg-black/40 backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl p-4 relative shadow-lg">
              <div className="absolute top-0 left-0 w-1.5 h-full rounded-l-2xl" style={{ backgroundColor: stat.colorHex || "#8b5cf6" }} />
              <div className="pl-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-foreground dark:text-white leading-tight truncate">{stat.name}</h3>
                    <p className={`text-xs mt-0.5 font-medium ${statusMsg.color}`}>{statusMsg.text}</p>
                  </div>
                  <StatBadge stat={stat} />
                </div>
                <div className="h-1.5 bg-black/20 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: pct >= stat.target ? (stat.canMiss === 0 ? "#eab308" : "#10b981") : "#ef4444" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom-Left Shard */}
          <div
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{
              clipPath: "polygon(0 47%, 47% 50%, 50% 100%, 0 100%)",
              animation: "shardBreakBL 0.75s cubic-bezier(0.25, 0.8, 0.25, 1) forwards",
            }}
          >
            <div className="w-full bg-white/70 dark:bg-black/40 backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl p-4 relative shadow-lg">
              <div className="absolute top-0 left-0 w-1.5 h-full rounded-l-2xl" style={{ backgroundColor: stat.colorHex || "#8b5cf6" }} />
              <div className="pl-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-foreground dark:text-white leading-tight truncate">{stat.name}</h3>
                    <p className={`text-xs mt-0.5 font-medium ${statusMsg.color}`}>{statusMsg.text}</p>
                  </div>
                  <StatBadge stat={stat} />
                </div>
                <div className="h-1.5 bg-black/20 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: pct >= stat.target ? (stat.canMiss === 0 ? "#eab308" : "#10b981") : "#ef4444" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom-Right Shard */}
          <div
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{
              clipPath: "polygon(47% 50%, 100% 53%, 100% 100%, 50% 100%)",
              animation: "shardBreakBR 0.75s cubic-bezier(0.25, 0.8, 0.25, 1) forwards",
            }}
          >
            <div className="w-full bg-white/70 dark:bg-black/40 backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl p-4 relative shadow-lg">
              <div className="absolute top-0 left-0 w-1.5 h-full rounded-l-2xl" style={{ backgroundColor: stat.colorHex || "#8b5cf6" }} />
              <div className="pl-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-foreground dark:text-white leading-tight truncate">{stat.name}</h3>
                    <p className={`text-xs mt-0.5 font-medium ${statusMsg.color}`}>{statusMsg.text}</p>
                  </div>
                  <StatBadge stat={stat} />
                </div>
                <div className="h-1.5 bg-black/20 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: pct >= stat.target ? (stat.canMiss === 0 ? "#eab308" : "#10b981") : "#ef4444" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Golden Fracture Crack Lightning Network */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 400 140"
            preserveAspectRatio="none"
            style={{ animation: "fractureFlash 0.5s ease-out forwards" }}
          >
            <defs>
              <linearGradient id={`fracture-glow-${stat.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                <stop offset="50%" stopColor="#FFD700" stopOpacity="0.95" />
                <stop offset="100%" stopColor={stat.colorHex || "#a855f7"} stopOpacity="0.85" />
              </linearGradient>
            </defs>
            <path d="M 200 0 L 195 25 L 205 50 L 190 75 L 210 100 L 198 120 L 200 140" stroke={`url(#fracture-glow-${stat.id})`} strokeWidth="3" fill="none" style={{ filter: "drop-shadow(0 0 8px #FFD700)" }} />
            <path d="M 195 25 L 140 18 L 80 40 L 0 35" stroke={`url(#fracture-glow-${stat.id})`} strokeWidth="2.2" fill="none" style={{ filter: "drop-shadow(0 0 6px #FFD700)" }} />
            <path d="M 190 75 L 130 90 L 70 80 L 0 95" stroke={`url(#fracture-glow-${stat.id})`} strokeWidth="2.2" fill="none" style={{ filter: "drop-shadow(0 0 6px #FFD700)" }} />
            <path d="M 205 50 L 260 35 L 320 48 L 400 30" stroke={`url(#fracture-glow-${stat.id})`} strokeWidth="2.2" fill="none" style={{ filter: "drop-shadow(0 0 6px #FFD700)" }} />
            <path d="M 210 100 L 270 115 L 340 105 L 400 118" stroke={`url(#fracture-glow-${stat.id})`} strokeWidth="2.2" fill="none" style={{ filter: "drop-shadow(0 0 6px #FFD700)" }} />
          </svg>
        </div>

        {/* Phase 2: The Metamorphosed 3D Flapping Butterfly Entity (emerges at 0.15s and flies away) */}
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 70 }}
        >
          {/* Flight Trajectory Rig */}
          <div
            className="relative"
            style={{
              animation: "butterflyFlightTrajectory 4.0s cubic-bezier(0.25, 0.85, 0.35, 1) forwards",
              transformStyle: "preserve-3d",
              perspective: "1000px",
            }}
          >
            {/* The Butterfly Creature Body + Wings Assembly */}
            <div 
              className="relative flex items-center justify-center"
              style={{
                width: "140px",
                height: "110px",
                transformStyle: "preserve-3d",
              }}
            >
              {/* LEFT WING (Forewing + Hindwing) with 3D Flapping */}
              <div
                className="absolute top-0 right-1/2 w-[75px] h-[110px]"
                style={{
                  transformOrigin: "right 55%",
                  transformStyle: "preserve-3d",
                  animation: "butterflyWingFlapLeft 0.18s ease-in-out infinite alternate",
                  filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.35))",
                }}
              >
                <svg
                  viewBox="0 0 100 130"
                  className="w-full h-full"
                  style={{ overflow: "visible" }}
                >
                  <defs>
                    <linearGradient id={`b-wing-l-grad-${stat.id}`} x1="100%" y1="50%" x2="0%" y2="50%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                      <stop offset="25%" stopColor={stat.colorHex || "#a855f7"} stopOpacity="0.92" />
                      <stop offset="65%" stopColor="#38bdf8" stopOpacity="0.85" />
                      <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0.95" />
                    </linearGradient>
                    <radialGradient id={`b-cell-l-grad-${stat.id}`} cx="60%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#fef08a" stopOpacity="0.95" />
                      <stop offset="50%" stopColor={stat.colorHex || "#a855f7"} stopOpacity="0.75" />
                      <stop offset="100%" stopColor="#0f172a" stopOpacity="0.9" />
                    </radialGradient>
                  </defs>

                  {/* Forewing Outer Contour */}
                  <path
                    d="M 98 62 C 92 40, 78 15, 42 2 C 20 -4, 4 12, 6 36 C 8 52, 22 66, 48 72 C 72 78, 92 68, 98 62 Z"
                    fill={`url(#b-wing-l-grad-${stat.id})`}
                    stroke="#ffffff"
                    strokeWidth="1.4"
                  />
                  {/* Forewing Translucent Inner Cell */}
                  <path
                    d="M 95 60 C 88 42, 72 20, 44 10 C 26 16, 18 28, 20 42 C 22 56, 38 64, 60 67 C 80 70, 90 64, 95 60 Z"
                    fill={`url(#b-cell-l-grad-${stat.id})`}
                    opacity="0.88"
                  />
                  {/* Forewing Intricate Structural Veins */}
                  <path d="M 96 62 Q 60 30, 42 4" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.9" fill="none" />
                  <path d="M 75 42 Q 40 25, 12 20" stroke="#ffffff" strokeWidth="1.1" strokeOpacity="0.85" fill="none" />
                  <path d="M 68 50 Q 35 42, 8 38" stroke="#ffffff" strokeWidth="1.1" strokeOpacity="0.85" fill="none" />
                  <path d="M 72 58 Q 45 58, 18 56" stroke="#ffffff" strokeWidth="1.1" strokeOpacity="0.85" fill="none" />

                  {/* Hindwing Outer Contour (Bottom Lobe) */}
                  <path
                    d="M 96 66 C 85 75, 65 88, 50 105 C 38 120, 22 128, 14 116 C 6 104, 12 88, 25 78 C 45 64, 75 62, 96 66 Z"
                    fill={`url(#b-wing-l-grad-${stat.id})`}
                    stroke="#ffffff"
                    strokeWidth="1.4"
                  />
                  {/* Hindwing Translucent Cell */}
                  <path
                    d="M 92 68 C 80 78, 62 90, 48 104 C 38 114, 26 118, 20 110 C 16 100, 20 88, 32 80 C 48 70, 72 66, 92 68 Z"
                    fill={`url(#b-cell-l-grad-${stat.id})`}
                    opacity="0.88"
                  />
                  {/* Hindwing Veins */}
                  <path d="M 94 68 Q 60 85, 26 112" stroke="#ffffff" strokeWidth="1.3" strokeOpacity="0.85" fill="none" />
                  <path d="M 70 78 Q 45 92, 16 95" stroke="#ffffff" strokeWidth="1.0" strokeOpacity="0.85" fill="none" />

                  {/* Pearlescent Bioluminescent Margin Spots */}
                  <circle cx="8" cy="24" r="2.4" fill="#ffffff" filter="drop-shadow(0 0 3px #fff)" />
                  <circle cx="10" cy="38" r="2.4" fill="#ffffff" filter="drop-shadow(0 0 3px #fff)" />
                  <circle cx="16" cy="54" r="2.4" fill="#ffffff" filter="drop-shadow(0 0 3px #fff)" />
                  <circle cx="15" cy="114" r="2.2" fill="#ffffff" filter="drop-shadow(0 0 3px #fff)" />
                  <circle cx="28" cy="122" r="2.2" fill="#ffffff" filter="drop-shadow(0 0 3px #fff)" />
                </svg>
              </div>

              {/* RIGHT WING (Forewing + Hindwing) with Mirrored 3D Flapping */}
              <div
                className="absolute top-0 left-1/2 w-[75px] h-[110px]"
                style={{
                  transformOrigin: "left 55%",
                  transformStyle: "preserve-3d",
                  animation: "butterflyWingFlapRight 0.18s ease-in-out infinite alternate",
                  filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.35))",
                }}
              >
                <svg
                  viewBox="0 0 100 130"
                  className="w-full h-full -scale-x-100"
                  style={{ overflow: "visible" }}
                >
                  <defs>
                    <linearGradient id={`b-wing-r-grad-${stat.id}`} x1="100%" y1="50%" x2="0%" y2="50%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                      <stop offset="25%" stopColor={stat.colorHex || "#a855f7"} stopOpacity="0.92" />
                      <stop offset="65%" stopColor="#38bdf8" stopOpacity="0.85" />
                      <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0.95" />
                    </linearGradient>
                    <radialGradient id={`b-cell-r-grad-${stat.id}`} cx="60%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#fef08a" stopOpacity="0.95" />
                      <stop offset="50%" stopColor={stat.colorHex || "#a855f7"} stopOpacity="0.75" />
                      <stop offset="100%" stopColor="#0f172a" stopOpacity="0.9" />
                    </radialGradient>
                  </defs>

                  {/* Forewing Outer Contour */}
                  <path
                    d="M 98 62 C 92 40, 78 15, 42 2 C 20 -4, 4 12, 6 36 C 8 52, 22 66, 48 72 C 72 78, 92 68, 98 62 Z"
                    fill={`url(#b-wing-r-grad-${stat.id})`}
                    stroke="#ffffff"
                    strokeWidth="1.4"
                  />
                  {/* Forewing Translucent Inner Cell */}
                  <path
                    d="M 95 60 C 88 42, 72 20, 44 10 C 26 16, 18 28, 20 42 C 22 56, 38 64, 60 67 C 80 70, 90 64, 95 60 Z"
                    fill={`url(#b-cell-r-grad-${stat.id})`}
                    opacity="0.88"
                  />
                  {/* Forewing Intricate Structural Veins */}
                  <path d="M 96 62 Q 60 30, 42 4" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.9" fill="none" />
                  <path d="M 75 42 Q 40 25, 12 20" stroke="#ffffff" strokeWidth="1.1" strokeOpacity="0.85" fill="none" />
                  <path d="M 68 50 Q 35 42, 8 38" stroke="#ffffff" strokeWidth="1.1" strokeOpacity="0.85" fill="none" />
                  <path d="M 72 58 Q 45 58, 18 56" stroke="#ffffff" strokeWidth="1.1" strokeOpacity="0.85" fill="none" />

                  {/* Hindwing Outer Contour (Bottom Lobe) */}
                  <path
                    d="M 96 66 C 85 75, 65 88, 50 105 C 38 120, 22 128, 14 116 C 6 104, 12 88, 25 78 C 45 64, 75 62, 96 66 Z"
                    fill={`url(#b-wing-r-grad-${stat.id})`}
                    stroke="#ffffff"
                    strokeWidth="1.4"
                  />
                  {/* Hindwing Translucent Cell */}
                  <path
                    d="M 92 68 C 80 78, 62 90, 48 104 C 38 114, 26 118, 20 110 C 16 100, 20 88, 32 80 C 48 70, 72 66, 92 68 Z"
                    fill={`url(#b-cell-r-grad-${stat.id})`}
                    opacity="0.88"
                  />
                  {/* Hindwing Veins */}
                  <path d="M 94 68 Q 60 85, 26 112" stroke="#ffffff" strokeWidth="1.3" strokeOpacity="0.85" fill="none" />
                  <path d="M 70 78 Q 45 92, 16 95" stroke="#ffffff" strokeWidth="1.0" strokeOpacity="0.85" fill="none" />

                  {/* Pearlescent Bioluminescent Margin Spots */}
                  <circle cx="8" cy="24" r="2.4" fill="#ffffff" filter="drop-shadow(0 0 3px #fff)" />
                  <circle cx="10" cy="38" r="2.4" fill="#ffffff" filter="drop-shadow(0 0 3px #fff)" />
                  <circle cx="16" cy="54" r="2.4" fill="#ffffff" filter="drop-shadow(0 0 3px #fff)" />
                  <circle cx="15" cy="114" r="2.2" fill="#ffffff" filter="drop-shadow(0 0 3px #fff)" />
                  <circle cx="28" cy="122" r="2.2" fill="#ffffff" filter="drop-shadow(0 0 3px #fff)" />
                </svg>
              </div>

              {/* CENTRAL BUTTERFLY BODY & CURVED ANTENNAE */}
              <div 
                className="absolute z-30 flex flex-col items-center pointer-events-none"
                style={{
                  top: "16px",
                  left: "50%",
                  transform: "translateX(-50%)",
                }}
              >
                {/* Curved Antennae with Glowing Golden Tips */}
                <div className="relative w-10 h-7 flex justify-between px-0.5 -mb-1">
                  <div className="relative w-4 h-6">
                    <svg viewBox="0 0 20 30" className="w-full h-full">
                      <path d="M 18 28 Q 14 12, 4 4" stroke="#fde047" strokeWidth="1.8" fill="none" />
                      <circle cx="4" cy="4" r="2.5" fill="#FFD700" style={{ filter: "drop-shadow(0 0 5px #FFD700)" }} />
                    </svg>
                  </div>
                  <div className="relative w-4 h-6">
                    <svg viewBox="0 0 20 30" className="w-full h-full -scale-x-100">
                      <path d="M 18 28 Q 14 12, 4 4" stroke="#fde047" strokeWidth="1.8" fill="none" />
                      <circle cx="4" cy="4" r="2.5" fill="#FFD700" style={{ filter: "drop-shadow(0 0 5px #FFD700)" }} />
                    </svg>
                  </div>
                </div>

                {/* Head */}
                <div 
                  className="w-3.5 h-3.5 rounded-full shadow-md -mb-1 z-10"
                  style={{
                    background: "radial-gradient(circle at 35% 35%, #fef08a, #ca8a04, #1c1917)",
                    boxShadow: "0 0 8px rgba(253, 224, 71, 0.9)",
                  }}
                />

                {/* Thorax */}
                <div 
                  className="w-4 h-7 rounded-full shadow-lg relative -mb-1 z-10"
                  style={{
                    background: `linear-gradient(to bottom, #ca8a04, ${stat.colorHex || "#a855f7"}, #1e1b4b)`,
                    boxShadow: "0 0 10px rgba(255, 215, 0, 0.7)",
                  }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-white/70 mx-auto mt-1" />
                </div>

                {/* Segmented Abdomen */}
                <div 
                  className="w-2.5 h-10 rounded-full shadow-md flex flex-col items-center justify-between py-1"
                  style={{
                    background: "linear-gradient(to bottom, #1e1b4b, #3b82f6, #0f172a)",
                  }}
                >
                  <div className="w-1.5 h-0.5 rounded-full bg-amber-400/80" />
                  <div className="w-1.5 h-0.5 rounded-full bg-amber-400/70" />
                  <div className="w-1 h-0.5 rounded-full bg-amber-400/60" />
                </div>
              </div>
            </div>

            {/* Glowing Stardust Fairy Dust Stream */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none w-32 h-32">
              {[
                { delay: "0.1s", left: "25%", top: "70%", size: "5px", color: "#FFD700" },
                { delay: "0.4s", left: "75%", top: "60%", size: "6px", color: stat.colorHex || "#a855f7" },
                { delay: "0.7s", left: "45%", top: "85%", size: "4px", color: "#38bdf8" },
                { delay: "1.0s", left: "65%", top: "75%", size: "5px", color: "#f43f5e" },
                { delay: "1.3s", left: "30%", top: "95%", size: "6px", color: "#FFD700" },
                { delay: "1.6s", left: "80%", top: "85%", size: "4px", color: "#ffffff" },
                { delay: "1.9s", left: "50%", top: "90%", size: "5px", color: "#38bdf8" },
              ].map((spark, i) => (
                <div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    left: spark.left,
                    top: spark.top,
                    width: spark.size,
                    height: spark.size,
                    backgroundColor: spark.color,
                    boxShadow: `0 0 10px ${spark.color}`,
                    animation: `butterflySparkDrift 1.6s ease-out ${spark.delay} infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      id={`subject-card-${stat.id}`}
      onClick={() => {
        hapticSelection();
        navigate(`/subjects/${stat.id}`);
      }}
      style={isPopping ? {
        animation: "sparkPopEnter 4.0s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        zIndex: 10,
      } : undefined}
      className="bg-white/60 dark:bg-black/30 backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl p-4 hover:border-white/80 dark:hover:border-white/40 transition-all group relative overflow-hidden cursor-pointer shadow-lg"
    >
      <div className="absolute top-0 left-0 w-1.5 h-full rounded-l-2xl" style={{ backgroundColor: stat.colorHex || "#8b5cf6" }} />
      <div className="pl-3 space-y-3">
        {/* Top row: name + badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-foreground dark:text-white leading-tight transition-colors break-words">{stat.name}</h3>
            <p className={`text-xs mt-0.5 font-medium ${statusMsg.color}`}>{statusMsg.text}</p>
          </div>
          <StatBadge stat={stat} />
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-black/20 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(pct, 100)}%`,
              backgroundColor: pct >= stat.target ? (stat.canMiss === 0 ? "#eab308" : "#10b981") : "#ef4444",
            }}
          />
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Att: <span className="text-foreground font-semibold">{Number(stat.attended) || 0}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
              Miss: <span className="text-foreground font-semibold">{typeof stat.missed === "number" && !isNaN(stat.missed) ? stat.missed : Math.max(0, (Number(stat.total) || 0) - (Number(stat.attended) || 0))}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
              Off: <span className="text-foreground font-semibold">{typeof stat.off === "number" && !isNaN(stat.off) ? stat.off : 0}</span>
            </span>
            <span className="text-foreground dark:text-white/70">
              Tot: <span className="text-foreground font-semibold">{Number(stat.total) || 0}</span>
            </span>
          </div>
          {/* Edit/Delete — always visible on mobile (no hover on touch), revealed on hover for desktop */}
          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); hapticMedium(); onEdit(); }}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Edit Subject"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); hapticHeavy(); onDelete(); }}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
              title="Remove Subject"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const sanitizeSubjectStat = (s: any): SubjectStat => {
  const att = Number(s?.attended) || 0;
  const tot = Number(s?.total) || 0;
  const rawMissed = typeof s?.missed === "number" && !isNaN(s.missed) ? s.missed : Math.max(0, tot - att);
  const missed = isNaN(rawMissed) ? Math.max(0, tot - att) : Math.max(0, rawMissed);
  const rawOff = typeof s?.off === "number" && !isNaN(s.off) ? s.off : 0;
  const off = isNaN(rawOff) ? 0 : Math.max(0, rawOff);
  const pct = tot > 0 ? (att / tot) * 100 : (Number(s?.percentage) || 0);
  return {
    ...s,
    id: s?.id || s?.subjectId || "",
    name: s?.name || s?.subjectName || "Subject",
    code: s?.code || s?.subjectCode || "",
    colorHex: s?.colorHex || "#8b5cf6",
    attended: att,
    missed,
    off,
    total: tot,
    percentage: isNaN(pct) ? 0 : Number(pct.toFixed(1)),
    target: Number(s?.target) || 75,
    canMiss: Number(s?.canMiss) || 0,
    needAttend: Number(s?.needAttend) || 0,
  };
};

export const SubjectsPage = () => {
  const cachedSubjectsData = useCacheStore((state) => state.subjects);
  const setCache = useCacheStore((state) => state.setCache);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const storeSubjects = useAttendanceStore.getState().subjects;
  const storeSemId = useAttendanceStore.getState().activeSemesterId || useCacheStore.getState().semester?.activeSemester?.id || null;
  const [subjectStats, setSubjectStats] = useState<SubjectStat[]>(() => {
    const raw = cachedSubjectsData?.stats || (storeSubjects?.length ? (storeSubjects as any) : []);
    return Array.isArray(raw) ? raw.map(sanitizeSubjectStat) : [];
  });
  const [subjects, setSubjects] = useState<Subject[]>(
    () => cachedSubjectsData?.subjects || (storeSubjects?.length ? (storeSubjects as any) : [])
  );
  const [isLoading, setIsLoading] = useState(
    () => !cachedSubjectsData && (!storeSubjects || storeSubjects.length === 0)
  );
  const [isAdding, setIsAdding] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [flutterDeletingSubjectId, setFlutterDeletingSubjectId] = useState<string | null>(null);
  const [poppingSubjectId, setPoppingSubjectId] = useState<string | null>(null);
  const [activeSemesterId, setActiveSemesterId] = useState<string | null>(
    () => cachedSubjectsData?.activeSemesterId || storeSemId
  );
  const [isCreateSemesterOpen, setIsCreateSemesterOpen] = useState(false);
  const location = useLocation();
  const deletedSubjectIdsRef = useRef<Set<string>>(new Set());
  const fetchSeqRef = useRef<number>(0);

  useEffect(() => {
    if (location.hash === "#add-subject") {
      setIsAdding(true);
    }
  }, [location.hash]);

  useEffect(() => {
    const unregister = useBackHandlerStore.getState().register(() => {
      if (isAdding) {
        setIsAdding(false);
        setEditingSubject(null);
        return true;
      }
      if (isCreateSemesterOpen) {
        setIsCreateSemesterOpen(false);
        return true;
      }
      return false;
    });
    return () => unregister();
  }, [isAdding, isCreateSemesterOpen]);

  const fetchData = async () => {
    const mySeq = ++fetchSeqRef.current;
    try {
      if (!cachedSubjectsData && subjects.length === 0 && (!storeSubjects || storeSubjects.length === 0)) {
        setIsLoading(true);
      }
      const knownSemId =
        activeSemesterId ||
        cachedSubjectsData?.activeSemesterId ||
        useAttendanceStore.getState().activeSemesterId ||
        useCacheStore.getState().semester?.activeSemester?.id ||
        null;

      // Fire all 3 requests in parallel when semesterId is known so total elapsed time = max(single call)
      const [subjectsRes, semesterRes, parallelStatsRes] = await Promise.all([
        api.get("/subjects"),
        api.get("/semesters/active"),
        knownSemId ? api.get(`/attendance/stats?semesterId=${knownSemId}`) : Promise.resolve(null),
      ]);

      // If a newer fetch or delete occurred while this was in flight, discard response immediately
      if (mySeq !== fetchSeqRef.current) return;

      const rawSubjects = Array.isArray(subjectsRes.data) ? subjectsRes.data : [];
      // Strictly filter out any subjects that were deleted
      const validServer = rawSubjects.filter((s: any) => !deletedSubjectIdsRef.current.has(s.id));
      const serverIds = new Set(validServer.map((s: any) => s.id));

      setSubjects((prev) => {
        const recentLocals = prev.filter(
          (p: any) =>
            !serverIds.has(p.id) &&
            !deletedSubjectIdsRef.current.has(p.id) &&
            Date.now() - ((p as any)._localCreatedAt || 0) < 15000
        );
        return [...recentLocals, ...validServer].sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
      });

      const semester = semesterRes.data;
      if (semester) {
        setActiveSemesterId(semester.id);
        const statsRes =
          parallelStatsRes && knownSemId === semester.id
            ? parallelStatsRes
            : await api.get(`/attendance/stats?semesterId=${semester.id}`);

        if (mySeq !== fetchSeqRef.current) return;

        const rawStats = Array.isArray(statsRes.data) ? statsRes.data : (statsRes.data?.subjects || []);
        const validStats = rawStats
          .filter((s: any) => !deletedSubjectIdsRef.current.has(s.id))
          .map(sanitizeSubjectStat);
        setSubjectStats(validStats);
        setCache('subjects', { subjects: validServer, stats: validStats, activeSemesterId: semester.id });
      } else {
        setActiveSemesterId(null);
        setSubjectStats([]);
        setCache('subjects', { subjects: validServer, stats: [], activeSemesterId: null });
      }
    } catch (error) {
      if (mySeq !== fetchSeqRef.current) return;
      console.error("Failed to fetch subjects:", error);
      const cache = useCacheStore.getState().subjects;
      if (cache && cache.activeSemesterId) {
        const validCacheSubs = (cache.subjects || []).filter((s: any) => !deletedSubjectIdsRef.current.has(s.id));
        const validCacheStats = (cache.stats || [])
          .filter((s: any) => !deletedSubjectIdsRef.current.has(s.id))
          .map(sanitizeSubjectStat);
        setSubjects(validCacheSubs);
        setSubjectStats(validCacheStats);
        setActiveSemesterId(cache.activeSemesterId);
      } else {
        const attendanceState = useAttendanceStore.getState();
        if (attendanceState.hasActiveSemester && attendanceState.activeSemesterId) {
          setActiveSemesterId(attendanceState.activeSemesterId);
          const validStoreSubs = (attendanceState.subjects || []).filter((s: any) => !deletedSubjectIdsRef.current.has(s.id));
          setSubjects(validStoreSubs as any);
          setSubjectStats(validStoreSubs as any);
        }
      }
    } finally {
      if (mySeq === fetchSeqRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData();

    const handleUpdate = () => {
      fetchData();
    };
    window.addEventListener("attendance-updated", handleUpdate);
    return () => window.removeEventListener("attendance-updated", handleUpdate);
  }, []);

  const handleEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    const subjectToDelete = subjects.find(s => s.id === id);
    confirmDeleteToast({
      title: "Delete Subject",
      description: "Are you sure you want to remove this subject? Past attendance will be safely preserved.",
      itemName: subjectToDelete?.name,
      confirmLabel: "Delete Subject",
      onConfirm: async () => {
        hapticHeavy();
        // 1. Immediately register in the deleted IDs set so in-flight requests never resurrect it
        deletedSubjectIdsRef.current.add(id);
        setFlutterDeletingSubjectId(id);
        SoundFX.playButterflyFlutterSound();
          triggerDynamicHUD({ type: "butterfly", label: "Subject Deleted", durationMs: 4500 });

          // 2. Synchronously evict from local cache and global attendanceStore so no fallback revives it
          const curCache = useCacheStore.getState().subjects;
          if (curCache) {
            useCacheStore.getState().setCache("subjects", {
              ...curCache,
              subjects: (curCache.subjects || []).filter((s: any) => s.id !== id && !deletedSubjectIdsRef.current.has(s.id)),
              stats: (curCache.stats || []).filter((s: any) => s.id !== id && !deletedSubjectIdsRef.current.has(s.id)),
            });
          }
          useAttendanceStore.setState((state) => ({
            subjects: state.subjects.filter((s: any) => s.id !== id && !deletedSubjectIdsRef.current.has(s.id)),
          }));

          // Run 4.0s butterfly flutter choreography
          setTimeout(async () => {
            // Unmount from React DOM synchronously with ending the animation
            setSubjects((prev) => prev.filter((s) => s.id !== id && !deletedSubjectIdsRef.current.has(s.id)));
            setSubjectStats((prev) => prev.filter((s) => s.id !== id && !deletedSubjectIdsRef.current.has(s.id)));
            setFlutterDeletingSubjectId(null);
            fetchSeqRef.current += 1; // Invalidate any older in-flight fetches
            try {
              await api.delete(`/subjects/${id}?preserveHistory=true`);
              await Promise.all([
                fetchData(),
                useAttendanceStore.getState().fetchStats(true),
              ]).catch(() => {});
              window.dispatchEvent(new Event("attendance-updated"));
            } catch (error) {
              console.error("Failed to delete subject:", error);
              toast.error("Failed to delete subject");
              // Even on network error, ensure user's deletion intent is strictly honored locally
              setSubjects((prev) => prev.filter((s) => s.id !== id && !deletedSubjectIdsRef.current.has(s.id)));
              setSubjectStats((prev) => prev.filter((s) => s.id !== id && !deletedSubjectIdsRef.current.has(s.id)));
            }
          }, 4000);
        }
      });
  };

  // Compute overall stats across all subjects
  const safeStats = Array.isArray(subjectStats) ? subjectStats.map(sanitizeSubjectStat) : [];
  const safeSubjects = Array.isArray(subjects) ? subjects : [];
  const overallAttended = safeStats.reduce((sum, s) => sum + (Number(s.attended) || 0), 0);
  const overallTotal = safeStats.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
  const rawOverallMissed = safeStats.reduce(
    (sum, s) =>
      sum +
      (typeof s.missed === "number" && !isNaN(s.missed)
        ? s.missed
        : Math.max(0, (Number(s.total) || 0) - (Number(s.attended) || 0))),
    0
  );
  const overallMissed = isNaN(rawOverallMissed) ? Math.max(0, overallTotal - overallAttended) : Math.max(0, rawOverallMissed);
  const rawOverallOff = safeStats.reduce(
    (sum, s) => sum + (typeof s.off === "number" && !isNaN(s.off) ? s.off : 0),
    0
  );
  const overallOff = isNaN(rawOverallOff) ? 0 : Math.max(0, rawOverallOff);
  const overallPct = overallTotal > 0 ? (overallAttended / overallTotal) * 100 : 0;
  // Always use user.targetAttendance as the single source of truth — never average subject targets
  const overallTarget = user?.targetAttendance ?? 75;
  const overallStat: SubjectStat = {
    id: "overall",
    name: "Overall",
    colorHex: overallPct >= overallTarget ? "#10b981" : "#ef4444",
    target: overallTarget,
    attended: overallAttended,
    missed: overallMissed,
    off: overallOff,
    total: overallTotal,
    percentage: isNaN(overallPct) ? 0 : Number(overallPct.toFixed(1)),
    canMiss: overallPct >= overallTarget ? Math.floor((overallAttended - (overallTarget / 100) * overallTotal) / (overallTarget / 100)) : 0,
    needAttend: overallPct < overallTarget && overallTarget < 100 ? Math.ceil(((overallTarget / 100) * overallTotal - overallAttended) / (1 - overallTarget / 100)) : 0,
  };

  if (isLoading) {
    return <PageSkeleton type="grid" />;
  }

  // Merge subjectStats with subject info (for subjects with no recorded attendance yet)
  const sortedSafeSubjects = [...safeSubjects].sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
  const mergedStats: SubjectStat[] = sortedSafeSubjects.map(sub => {
    const stat = safeStats.find(s => s.id === sub.id);
    const attended = Number(stat?.attended ?? (sub as any).attended ?? 0) || 0;
    const total = Number(stat?.total ?? (sub as any).total ?? 0) || 0;
    const rawMissed =
      typeof stat?.missed === "number" && !isNaN(stat.missed)
        ? stat.missed
        : typeof (sub as any).missed === "number" && !isNaN((sub as any).missed)
        ? (sub as any).missed
        : Math.max(0, total - attended);
    const missed = isNaN(rawMissed) ? Math.max(0, total - attended) : Math.max(0, rawMissed);
    const rawOff =
      typeof stat?.off === "number" && !isNaN(stat.off)
        ? stat.off
        : typeof (sub as any).off === "number" && !isNaN((sub as any).off)
        ? (sub as any).off
        : 0;
    const off = isNaN(rawOff) ? 0 : Math.max(0, rawOff);
    const pct = total > 0 ? (attended / total) * 100 : (Number(stat?.percentage ?? (sub as any).percentage) || 0);

    return {
      ...(stat || {}),
      id: sub.id,
      name: sub.name,
      code: sub.code,
      colorHex: sub.colorHex || stat?.colorHex || "#8b5cf6",
      target: user?.targetAttendance ?? 75,
      attended,
      missed,
      off,
      total,
      percentage: isNaN(pct) ? 0 : Number(pct.toFixed(1)),
      canMiss: stat?.canMiss ?? 0,
      needAttend: stat?.needAttend ?? 0,
    };
  });

  return (
    <div className="relative min-h-full w-full flex flex-col">
      <style>{`
        @keyframes sparkPopEnter {
          0% { transform: scale(0.88) translateY(16px); box-shadow: 0 0 0 rgba(245, 158, 11, 0); }
          25% { transform: scale(1.02) translateY(-4px); box-shadow: 0 0 35px rgba(245, 158, 11, 0.45); }
          60% { transform: scale(1) translateY(0); box-shadow: 0 0 20px rgba(245, 158, 11, 0.25); }
          100% { transform: scale(1) translateY(0); box-shadow: none; }
        }
        @keyframes shardBreakTL {
          0% {
            transform: translate3d(0, 0, 0) rotate(0deg);
            opacity: 1;
            filter: brightness(1);
          }
          20% {
            transform: translate3d(-10px, -6px, 10px) rotate(-4deg);
            filter: brightness(1.6) drop-shadow(0 0 12px #FFD700);
            opacity: 1;
          }
          100% {
            transform: translate3d(-45px, 60px, -20px) rotate(-18deg) scale(0.85);
            opacity: 0;
            filter: blur(6px);
          }
        }
        @keyframes shardBreakTR {
          0% {
            transform: translate3d(0, 0, 0) rotate(0deg);
            opacity: 1;
            filter: brightness(1);
          }
          20% {
            transform: translate3d(12px, -8px, 10px) rotate(5deg);
            filter: brightness(1.6) drop-shadow(0 0 12px #FFD700);
            opacity: 1;
          }
          100% {
            transform: translate3d(50px, 65px, -20px) rotate(22deg) scale(0.85);
            opacity: 0;
            filter: blur(6px);
          }
        }
        @keyframes shardBreakBL {
          0% {
            transform: translate3d(0, 0, 0) rotate(0deg);
            opacity: 1;
            filter: brightness(1);
          }
          20% {
            transform: translate3d(-8px, 10px, 10px) rotate(-6deg);
            filter: brightness(1.6) drop-shadow(0 0 12px #FFD700);
            opacity: 1;
          }
          100% {
            transform: translate3d(-35px, 85px, -20px) rotate(-24deg) scale(0.8);
            opacity: 0;
            filter: blur(6px);
          }
        }
        @keyframes shardBreakBR {
          0% {
            transform: translate3d(0, 0, 0) rotate(0deg);
            opacity: 1;
            filter: brightness(1);
          }
          20% {
            transform: translate3d(10px, 12px, 10px) rotate(6deg);
            filter: brightness(1.6) drop-shadow(0 0 12px #FFD700);
            opacity: 1;
          }
          100% {
            transform: translate3d(40px, 90px, -20px) rotate(26deg) scale(0.8);
            opacity: 0;
            filter: blur(6px);
          }
        }
        @keyframes fractureFlash {
          0% { opacity: 0; transform: scale(0.98); }
          25% { opacity: 1; transform: scale(1.02); filter: drop-shadow(0 0 16px #FFD700); }
          60% { opacity: 0.8; }
          100% { opacity: 0; transform: scale(1.05); }
        }
        @keyframes cardSlotCollapse {
          0%, 25% {
            min-height: 135px;
            margin-bottom: 12px;
            opacity: 1;
          }
          55% {
            min-height: 50px;
            margin-bottom: 6px;
          }
          80%, 100% {
            min-height: 0px;
            height: 0px;
            margin-bottom: 0px;
            padding-top: 0px;
            padding-bottom: 0px;
            opacity: 1;
          }
        }
        @keyframes butterflyFlightTrajectory {
          0% {
            transform: translate3d(0, 0, 0) scale(0.2) rotateZ(0deg);
            opacity: 0;
          }
          8% {
            transform: translate3d(0, -12px, 20px) scale(1) rotateZ(-4deg);
            opacity: 1;
          }
          20% {
            transform: translate3d(-35px, -70px, 45px) scale(1.05) rotateZ(-14deg);
            opacity: 1;
          }
          40% {
            transform: translate3d(50px, -170px, 75px) scale(1) rotateZ(18deg);
            opacity: 0.98;
          }
          62% {
            transform: translate3d(-28px, -290px, 110px) scale(0.92) rotateZ(-12deg);
            opacity: 0.95;
          }
          80% {
            transform: translate3d(75px, -410px, 140px) scale(0.78) rotateZ(18deg);
            opacity: 0.85;
          }
          92% {
            transform: translate3d(130px, -530px, 165px) scale(0.48) rotateZ(22deg);
            opacity: 0.55;
          }
          100% {
            transform: translate3d(180px, -650px, 190px) scale(0.1) rotateZ(25deg);
            opacity: 0;
            visibility: hidden;
          }
        }
        @keyframes butterflyWingFlapLeft {
          0% {
            transform: rotateY(70deg) rotateZ(-5deg);
          }
          100% {
            transform: rotateY(-32deg) rotateZ(5deg);
          }
        }
        @keyframes butterflyWingFlapRight {
          0% {
            transform: rotateY(-70deg) rotateZ(5deg);
          }
          100% {
            transform: rotateY(32deg) rotateZ(-5deg);
          }
        }
        @keyframes butterflySparkDrift {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 0.9;
          }
          50% {
            transform: translate(-12px, 28px) scale(0.8);
            opacity: 0.75;
          }
          100% {
            transform: translate(16px, 58px) scale(0.1);
            opacity: 0;
          }
        }
      `}</style>
      <div className="relative z-10 w-full flex-1 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-foreground dark:text-white leading-[0.9] drop-shadow-2xl" style={{fontFamily: "Impact, sans-serif"}}>SUBJ<span className="text-[#FFD700]">E</span>CTS</h1>
            <p className="text-sm md:text-base text-foreground dark:text-white/80 font-medium">Your semester attendance overview.</p>
          </div>
          <button
            onClick={() => {
              if (!activeSemesterId) {
                toast.error("Please create an active semester first before adding subjects.");
                setIsCreateSemesterOpen(true);
                return;
              }
              setEditingSubject(null);
              setIsAdding(true);
            }}
            className="flex items-center gap-2 bg-foreground hover:bg-foreground/90 text-background px-4 py-2 rounded-full text-sm font-bold transition-all shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Subject</span>
          </button>
        </div>

        {/* Quick Actions (Moved from MobileNav) */}
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div 
            onClick={() => navigate("/semester")}
            className="bg-white/60 dark:bg-black/30 backdrop-blur-md border border-white/60 dark:border-white/10 hover:border-white/80 dark:hover:border-white/40 rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all active:scale-[0.98]"
          >
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">Semester</p>
              <p className="text-[10px] text-muted-foreground">Overview</p>
            </div>
          </div>
          <div 
            onClick={() => navigate("/predictive")}
            className="bg-white/60 dark:bg-black/30 backdrop-blur-md border border-white/60 dark:border-white/10 hover:border-white/80 dark:hover:border-white/40 rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all active:scale-[0.98]"
          >
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">Forecast</p>
              <p className="text-[10px] text-muted-foreground">Predictive</p>
            </div>
          </div>
        </div>

        {!activeSemesterId && (
        <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-foreground dark:text-white">No Active Semester</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Create an active semester to enable attendance percentage calculations and safe buffer metrics.
            </p>
          </div>
          <button
            onClick={() => setIsCreateSemesterOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-full text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Semester</span>
          </button>
        </div>
      )}

      {mergedStats.length === 0 && !isLoading && !isAdding ? (
        <div className="text-center py-12 bg-white/60 dark:bg-black/30 backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl">
          <AlertCircle className="w-12 h-12 text-foreground dark:text-muted-foreground dark:text-white/40 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground dark:text-white mb-2">No subjects yet</h3>
          <p className="text-foreground dark:text-white/60 max-w-sm mx-auto mb-6">
            You haven't added any subjects to track. Start by adding the subjects you are studying this semester.
          </p>
          {!activeSemesterId ? (
            <button
              onClick={() => setIsCreateSemesterOpen(true)}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create Active Semester First
            </button>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="inline-flex items-center gap-2 bg-primary/20 text-primary hover:bg-primary/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add First Subject
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Overall Hero Card */}
          {mergedStats.length > 0 && (() => {
            const pct = Math.min(overallPct, 100);
            const radius = 54;
            const circumference = 2 * Math.PI * radius;
            const strokeDash = (pct / 100) * circumference;
            const isGood = overallPct >= overallTarget;
            const ringColor = isGood ? "#10b981" : "#ef4444";
            const bgGlow = isGood ? "from-emerald-500/10" : "from-rose-500/10";

            return (
              <div 
                onClick={() => navigate("/subjects/overall")}
                className={`relative rounded-3xl border border-border overflow-hidden bg-white/60 dark:bg-black/30 backdrop-blur-2xl p-6 shadow-2xl border-white/60 dark:border-white/10 hover:border-white/80 dark:hover:border-white/40 cursor-pointer transition-all group`}
              >
                {/* Subtle background glow */}
                <div
                  className="absolute -top-16 -right-16 w-64 h-64 rounded-full blur-3xl opacity-15 pointer-events-none"
                  style={{ backgroundColor: ringColor }}
                />

                <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
                  {/* Circular Ring */}
                  <div className="relative flex-shrink-0">
                    <svg width="140" height="140" className="-rotate-90">
                      {/* Track */}
                      <circle
                        cx="70" cy="70" r={radius}
                        fill="none"
                        stroke="currentColor"
                        className="text-muted/40"
                        strokeWidth="10"
                      />
                      {/* Progress */}
                      <circle
                        cx="70" cy="70" r={radius}
                        fill="none"
                        stroke={ringColor}
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={`${strokeDash} ${circumference}`}
                        style={{ transition: "stroke-dasharray 0.8s ease" }}
                      />
                      {/* Target marker */}
                      <circle
                        cx="70" cy="70" r={radius}
                        fill="none"
                        stroke="currentColor"
                        className="text-muted-foreground/30"
                        strokeWidth="2"
                        strokeDasharray={`2 ${circumference - 2}`}
                        strokeDashoffset={-((overallTarget / 100) * circumference)}
                      />
                    </svg>
                    {/* Centre text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-black text-foreground leading-none">
                        {(overallPct ?? 0).toFixed(1)}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium mt-0.5">%</span>
                    </div>
                  </div>

                  {/* Right content */}
                  <div className="flex-1 space-y-4 text-center md:text-left">
                    <div>
                      <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                        <Shield className="w-4 h-4" style={{ color: ringColor }} />
                        <h2 className="text-lg font-bold text-foreground dark:text-white drop-shadow-md">Overall Attendance</h2>
                      </div>
                      <p className={`text-sm font-semibold`} style={{ color: ringColor }}>
                        {getStatusMessage(overallStat).text}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Target: <span className="text-foreground font-semibold">{overallTarget}%</span>
                        {isGood
                          ? <span className="text-emerald-600 dark:text-emerald-300 font-semibold ml-2">+{((overallPct ?? 0) - (overallTarget ?? 75)).toFixed(1)}% buffer</span>
                          : <span className="text-rose-600 dark:text-rose-400 font-semibold ml-2">{((overallTarget ?? 75) - (overallPct ?? 0)).toFixed(1)}% short</span>
                        }
                      </p>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: "Attended", value: overallAttended, color: "text-emerald-600 dark:text-emerald-300", bg: "bg-emerald-500/10" },
                        { label: "Missed", value: overallMissed, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10" },
                        { label: "Off", value: overallOff, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
                        { label: "Total", value: overallTotal, color: "text-foreground", bg: "bg-muted" },
                      ].map(({ label, value, color, bg }) => (
                        <div key={label} className={`${bg} rounded-xl p-2.5 text-center`}>
                          <p className={`text-lg font-bold ${color}`}>{value}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide font-medium">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Linear progress bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                        <span>0%</span>
                        <span>Target {overallTarget}%</span>
                        <span>100%</span>
                      </div>
                      <div className="h-2 bg-black/20 rounded-full overflow-hidden relative">
                        {/* Target line */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-muted-foreground/40 z-10"
                          style={{ left: `${overallTarget}%` }}
                        />
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(overallPct, 100)}%`, backgroundColor: ringColor }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

      {/* Per-subject cards */}
          {mergedStats.map((stat, idx) => {
            const sub = subjects.find(s => s.id === stat.id);
            return (
              <SubjectCard
                key={stat.id || `fallback-${idx}`}
                stat={stat}
                onEdit={() => sub && handleEdit(sub)}
                onDelete={() => handleDelete(stat.id)}
                isFluttering={flutterDeletingSubjectId === stat.id}
                isPopping={poppingSubjectId === stat.id}
              />
            );
          })}
        </div>
      )}

      <CreateSemesterModal
        isOpen={isCreateSemesterOpen}
        onClose={() => setIsCreateSemesterOpen(false)}
        onSuccess={(newSem) => {
          if (newSem?.id) setActiveSemesterId(newSem.id);
          fetchData();
        }}
      />
      <SubjectModal
        isOpen={isAdding}
        onClose={() => { setIsAdding(false); setEditingSubject(null); }}
        onSuccess={(savedSubject?: Subject) => {
          if (savedSubject && savedSubject.id) {
            deletedSubjectIdsRef.current.delete(savedSubject.id);
            const subjectWithLocal = { ...savedSubject, _localCreatedAt: Date.now() } as any;
            setSubjects((prev) => {
              const exists = prev.some((s) => s.id === savedSubject.id);
              const list = exists
                ? prev.map((s) => (s.id === savedSubject.id ? subjectWithLocal : s))
                : [...prev, subjectWithLocal];
              return [...list].sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
            });
            setPoppingSubjectId(savedSubject.id);
            setTimeout(() => {
              setPoppingSubjectId((curr) => (curr === savedSubject.id ? null : curr));
            }, 4000);

            // Automatically scroll smoothly to the newly created / updated subject card so the user sees it animate in!
            const scrollToSubject = (attempts = 0) => {
              requestAnimationFrame(() => {
                const el = document.getElementById(`subject-card-${savedSubject.id}`);
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                } else if (attempts < 8) {
                  setTimeout(() => scrollToSubject(attempts + 1), 60);
                }
              });
            };
            scrollToSubject();
          }
          setTimeout(() => {
            fetchData();
          }, 600);
        }}
        semesterId={activeSemesterId || undefined}
        subject={editingSubject}
      />
      </div>
    </div>
  );
};
