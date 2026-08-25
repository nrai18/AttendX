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
  Info,
  Loader2,
  RefreshCw,
  Brain
} from "lucide-react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { Stepper } from "../ui/stepper";
import { Input } from "../ui/input";
import { FutureClassesModal } from "./FutureClassesModal";

interface SubjectStat {
  id: string;
  name: string;
  code?: string;
  colorHex?: string;
  target?: number;
  attended: number;
  total: number;
  percentage: number;
  remainingClasses?: number;
  maxRemainingClasses?: number;
  futureBreakdown?: { date: string; type: 'HELD' | 'OFF'; reason?: string; count: number }[];
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
  const hasActiveSemester = useAttendanceStore((state) => state.hasActiveSemester);
  const simulationBounds = useAttendanceStore((state) => state.simulationBounds);
  const updateSimulationBoundaries = useAttendanceStore((state) => state.updateSimulationBoundaries);
  const [globalTarget, setGlobalTarget] = useState<number>(user?.targetAttendance ?? 75);

  const [aiInsights, setAiInsights] = useState<any>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [localStart, setLocalStart] = useState("");
  const [localEnd, setLocalEnd] = useState("");
  const [hasUnsavedBounds, setHasUnsavedBounds] = useState(false);

  useEffect(() => {
    if (simulationBounds) {
      setLocalStart(simulationBounds.hasCommencement ? simulationBounds.startDate.split("T")[0] : "");
      setLocalEnd(simulationBounds.hasLastDay ? simulationBounds.endDate.split("T")[0] : "");
      setHasUnsavedBounds(false);
    }
  }, [simulationBounds]);

  const handleSaveBounds = async () => {
    if (!localStart || !localEnd) return;
    await updateSimulationBoundaries(
      new Date(localStart).toISOString(),
      new Date(localEnd).toISOString()
    );
  };

  useEffect(() => {
    if (user?.targetAttendance !== undefined && user?.targetAttendance !== null) {
      setGlobalTarget(user.targetAttendance);
    }
  }, [user?.targetAttendance]);

  const fetchAiInsights = async (force = false) => {
    setIsAiLoading(true);
    try {
      const res = await api.get(`/attendance/insights${force ? '?force=true' : ''}`);
      setAiInsights(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    fetchAiInsights();
  }, []);


  // Custom simulation increments per subject: { [subjectId]: { addAttend: number, addMiss: number } }
  const [simulations, setSimulations] = useState<Record<string, { addAttend: number; addMiss: number; addOff: number }>>({});
  const [dateOverrides, setDateOverrides] = useState<Record<string, Record<string, 'PRESENT' | 'ABSENT' | 'OFF'>>>({});
  const [breakdownModalSubject, setBreakdownModalSubject] = useState<{ id: string; name: string; breakdown: any[] } | null>(null);

  const openModal = (sub: any) => {
     let futureItems = [...(sub.futureBreakdown || [])];
     let loggedItems: any[] = [];
     
     if (sub.attendance) {
        sub.attendance.forEach((log: any) => {
           loggedItems.push({
              date: new Date(log.date).toISOString(),
              type: 'LOGGED',
              reason: `Already Logged`,
              count: 1,
              status: log.status
           });
        });
     }

     // Remove items from futureBreakdown if they are already in loggedItems
     futureItems = futureItems.filter(fItem => {
         const fDateStr = new Date(fItem.date).toLocaleDateString();
         return !loggedItems.some(lItem => new Date(lItem.date).toLocaleDateString() === fDateStr);
     });

     const combined = [...loggedItems, ...futureItems].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
     setBreakdownModalSubject({ id: sub.id, name: sub.name, breakdown: combined });
  };

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

  const updateSim = (subjectId: string, addAttend: number, addMiss: number, addOff: number) => {
    setDateOverrides((prev) => {
      if (prev[subjectId]) {
        const next = { ...prev };
        delete next[subjectId];
        return next;
      }
      return prev;
    });
    
    setSimulations((prev) => ({
      ...prev,
      [subjectId]: { addAttend, addMiss, addOff },
    }));
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center bg-card border border-border rounded-3xl">
        <Sparkles className="w-8 h-8 text-primary animate-pulse mx-auto mb-2" />
        <p className="text-xs text-muted-foreground font-medium">Analyzing attendance logs...</p>
      </div>
    );
  }

