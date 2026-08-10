import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, ArrowLeft, TrendingUp, AlertTriangle, ShieldCheck, Activity } from "lucide-react";
import { api } from "../../lib/api";

interface SubjectDetailStats {
  id: string;
  name: string;
  code?: string;
  colorHex?: string;
  target: number;
  attended: number;
  total: number;
  percentage: number;
  remainingClasses: number;
}

export const SubjectDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [stats, setStats] = useState<SubjectDetailStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Simulator State
  const [simAttended, setSimAttended] = useState(0);
  const [simMissed, setSimMissed] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const res = await api.get(`/attendance/stats/${id}`);
        setStats(res.data);
      } catch (error) {
        console.error("Failed to fetch subject details:", error);
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchStats();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
        <AlertTriangle className="w-12 h-12 text-rose-400 mb-4 opacity-50" />
        <h2 className="text-xl font-bold text-white mb-2">Subject Not Found</h2>
        <p className="text-muted-foreground mb-6">The subject you are looking for does not exist or was removed.</p>
        <Link to="/subjects" className="text-primary hover:underline">Return to Overview</Link>
      </div>
    );
  }

  // Simulator Calculations
  const projectedAttended = stats.attended + simAttended;
  const projectedTotal = stats.total + simAttended + simMissed;
  const projectedPercentage = projectedTotal > 0 ? (projectedAttended / projectedTotal) * 100 : 0;
  
  const simRemainingPool = Math.max(0, stats.remainingClasses - simAttended - simMissed);

  // Status Colors
  const getStatusColor = (percentage: number, target: number) => {
    if (percentage >= target + 5) return "text-emerald-400";
    if (percentage >= target) return "text-blue-400";
    if (percentage >= target - 5) return "text-yellow-400";
    return "text-rose-400";
  };

  // Predictive Text for current state
  const safeLeaves = Math.floor((100 * stats.attended - stats.target * stats.total) / stats.target);
  const requiredToTarget = stats.percentage < stats.target 
    ? Math.ceil((stats.target * stats.total - 100 * stats.attended) / (100 - stats.target))
    : 0;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto w-full pb-24 md:pb-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/subjects" className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white leading-tight">{stats.name}</h1>
          {stats.code && <p className="text-sm text-muted-foreground mt-0.5">{stats.code}</p>}
        </div>
      </div>

      {/* Current Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#0c0d12] border border-white/5 rounded-2xl p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Current %</p>
          <p className={`text-3xl font-bold ${getStatusColor(stats.percentage, stats.target)}`}>
            {stats.total > 0 ? (stats.percentage ?? 0).toFixed(1) : "0"}%
          </p>
        </div>
        <div className="bg-[#0c0d12] border border-white/5 rounded-2xl p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Target</p>
          <p className="text-3xl font-bold text-white">{stats.target}%</p>
        </div>
        <div className="bg-[#0c0d12] border border-white/5 rounded-2xl p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Attended</p>
          <p className="text-3xl font-bold text-white">{stats.attended} <span className="text-lg text-muted-foreground font-medium">/ {stats.total}</span></p>
        </div>
        <div className="bg-[#0c0d12] border border-white/5 rounded-2xl p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</p>
          <div className="mt-2 flex items-center gap-2">
            {stats.percentage >= stats.target ? (
              <>
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">{safeLeaves > 0 ? `${safeLeaves} Safe Leaves` : 'On Track'}</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <span className="text-rose-400 font-semibold">Attend Next {requiredToTarget}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* What-If Simulator */}
      <div className="bg-[#050508] border border-white/10 rounded-3xl p-6 md:p-8 mt-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        
        <div className="flex items-center gap-3 mb-6 relative">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Attendance Simulator</h2>
            <p className="text-sm text-muted-foreground mt-1">Project your attendance to the end of the semester.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative">
          {/* Controls */}
          <div className="space-y-8">
            <div className="bg-white/5 p-4 rounded-xl flex justify-between items-center border border-white/5">
              <span className="text-sm font-medium text-white/80">Remaining Classes</span>
              <span className="text-xl font-bold text-white">{stats.remainingClasses}</span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-end mb-2">
                  <label className="text-sm font-medium text-emerald-400">Classes to ATTEND</label>
                  <span className="text-lg font-bold text-white">{simAttended}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max={stats.remainingClasses - simMissed} 
                  value={simAttended}
                  onChange={(e) => setSimAttended(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  disabled={stats.remainingClasses === 0}
                />
              </div>

              <div>
                <div className="flex justify-between items-end mb-2">
                  <label className="text-sm font-medium text-rose-400">Classes to MISS</label>
                  <span className="text-lg font-bold text-white">{simMissed}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max={stats.remainingClasses - simAttended} 
                  value={simMissed}
                  onChange={(e) => setSimMissed(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  disabled={stats.remainingClasses === 0}
                />
              </div>
            </div>

            <div className="text-sm text-muted-foreground flex items-center justify-between">
              <span>Unallocated remaining classes:</span>
              <span className="font-mono text-white bg-white/10 px-2 py-0.5 rounded">{simRemainingPool}</span>
            </div>
          </div>

          {/* Projection Result */}
          <div className="flex flex-col items-center justify-center p-8 bg-[#0c0d12] border border-white/5 rounded-2xl relative">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-6">Projected Attendance</h3>
            
            <div className="relative flex items-center justify-center">
              <svg className="w-48 h-48 transform -rotate-90">
                <circle 
                  cx="96" cy="96" r="88" 
                  stroke="currentColor" 
                  strokeWidth="12" 
                  fill="transparent" 
                  className="text-white/5" 
                />
                <circle 
                  cx="96" cy="96" r="88" 
                  stroke="currentColor" 
                  strokeWidth="12" 
                  fill="transparent" 
                  strokeDasharray={`${2 * Math.PI * 88}`}
                  strokeDashoffset={`${2 * Math.PI * 88 * (1 - projectedPercentage / 100)}`}
                  strokeLinecap="round"
                  className={`transition-all duration-700 ease-out ${getStatusColor(projectedPercentage, stats.target)}`} 
                />
                {/* Target Marker */}
                <circle
                  cx="96" cy="96" r="88"
                  stroke="currentColor"
                  strokeWidth="16"
                  fill="transparent"
                  strokeDasharray={`4 ${2 * Math.PI * 88 - 4}`}
                  strokeDashoffset={`${2 * Math.PI * 88 * (1 - stats.target / 100)}`}
                  className="text-white/40 opacity-50"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className={`text-4xl font-bold tracking-tighter ${getStatusColor(projectedPercentage, stats.target)}`}>
                  {(projectedPercentage ?? 0).toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground mt-1 font-medium">Target: {stats.target}%</span>
              </div>
            </div>

            <div className="mt-8 text-center">
              {projectedPercentage >= stats.target ? (
                <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-full text-sm font-semibold border border-emerald-500/20">
                  <ShieldCheck className="w-4 h-4" />
                  Target Achieved
                </div>
              ) : (
                <div className="flex items-center gap-2 text-rose-400 bg-rose-500/10 px-4 py-2 rounded-full text-sm font-semibold border border-rose-500/20">
                  <AlertTriangle className="w-4 h-4" />
                  Below Target
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
