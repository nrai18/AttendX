import React, { useState, useEffect } from "react";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  HelpCircle,
  ShieldCheck,
  Zap,
  BookOpen,
  Sliders,
  ChevronRight,
  Info
} from "lucide-react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import { useAttendanceStore } from "../../stores/attendanceStore";

interface SubjectStat {
  id: string;
  name: string;
  code?: string;
  colorHex?: string;
  target?: number;
  attended: number;
  total: number;
  percentage: number;
}

interface PredictiveAttendanceViewProps {
  onClose?: () => void;
  compact?: boolean;
}

export const PredictiveAttendanceView: React.FC<PredictiveAttendanceViewProps> = ({
  compact = false,
}) => {
  const user = useAuthStore((state) => state.user);
  const subjects = useAttendanceStore((state) => state.subjects) as unknown as SubjectStat[];
  const isLoading = useAttendanceStore((state) => state.isLoading);
  const [globalTarget, setGlobalTarget] = useState<number>(user?.targetAttendance ?? 75);

  useEffect(() => {
    if (user?.targetAttendance !== undefined && user?.targetAttendance !== null) {
      setGlobalTarget(user.targetAttendance);
    }
  }, [user?.targetAttendance]);


  // Custom simulation increments per subject: { [subjectId]: { addAttend: number, addMiss: number } }
  const [simulations, setSimulations] = useState<Record<string, { addAttend: number; addMiss: number }>>({});

  const handleTargetChange = async (newTarget: number) => {
    setGlobalTarget(newTarget);
    if (!user) return;
    try {
      await api.patch("/users/me", { targetAttendance: newTarget });
      useAuthStore.getState().setUser({ ...user, targetAttendance: newTarget });
      await useAttendanceStore.getState().fetchStats();
      window.dispatchEvent(new CustomEvent("attendance-updated"));
    } catch (err) {
      console.error("Failed to update target globally:", err);
    }
  };

  // Compute Overall Stats
  const totalAttended = subjects.reduce((sum, s) => sum + s.attended, 0);
  const totalRecorded = subjects.reduce((sum, s) => sum + s.total, 0);
  const overallPercentage = totalRecorded > 0 ? (totalAttended / totalRecorded) * 100 : 0;

  // Formula for consecutive classes needed to reach globalTarget:
  // (Attended + X) / (Total + X) >= Target / 100
  // => X >= (Target * Total - 100 * Attended) / (100 - Target)
  const calculateConsecutiveNeeded = (attended: number, total: number, target: number) => {
    if (total === 0) return 0;
    const currentPct = (attended / total) * 100;
    if (currentPct >= target) return 0;
    if (target >= 100) return Infinity;

    const numerator = (target / 100) * total - attended;
    const denominator = 1 - target / 100;
    return Math.max(0, Math.ceil(numerator / denominator));
  };

  // Formula for safe missed classes available:
  // Attended / (Total + Y) >= Target / 100
  // => Y <= (100 * Attended - Target * Total) / Target
  const calculateSafeMisses = (attended: number, total: number, target: number) => {
    if (total === 0) return 0;
    const currentPct = (attended / total) * 100;
    if (currentPct < target) return 0;

    const numerator = 100 * attended - target * total;
    const denominator = target;
    return Math.max(0, Math.floor(numerator / denominator));
  };

  const overallNeeded = calculateConsecutiveNeeded(totalAttended, totalRecorded, globalTarget);
  const overallSafeMisses = calculateSafeMisses(totalAttended, totalRecorded, globalTarget);
  const isOverallOnTrack = overallPercentage >= globalTarget;

  const updateSim = (subjectId: string, field: "addAttend" | "addMiss", delta: number) => {
    setSimulations((prev) => {
      const current = prev[subjectId] || { addAttend: 0, addMiss: 0 };
      const newVal = Math.max(0, current[field] + delta);
      return {
        ...prev,
        [subjectId]: {
          ...current,
          [field]: newVal,
        },
      };
    });
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center bg-card border border-border rounded-3xl">
        <Sparkles className="w-8 h-8 text-primary animate-pulse mx-auto mb-2" />
        <p className="text-xs text-muted-foreground font-medium">Analyzing attendance logs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Target Selector */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900/30 via-card to-background border border-indigo-500/20 p-6 shadow-lg">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/20 border border-primary/30 rounded-2xl text-primary">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  Attendance Forecast Engine
                </h2>
                <p className="text-xs text-muted-foreground">
                  Smart forecast based on your past attendance logs
                </p>
              </div>
            </div>

            {/* Target Percentage Selector */}
            <div className="flex items-center gap-3 bg-muted/60 border border-border px-3.5 py-2 rounded-2xl shrink-0">
              <Sliders className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground">Target Goal:</span>
              <div className="flex items-center gap-1">
                {[75, 80, 85, 90].map((t) => (
                  <button
                    key={t}
                    onClick={() => handleTargetChange(t)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                      globalTarget === t
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {t}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Forecast Hero Box */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* Box 1: Overall Status */}
            <div className="p-4 bg-card/80 border border-border/80 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Current Overall
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-foreground">
                  {overallPercentage.toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground">
                  ({totalAttended}/{totalRecorded} classes)
                </span>
              </div>
              <p
                className={`text-xs font-bold ${
                  isOverallOnTrack ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {isOverallOnTrack
                  ? `+${(overallPercentage - globalTarget).toFixed(1)}% above ${globalTarget}% target`
                  : `${(globalTarget - overallPercentage).toFixed(1)}% below ${globalTarget}% target`}
              </p>
            </div>

            {/* Box 2: Recommendation Action Callout */}
            <div className="md:col-span-2 p-4 bg-primary/10 border border-primary/20 rounded-2xl flex flex-col justify-center space-y-2">
              <div className="flex items-center gap-2">
                {isOverallOnTrack ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <Zap className="w-5 h-5 text-amber-500 shrink-0" />
                )}
                <h3 className="text-sm font-bold text-foreground">
                  {isOverallOnTrack ? "Goal Achieved Buffer" : "Action Required"}
                </h3>
              </div>

              {isOverallOnTrack ? (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Great job! You are currently above your <span className="font-bold text-foreground">{globalTarget}%</span> target. You can safely miss up to{" "}
                  <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    {overallSafeMisses} consecutive class{overallSafeMisses !== 1 ? "es" : ""}
                  </span>{" "}
                  without dropping below {globalTarget}%.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  To reach your target of <span className="font-bold text-foreground">{globalTarget}%</span>, you need to attend{" "}
                  <span className="font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20 text-sm">
                    {overallNeeded} consecutive class{overallNeeded !== 1 ? "es" : ""}
                  </span>{" "}
                  without missing any.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Per-Subject Forecast Breakdown & What-If Simulator */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <span>Subject-by-Subject Forecast</span>
          </h3>
          <span className="text-xs text-muted-foreground">
            Targeting {globalTarget}% per subject
          </span>
        </div>

        {subjects.length === 0 ? (
          <div className="text-center py-8 bg-card border border-border rounded-2xl">
            <Info className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-60" />
            <p className="text-xs text-muted-foreground">No subject logs recorded yet to make predictions.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {subjects.map((sub: any) => {
              const subTarget = sub.target ?? globalTarget;
              const needed = calculateConsecutiveNeeded(sub.attended, sub.total, subTarget);
              const safeMisses = calculateSafeMisses(sub.attended, sub.total, subTarget);
              const isOnTrack = sub.percentage >= subTarget;

              // What-If Simulation
              const sim = simulations[sub.id] || { addAttend: 0, addMiss: 0 };
              const simAttended = sub.attended + sim.addAttend;
              const simTotal = sub.total + sim.addAttend + sim.addMiss;
              const simPct = simTotal > 0 ? (simAttended / simTotal) * 100 : 0;

              return (
                <div
                  key={sub.id}
                  className="bg-card border border-border hover:border-border/80 rounded-2xl p-4 shadow-sm space-y-3 relative overflow-hidden transition-all"
                >
                  {/* Left Color Accent Bar */}
                  <div
                    className="absolute top-0 left-0 w-1.5 h-full rounded-l-2xl"
                    style={{ backgroundColor: sub.colorHex || "#8b5cf6" }}
                  />

                  <div className="pl-2 space-y-3">
                    {/* Header: Title + Recommendation Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-foreground">{sub.name}</h4>
                          {sub.code && (
                            <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                              {sub.code}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Attended <span className="font-semibold text-foreground">{sub.attended}</span> of{" "}
                          <span className="font-semibold text-foreground">{sub.total}</span> classes logged
                        </p>
                      </div>

                      {/* Prediction Badge */}
                      <div className="shrink-0">
                        {isOnTrack ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Can miss {safeMisses} class{safeMisses !== 1 ? "es" : ""}</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse">
                            <Zap className="w-3.5 h-3.5" />
                            <span>Attend next {needed} consecutive class{needed !== 1 ? "es" : ""}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar & Percentage Comparison */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-semibold">
                        <span className={isOnTrack ? "text-emerald-500" : "text-amber-500"}>
                          Current: {sub.percentage.toFixed(1)}%
                        </span>
                        <span className="text-emerald-700">Safe to miss {safeMisses} classes and stay ≥{subTarget}%</span>
                      </div>

                      <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                        {/* Target Line */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-foreground/60 z-10"
                          style={{ left: `${subTarget}%` }}
                        />
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isOnTrack ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                          style={{ width: `${Math.min(sub.percentage, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Quick Simulator Controls: "Simulate Future Attendance" */}
                    <div className="pt-2 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 p-2.5 rounded-xl">
                      <span className="text-xs font-bold text-muted-foreground">
                        Simulate Future Classes:
                      </span>

                      <div className="flex items-center gap-4">
                        {/* + Attend button */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-emerald-500 font-semibold">Attend +</span>
                          <button
                            onClick={() => updateSim(sub.id, "addAttend", -1)}
                            className="w-6 h-6 rounded-lg bg-card border border-border text-xs font-bold text-muted-foreground hover:text-foreground flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold text-foreground w-4 text-center">
                            {sim.addAttend}
                          </span>
                          <button
                            onClick={() => updateSim(sub.id, "addAttend", 1)}
                            className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-xs font-bold text-emerald-400 flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>

                        {/* + Miss button */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-rose-500 font-semibold">Miss +</span>
                          <button
                            onClick={() => updateSim(sub.id, "addMiss", -1)}
                            className="w-6 h-6 rounded-lg bg-card border border-border text-xs font-bold text-muted-foreground hover:text-foreground flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold text-foreground w-4 text-center">
                            {sim.addMiss}
                          </span>
                          <button
                            onClick={() => updateSim(sub.id, "addMiss", 1)}
                            className="w-6 h-6 rounded-lg bg-rose-500/20 border border-rose-500/30 text-xs font-bold text-rose-400 flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>

                        {/* Projected Result */}
                        {(sim.addAttend > 0 || sim.addMiss > 0) && (
                          <div className="pl-2 border-l border-border flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">Simulated:</span>
                            <span
                              className={`text-xs font-extrabold ${
                                simPct >= subTarget ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {simPct.toFixed(1)}% {simPct >= subTarget ? '✅' : '⚠️'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