  if (!hasActiveSemester) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 my-12">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-2">
          <Calendar className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">No Active Semester</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Please create and activate a semester first to start generating attendance forecasts.
        </p>
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

          {/* AI Insights Panel */}
          <div className="mt-4 bg-primary/5 border border-primary/20 rounded-2xl p-4 md:p-5 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl" />
            
            <div className="flex items-center justify-between mb-3 z-10">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">AI Attendance Analysis</h3>
              </div>
              <button 
                onClick={() => fetchAiInsights(true)}
                disabled={isAiLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold rounded-lg transition-colors"
              >
                {isAiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Refresh
              </button>
            </div>

            {isAiLoading && !aiInsights ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : aiInsights ? (
              <div className="space-y-4 z-10">
                <p className="text-sm text-foreground/90 font-medium leading-relaxed bg-background/50 p-3 rounded-xl border border-border/50">
                  {aiInsights.summary}
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Key Absence Reasons</span>
                    <ul className="space-y-1.5">
                      {aiInsights.keyReasons.map((reason: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                          <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Vulnerable Timings</span>
                    <ul className="space-y-1.5">
                      {aiInsights.vulnerableTimings.map((timing: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                          <span>{timing}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                    <Sparkles className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {aiInsights.recommendation}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Unable to load AI insights at the moment.</p>
            )}
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

      {/* Simulation Bounds Panel */}
      {simulationBounds && (
        <div className="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-sm space-y-3 relative overflow-hidden">
          {/* Gradient accent */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between z-10 relative">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Simulation Bounds
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                The precise dates used to calculate your remaining classes.
              </p>
            </div>
            {simulationBounds.missingBoundaries && !hasUnsavedBounds && (
              <span className="flex items-center gap-1.5 text-[10px] font-semibold text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-full whitespace-nowrap">
                <AlertTriangle className="w-3 h-3" /> Action Required: Set Dates
              </span>
            )}
            {hasUnsavedBounds && (
              <button
                onClick={handleSaveBounds}
                disabled={!localStart || !localEnd}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg shadow-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Save Dates
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 z-10 relative pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Commencement of Classes</label>
              <Input 
                type="date"
                value={localStart}
                onChange={(e) => {
                  setLocalStart(e.target.value);
                  setHasUnsavedBounds(true);
                }}
                className="bg-background/50 h-9"
                placeholder="Not set"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Last Teaching Day</label>
              <Input 
                type="date"
                value={localEnd}
                onChange={(e) => {
                  setLocalEnd(e.target.value);
                  setHasUnsavedBounds(true);
                }}
                className="bg-background/50 h-9"
                placeholder="Not set"
              />
            </div>
          </div>
        </div>
      )}

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
              const remaining = sub.remainingClasses || 0;
              const maxRemaining = sub.maxRemainingClasses || remaining;
              const defaultOff = maxRemaining - remaining;
              
              let simAddAttend = remaining;
              let simAddMiss = 0;
              let simAddOff = defaultOff;
              const overrides = dateOverrides[sub.id];

              if (overrides && Object.keys(overrides).length > 0 && sub.futureBreakdown) {
                 simAddAttend = 0;
                 simAddMiss = 0;
                 simAddOff = 0;
                 sub.futureBreakdown.forEach((item: any) => {
                    if (item.type === 'LOGGED') return;
                    const status = overrides[item.date] || (item.type === 'HELD' ? 'PRESENT' : 'OFF');
                    if (status === 'PRESENT') simAddAttend += item.count;
                    else if (status === 'ABSENT') simAddMiss += item.count;
                    else if (status === 'OFF') simAddOff += item.count;
                 });
              } else if (simulations[sub.id]) {
                 simAddAttend = simulations[sub.id].addAttend;
                 simAddMiss = simulations[sub.id].addMiss;
                 simAddOff = simulations[sub.id].addOff;
              }
              
              const simAttended = sub.attended + simAddAttend;
              const simTotal = sub.total + simAddAttend + simAddMiss;
              const simPct = simTotal > 0 ? (simAttended / simTotal) * 100 : 0;
              
              const remainingText = maxRemaining > remaining ? `${remaining} - ${maxRemaining} remaining` : `${remaining} remaining`;

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
                          Forecasted attendance <span className="font-semibold text-foreground">{simAttended}</span> /{" "}
                          <span className="font-semibold text-foreground">{simTotal}</span> classes (<span className={simPct >= subTarget ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>{simPct.toFixed(1)}%</span>)
                          <span className="ml-2 opacity-70">
                            (Currently {sub.attended}/{sub.total})
                          </span>
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-xs font-bold text-muted-foreground mb-0.5">Expected Total Classes</div>
                        <div className="text-xl font-black text-foreground">{sub.total + remaining}{maxRemaining > remaining ? ` - ${sub.total + maxRemaining}` : ''} <span className="text-xs text-muted-foreground font-medium">({remainingText})</span></div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden relative mt-2">
                      <div className="absolute top-0 bottom-0 w-0.5 bg-foreground/60 z-10" style={{ left: `${subTarget}%` }} />
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${simPct >= subTarget ? "bg-emerald-500" : "bg-amber-500"}`}
                        style={{ width: `${Math.min(simPct, 100)}%` }}
                      />
                    </div>

                    <div className="pt-3 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex flex-col">
                        <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                          <Calendar className="w-3.5 h-3.5" /> End of Semester Simulator
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground">Mark the {maxRemaining} remaining classes</span>
                          {sub.futureBreakdown && sub.futureBreakdown.length > 0 && (
                            <button 
                              onClick={() => openModal(sub)}
                              className="text-[10px] bg-primary/10 text-primary hover:bg-primary/20 px-2 py-0.5 rounded-full font-semibold transition-colors flex items-center gap-1"
                            >
                              <Info className="w-3 h-3" /> View Logic
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-4 bg-muted/40 p-2.5 rounded-xl border border-border/50 overflow-x-auto w-full sm:w-auto">
                        {/* Attend Stepper */}
                        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-start">
                          <button 
                            type="button"
                            onClick={() => openModal(sub)}
                            className="text-xs font-semibold text-emerald-500 whitespace-nowrap hover:underline cursor-pointer"
                          >
                            Present:
                          </button>
                          <div className="w-[110px]">
                            <Stepper 
                              size="sm"
                              min={0}
                              max={Math.max(0, maxRemaining - simAddMiss - simAddOff)}
                              value={simAddAttend}
                              onChange={(val) => {
                                updateSim(sub.id, val, simAddMiss, simAddOff);
                              }}
                            />
                          </div>
                        </div>

                        {/* Miss Stepper */}
                        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-start sm:border-l sm:border-border/60 sm:pl-4">
                          <button 
                            type="button"
                            onClick={() => openModal(sub)}
                            className="text-xs font-semibold text-rose-500 whitespace-nowrap hover:underline cursor-pointer"
                          >
                            Absent:
                          </button>
                          <div className="w-[110px]">
                            <Stepper 
                              size="sm"
                              min={0}
                              max={Math.max(0, maxRemaining - simAddAttend - simAddOff)}
                              value={simAddMiss}
                              onChange={(val) => {
                                updateSim(sub.id, simAddAttend, val, simAddOff);
                              }}
                            />
                          </div>
                        </div>

                        {/* Off Stepper */}
                        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-start sm:border-l sm:border-border/60 sm:pl-4">
                          <button 
                            type="button"
                            onClick={() => openModal(sub)}
                            className="text-xs font-semibold text-amber-500 whitespace-nowrap hover:underline cursor-pointer"
                          >
                            Off:
                          </button>
                          <div className="w-[110px]">
                            <Stepper 
                              size="sm"
                              min={0}
                              max={Math.max(0, maxRemaining - simAddAttend - simAddMiss)}
                              value={simAddOff}
                              onChange={(val) => {
                                updateSim(sub.id, simAddAttend, simAddMiss, val);
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <FutureClassesModal 
        isOpen={!!breakdownModalSubject}
        onClose={() => setBreakdownModalSubject(null)}
        subjectName={breakdownModalSubject?.name || ""}
        breakdown={breakdownModalSubject?.breakdown || []}
        dateOverrides={breakdownModalSubject ? dateOverrides[breakdownModalSubject.id] || {} : {}}
        onOverrideChange={(date, status) => {
          if (!breakdownModalSubject) return;
          setDateOverrides(prev => ({
             ...prev,
             [breakdownModalSubject.id]: {
                ...(prev[breakdownModalSubject.id] || {}),
                [date]: status
             }
          }));
        }}
      />
    </div>
  );
};
