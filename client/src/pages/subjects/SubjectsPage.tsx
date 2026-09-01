import { useCacheStore } from "../../stores/cacheStore";
import React, { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Loader2, AlertCircle, TrendingUp, TrendingDown, CheckCircle2, XCircle, Shield, LayoutDashboard, Sparkles } from "lucide-react";
import { PageSkeleton } from "../../components/common/PageSkeleton";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { CreateSemesterModal } from "../../components/semester/CreateSemesterModal";
import { SubjectModal } from "../../components/subjects/SubjectModal";
import { useAuthStore } from "../../stores/authStore";
import { useNavigate } from "react-router-dom";

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
  if (stat.total === 0) return { text: "No classes recorded yet", color: "text-muted-foreground" };
  if (stat.percentage >= stat.target) {
    return stat.canMiss > 0
      ? { text: `Can miss ${stat.canMiss} lecture${stat.canMiss > 1 ? "s" : ""}`, color: "text-emerald-400" }
      : { text: "Can't miss the next lecture", color: "text-yellow-400" };
  }
  return {
    text: `Need to attend ${stat.needAttend} lecture${stat.needAttend > 1 ? "s" : ""}`,
    color: "text-red-400",
  };
};

const StatBadge: React.FC<{ stat: SubjectStat }> = ({ stat }) => {
  const pct = Math.round(stat.percentage * 10) / 10;
  const isGood = stat.percentage >= stat.target;
  const isWarning = stat.percentage >= stat.target && stat.canMiss === 0;

  let bgColor = isGood ? (isWarning ? "bg-yellow-500/10 border-yellow-500/20" : "bg-emerald-500/10 border-emerald-500/20") : "bg-red-500/10 border-red-500/20";
  let textColor = isGood ? (isWarning ? "text-yellow-400" : "text-emerald-400") : "text-red-400";

  return (
    <div className={`flex flex-col items-center justify-center rounded-xl border px-3 py-2 min-w-[72px] ${bgColor}`}>
      <span className={`text-xl font-bold leading-none ${textColor}`}>{pct}</span>
      <div className="w-full h-px bg-white/10 my-1" />
      <span className={`text-xs font-semibold ${textColor}`}>{stat.target}</span>
    </div>
  );
};

