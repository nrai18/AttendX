import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Loader2, TrendingUp, AlertTriangle, ShieldCheck, Settings2 } from "lucide-react";
import { api } from "../../lib/api";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { useCacheStore } from "../../stores/cacheStore";

interface SubjectStats {
  id: string;
  name: string;
  code?: string;
  colorHex?: string;
  target: number;
  attended: number;
  total: number;
  percentage: number;
}

export const SubjectsOverviewPage = () => {
  const cachedStats =
    useCacheStore.getState().subjects?.stats ||
    useAttendanceStore.getState().subjects ||
    [];
  const [stats, setStats] = useState<SubjectStats[]>(
    Array.isArray(cachedStats) ? (cachedStats as any) : [],
  );
  const [isLoading, setIsLoading] = useState(cachedStats.length === 0);

  useEffect(() => {
    const fetchStats = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const offlineSubs =
          useCacheStore.getState().subjects?.stats ||
          useAttendanceStore.getState().subjects ||
          [];
        setStats(Array.isArray(offlineSubs) ? (offlineSubs as any) : []);
        setIsLoading(false);
        return;
      }
      try {
        const res = await api.get("/attendance/stats");
        const nextStats = Array.isArray(res.data) ? res.data : (res.data?.subjects || []);
        setStats(nextStats);
      } catch (error) {
        console.error("Failed to fetch subject stats:", error);
        const offlineSubs =
          useCacheStore.getState().subjects?.stats ||
          useAttendanceStore.getState().subjects ||
          [];
        if (Array.isArray(offlineSubs) && offlineSubs.length > 0) {
          setStats(offlineSubs as any);
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
    window.addEventListener("attendance-updated", fetchStats);
    return () => window.removeEventListener("attendance-updated", fetchStats);
  }, []);

  const getStatusColor = (percentage: number, target: number) => {
    if (percentage >= target + 5) return "text-emerald-400";
    if (percentage >= target) return "text-blue-400";
    if (percentage >= target - 5) return "text-yellow-400";
    return "text-rose-400";
  };

  const getForecastText = (stat: SubjectStats) => {
    const target = Number(stat.target) || 75;
    if (stat.total === 0) return { text: "No classes logged yet", icon: <TrendingUp className="w-4 h-4 text-muted-foreground" /> };
    
    // Calculate if we can skip the next class and stay above target
    const percentageIfSkipNext = stat.total > 0 ? (stat.attended / (stat.total + 1)) * 100 : 0;
    
    if (stat.percentage < target) {
      if (target >= 100) {
        return {
          text: "Need 100% attendance (cannot reach 100% after a miss)",
          icon: <AlertTriangle className="w-4 h-4 text-rose-400" />,
        };
      }
      const required = Math.ceil((target * stat.total - 100 * stat.attended) / (100 - target));
      return { 
        text: `Need to attend next ${required} class${required > 1 ? 'es' : ''}`, 
        icon: <AlertTriangle className="w-4 h-4 text-rose-400" />
      };
    } else if (percentageIfSkipNext >= target) {
      if (target <= 0) {
        return {
          text: "Target 0% — any skips allowed",
          icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
        };
      }
      const safeLeaves = Math.floor((100 * stat.attended - target * stat.total) / target);
      return {
        text: `${safeLeaves} safe leave${safeLeaves > 1 ? 's' : ''} available`,
        icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />
      };
    } else {
      return {
        text: "Can't miss the next lecture",
        icon: <AlertTriangle className="w-4 h-4 text-yellow-400" />
      };
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto w-full pb-24 md:pb-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Attendance Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time metrics and safe leave predictions.</p>
        </div>
        <Link 
          to="/subjects/manage" 
          className="p-2 bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          title="Manage Subjects"
        >
          <Settings2 className="w-5 h-5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stats.map((stat, idx) => {
          const prediction = getForecastText(stat);
          return (
            <Link to={`/subjects/${stat.id}`} key={stat.id || `fallback-${idx}`} className="block group">
              <div className="bg-card border border-border rounded-2xl p-5 group-hover:border-primary/30 group-hover:bg-muted/30 transition-all relative overflow-hidden h-full">
                <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: stat.colorHex || "#8b5cf6" }} />
                
                <div className="flex justify-between items-start pl-2 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground leading-tight">{stat.name}</h3>
                    {stat.code && <p className="text-xs text-muted-foreground mt-1">{stat.code}</p>}
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${getStatusColor(stat.percentage, stat.target)}`}>
                      {stat.total > 0 ? (stat.percentage ?? 0).toFixed(1) : "0"}%
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                      {stat.attended} / {stat.total} Attended
                    </p>
                  </div>
                </div>

                <div className="pl-2 space-y-3">
                  {/* Progress Bar */}
                  <div className="h-2 w-full bg-muted/80 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{ 
                        width: `${stat.total > 0 ? stat.percentage : 0}%`,
                        backgroundColor: stat.colorHex || "#8b5cf6" 
                      }}
                    />
                  </div>
                  
                  {/* Prediction Text */}
                  <div className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-lg text-xs font-medium text-foreground/80 group-hover:bg-muted transition-colors">
                    {prediction.icon}
                    {prediction.text}
                    <span className="ml-auto text-[10px] text-muted-foreground border border-border px-1.5 py-0.5 rounded">
                      Target: {stat.target}%
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
