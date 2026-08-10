import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Loader2, TrendingUp, AlertTriangle, ShieldCheck, Settings2 } from "lucide-react";
import { api } from "../../lib/api";

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
  const [stats, setStats] = useState<SubjectStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get("/attendance/stats");
        setStats(res.data);
      } catch (error) {
        console.error("Failed to fetch subject stats:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  const getStatusColor = (percentage: number, target: number) => {
    if (percentage >= target + 5) return "text-emerald-400";
    if (percentage >= target) return "text-blue-400";
    if (percentage >= target - 5) return "text-yellow-400";
    return "text-rose-400";
  };

  const getPredictiveText = (stat: SubjectStats) => {
    if (stat.total === 0) return { text: "No classes logged yet", icon: <TrendingUp className="w-4 h-4 text-muted-foreground" /> };
    
    // Calculate if we can skip the next class and stay above target
    const percentageIfSkipNext = stat.total > 0 ? (stat.attended / (stat.total + 1)) * 100 : 0;
    
    if (stat.percentage < stat.target) {
      // Calculate how many we need to attend consecutively to hit target
      // (attended + x) / (total + x) = target / 100
      // 100*attended + 100*x = target*total + target*x
      // x*(100 - target) = target*total - 100*attended
      const required = Math.ceil((stat.target * stat.total - 100 * stat.attended) / (100 - stat.target));
      return { 
        text: `Need to attend next ${required} class${required > 1 ? 'es' : ''}`, 
        icon: <AlertTriangle className="w-4 h-4 text-rose-400" />
      };
    } else if (percentageIfSkipNext >= stat.target) {
      // Calculate how many safe leaves we have
      // attended / (total + x) = target / 100
      // 100*attended = target*total + target*x
      // x = (100*attended - target*total) / target
      const safeLeaves = Math.floor((100 * stat.attended - stat.target * stat.total) / stat.target);
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
          <h1 className="text-2xl font-bold text-white">Attendance Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time metrics and safe leave predictions.</p>
        </div>
        <Link 
          to="/subjects/manage" 
          className="p-2 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white rounded-lg transition-colors"
          title="Manage Subjects"
        >
          <Settings2 className="w-5 h-5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stats.map(stat => {
          const prediction = getPredictiveText(stat);
          return (
            <Link to={`/subjects/${stat.id}`} key={stat.id} className="block group">
              <div className="bg-[#0c0d12] border border-white/5 rounded-2xl p-5 group-hover:border-white/10 group-hover:bg-[#111218] transition-all relative overflow-hidden h-full">
                <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: stat.colorHex || "#8b5cf6" }} />
                
                <div className="flex justify-between items-start pl-2 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white leading-tight">{stat.name}</h3>
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
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{ 
                        width: `${stat.total > 0 ? stat.percentage : 0}%`,
                        backgroundColor: stat.colorHex || "#8b5cf6" 
                      }}
                    />
                  </div>
                  
                  {/* Prediction Text */}
                  <div className="flex items-center gap-2 bg-[#13151a] px-3 py-2 rounded-lg text-xs font-medium text-white/80 group-hover:bg-[#1a1c23] transition-colors">
                    {prediction.icon}
                    {prediction.text}
                    <span className="ml-auto text-[10px] text-muted-foreground border border-white/10 px-1.5 py-0.5 rounded">
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