const SubjectCard: React.FC<{
  stat: SubjectStat;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ stat, onEdit, onDelete }) => {
  const navigate = useNavigate();
  const statusMsg = getStatusMessage(stat);
  const pct = stat.percentage;

  return (
    <div 
      onClick={() => navigate(`/subjects/${stat.id}`)}
      className="bg-card border border-border rounded-2xl p-4 hover:border-primary/30 transition-all group relative overflow-hidden cursor-pointer shadow-sm"
    >
      <div className="absolute top-0 left-0 w-1.5 h-full rounded-l-2xl" style={{ backgroundColor: stat.colorHex || "#8b5cf6" }} />
      <div className="pl-3 space-y-3">
        {/* Top row: name + badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-foreground leading-tight truncate group-hover:text-primary transition-colors">{stat.name}</h3>
            <p className={`text-xs mt-0.5 font-medium ${statusMsg.color}`}>{statusMsg.text}</p>
          </div>
          <StatBadge stat={stat} />
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
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
              Att: <span className="text-foreground font-semibold">{stat.attended}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
              Miss: <span className="text-foreground font-semibold">{stat.missed}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
              Off: <span className="text-foreground font-semibold">{stat.off}</span>
            </span>
            <span className="text-muted-foreground">
              Tot: <span className="text-foreground font-semibold">{stat.total}</span>
            </span>
          </div>
          {/* Edit/Delete */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Edit Subject"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
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

export const SubjectsPage = () => {
  const cachedSubjectsData = useCacheStore((state) => state.subjects);
  const setCache = useCacheStore((state) => state.setCache);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [subjectStats, setSubjectStats] = useState<SubjectStat[]>(cachedSubjectsData?.stats || []);
  const [subjects, setSubjects] = useState<Subject[]>(cachedSubjectsData?.subjects || []);
  const [isLoading, setIsLoading] = useState(!cachedSubjectsData);
  const [isAdding, setIsAdding] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [activeSemesterId, setActiveSemesterId] = useState<string | null>(null);
  const [isCreateSemesterOpen, setIsCreateSemesterOpen] = useState(false);

  const fetchData = async () => {
    try {
      if (!cachedSubjectsData) setIsLoading(true);
      const [subjectsRes, semesterRes] = await Promise.all([
        api.get("/subjects"),
        api.get("/semesters/active"),
      ]);
      const newSubjects = Array.isArray(subjectsRes.data) ? subjectsRes.data : [];
      setSubjects(newSubjects);

      const semester = semesterRes.data;
      if (semester) {
        setActiveSemesterId(semester.id);
        const statsRes = await api.get(`/attendance/stats?semesterId=${semester.id}`);
        const newStats = Array.isArray(statsRes.data) ? statsRes.data : (statsRes.data?.subjects || []);
        setSubjectStats(newStats);
        setCache('subjects', { subjects: newSubjects, stats: newStats });
      } else {
        setCache('subjects', { subjects: newSubjects, stats: [] });
      }
    } catch (error) {
      console.error("Failed to fetch subjects:", error);
    } finally {
      setIsLoading(false);
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
    toast("Delete Subject", {
      description: "Are you sure you want to remove this subject? Past attendance will be safely preserved.",
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            await api.delete(`/subjects/${id}?preserveHistory=true`);
            fetchData();
            toast.success("Subject deleted safely");
          } catch (error) {
            console.error("Failed to delete subject:", error);
            toast.error("Failed to delete subject");
          }
        }
      },
      cancel: { label: "Cancel", onClick: () => {} }
    });
  };

  // Compute overall stats across all subjects
  const safeStats = Array.isArray(subjectStats) ? subjectStats : [];
  const safeSubjects = Array.isArray(subjects) ? subjects : [];
  const overallAttended = safeStats.reduce((sum, s) => sum + s.attended, 0);
  const overallMissed = safeStats.reduce((sum, s) => sum + s.missed, 0);
  const overallOff = safeStats.reduce((sum, s) => sum + s.off, 0);
  const overallTotal = safeStats.reduce((sum, s) => sum + s.total, 0);
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
    percentage: overallPct,
    canMiss: overallPct >= overallTarget ? Math.floor((overallAttended - (overallTarget / 100) * overallTotal) / (overallTarget / 100)) : 0,
    needAttend: overallPct < overallTarget && overallTarget < 100 ? Math.ceil(((overallTarget / 100) * overallTotal - overallAttended) / (1 - overallTarget / 100)) : 0,
  };

  if (isLoading) {
    return <PageSkeleton type="grid" />;
  }

  // Merge subjectStats with subject info (for subjects with no recorded attendance yet)
  const mergedStats: SubjectStat[] = safeSubjects.map(sub => {
    const stat = safeStats.find(s => s.id === sub.id);
    if (stat) return { ...stat, colorHex: sub.colorHex || stat.colorHex };
    return {
      id: sub.id,
      name: sub.name,
      code: sub.code,
      colorHex: sub.colorHex || "#8b5cf6",
      target: user?.targetAttendance ?? 75,
      attended: 0,
      missed: 0,
      off: 0,
      total: 0,
      percentage: 0,
      canMiss: 0,
      needAttend: 0,
    };
  });

  return (
    <div className="p-4 md:p-8 space-y-5 max-w-4xl mx-auto w-full pb-24 md:pb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Subjects</h1>
            <p className="text-sm text-muted-foreground">Your semester attendance overview.</p>
          </div>
          <button
            onClick={() => { setEditingSubject(null); setIsAdding(true); }}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Subject</span>
          </button>
        </div>

        {/* Quick Actions (Moved from MobileNav) */}
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div 
            onClick={() => navigate("/semester")}
            className="bg-card border border-border/70 hover:border-primary/40 rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all active:scale-[0.98]"
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
            className="bg-card border border-border/70 hover:border-primary/40 rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all active:scale-[0.98]"
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
            <h3 className="text-base font-bold text-white">No Active Semester</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Create an active semester to enable attendance percentage calculations and safe buffer metrics.
            </p>
          </div>
          <button
            onClick={() => setIsCreateSemesterOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Semester</span>
          </button>
        </div>
      )}

      {mergedStats.length === 0 && !isLoading && !isAdding ? (
        <div className="text-center py-12 bg-card border border-border rounded-2xl">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No subjects yet</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mb-6">
            You haven't added any subjects to track. Start by adding the subjects you are studying this semester.
          </p>
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-2 bg-primary/20 text-primary hover:bg-primary/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add First Subject
          </button>
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
                className={`relative rounded-3xl border border-border overflow-hidden bg-card/80 backdrop-blur-sm p-6 shadow-sm hover:border-primary/40 cursor-pointer transition-all group`}
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
                        <h2 className="text-lg font-bold text-foreground">Overall Attendance</h2>
                      </div>
                      <p className={`text-sm font-semibold`} style={{ color: ringColor }}>
                        {getStatusMessage(overallStat).text}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Target: <span className="text-foreground font-semibold">{overallTarget}%</span>
                        {isGood
                          ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold ml-2">+{((overallPct ?? 0) - (overallTarget ?? 75)).toFixed(1)}% buffer</span>
                          : <span className="text-rose-600 dark:text-rose-400 font-semibold ml-2">{((overallTarget ?? 75) - (overallPct ?? 0)).toFixed(1)}% short</span>
                        }
                      </p>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: "Attended", value: overallAttended, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
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
                      <div className="h-2 bg-muted rounded-full overflow-hidden relative">
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
              />
            );
          })}
        </div>
      )}

      <CreateSemesterModal
        isOpen={isCreateSemesterOpen}
        onClose={() => setIsCreateSemesterOpen(false)}
        onSuccess={fetchData}
      />
      <SubjectModal
        isOpen={isAdding}
        onClose={() => { setIsAdding(false); setEditingSubject(null); }}
        onSuccess={fetchData}
        subject={editingSubject}
      />
    </div>
  );
};
