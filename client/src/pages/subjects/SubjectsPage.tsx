import React, { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Loader2, AlertCircle, TrendingUp, TrendingDown, CheckCircle2, XCircle, Shield } from "lucide-react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import { useNavigate } from "react-router-dom";

interface Subject {
  id: string;
  name: string;
  code?: string;
  faculty?: string;
  colorHex?: string;
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
  const statusMsg = getStatusMessage(stat);
  const pct = stat.percentage;

  return (
    <div className="bg-[#0c0d12] border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-colors group relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl" style={{ backgroundColor: stat.colorHex || "#8b5cf6" }} />
      <div className="pl-3 space-y-3">
        {/* Top row: name + badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-white leading-tight truncate">{stat.name}</h3>
            <p className={`text-xs mt-0.5 ${statusMsg.color}`}>{statusMsg.text}</p>
          </div>
          <StatBadge stat={stat} />
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
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
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Att: <span className="text-white font-medium">{stat.attended}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
              Miss: <span className="text-white font-medium">{stat.missed}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
              Off: <span className="text-white font-medium">{stat.off}</span>
            </span>
            <span className="text-muted-foreground">
              Tot: <span className="text-white font-medium">{stat.total}</span>
            </span>
          </div>
          {/* Edit/Delete */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
              title="Edit Subject"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
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
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [subjectStats, setSubjectStats] = useState<SubjectStat[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeSemesterId, setActiveSemesterId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [faculty, setFaculty] = useState("");
  const [colorHex, setColorHex] = useState("#8b5cf6");

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [subjectsRes, semesterRes] = await Promise.all([
        api.get("/subjects"),
        api.get("/semesters/active"),
      ]);
      setSubjects(subjectsRes.data);

      const semester = semesterRes.data;
      if (semester) {
        setActiveSemesterId(semester.id);
        const statsRes = await api.get(`/attendance/stats?semesterId=${semester.id}`);
        setSubjectStats(statsRes.data);
      }
    } catch (error) {
      console.error("Failed to fetch subjects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setName("");
    setCode("");
    setFaculty("");
    setColorHex("#8b5cf6");
    setIsAdding(false);
    setEditingId(null);
  };

  const handleEdit = (subject: Subject) => {
    setName(subject.name);
    setCode(subject.code || "");
    setFaculty(subject.faculty || "");
    setColorHex(subject.colorHex || "#8b5cf6");
    setEditingId(subject.id);
    setIsAdding(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.patch(`/subjects/${editingId}`, { name, code, faculty, colorHex });
      } else {
        await api.post("/subjects", { name, code, faculty, colorHex });
      }
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Failed to save subject:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to remove this subject? Past attendance will be safely preserved.")) {
      try {
        await api.delete(`/subjects/${id}?preserveHistory=true`);
        fetchData();
      } catch (error) {
        console.error("Failed to delete subject:", error);
      }
    }
  };

  // Compute overall stats across all subjects
  const overallAttended = subjectStats.reduce((sum, s) => sum + s.attended, 0);
  const overallMissed = subjectStats.reduce((sum, s) => sum + s.missed, 0);
  const overallOff = subjectStats.reduce((sum, s) => sum + s.off, 0);
  const overallTotal = subjectStats.reduce((sum, s) => sum + s.total, 0);
  const overallPct = overallTotal > 0 ? (overallAttended / overallTotal) * 100 : 0;
  const overallTarget = subjectStats.length > 0
    ? Math.round(subjectStats.reduce((sum, s) => sum + s.target, 0) / subjectStats.length)
    : 75;
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
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Merge subjectStats with subject info (for subjects with no recorded attendance yet)
  const mergedStats: SubjectStat[] = subjects.map(sub => {
    const stat = subjectStats.find(s => s.id === sub.id);
    if (stat) return { ...stat, colorHex: sub.colorHex || stat.colorHex };
    return {
      id: sub.id,
      name: sub.name,
      code: sub.code,
      colorHex: sub.colorHex || "#8b5cf6",
      target: 75,
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
          <h1 className="text-2xl font-bold text-white">Subjects</h1>
          <p className="text-sm text-muted-foreground">Your semester attendance overview.</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsAdding(true); }}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Subject</span>
        </button>
      </div>

      {(isAdding || editingId) && (
        <form onSubmit={handleSubmit} className="bg-[#0c0d12] border border-white/10 rounded-2xl p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white">{editingId ? "Edit Subject" : "New Subject"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subject Name *</label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Digital Design"
                className="w-full bg-[#13151a] border border-white/5 rounded-lg px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subject Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. ECSE303"
                className="w-full bg-[#13151a] border border-white/5 rounded-lg px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Faculty Name</label>
              <input
                type="text"
                value={faculty}
                onChange={(e) => setFaculty(e.target.value)}
                placeholder="e.g. SAK"
                className="w-full bg-[#13151a] border border-white/5 rounded-lg px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Color Indicator</label>
              <div className="flex gap-2">
                {["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899"].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setColorHex(color)}
                    className={`w-10 h-10 rounded-full transition-transform ${colorHex === color ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#13151a]" : "opacity-50 hover:opacity-100"}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-black hover:bg-gray-200 transition-colors"
            >
              Save Subject
            </button>
          </div>
        </form>
      )}

      {mergedStats.length === 0 && !isLoading && !isAdding ? (
        <div className="text-center py-12 bg-[#0c0d12] border border-white/5 rounded-2xl">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No subjects yet</h3>
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
              <div className={`relative rounded-3xl border border-white/10 overflow-hidden bg-gradient-to-br ${bgGlow} to-transparent p-6`}>
                {/* Subtle background glow */}
                <div
                  className="absolute -top-16 -right-16 w-64 h-64 rounded-full blur-3xl opacity-20"
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
                        stroke="rgba(255,255,255,0.05)"
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
                        stroke="rgba(255,255,255,0.25)"
                        strokeWidth="2"
                        strokeDasharray={`2 ${circumference - 2}`}
                        strokeDashoffset={-((overallTarget / 100) * circumference)}
                      />
                    </svg>
                    {/* Centre text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-black text-white leading-none">
                        {overallPct.toFixed(1)}
                      </span>
                      <span className="text-xs text-white/40 font-medium mt-0.5">%</span>
                    </div>
                  </div>

                  {/* Right content */}
                  <div className="flex-1 space-y-4 text-center md:text-left">
                    <div>
                      <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                        <Shield className="w-4 h-4" style={{ color: ringColor }} />
                        <h2 className="text-lg font-bold text-white">Overall Attendance</h2>
                      </div>
                      <p className={`text-sm font-medium`} style={{ color: ringColor }}>
                        {getStatusMessage(overallStat).text}
                      </p>
                      <p className="text-xs text-white/40 mt-1">
                        Target: <span className="text-white/60 font-semibold">{overallTarget}%</span>
                        {isGood
                          ? <span className="text-emerald-400 ml-2">+{(overallPct - overallTarget).toFixed(1)}% buffer</span>
                          : <span className="text-rose-400 ml-2">{(overallTarget - overallPct).toFixed(1)}% short</span>
                        }
                      </p>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: "Attended", value: overallAttended, color: "text-emerald-400", bg: "bg-emerald-500/10" },
                        { label: "Missed", value: overallMissed, color: "text-rose-400", bg: "bg-rose-500/10" },
                        { label: "Off", value: overallOff, color: "text-yellow-400", bg: "bg-yellow-500/10" },
                        { label: "Total", value: overallTotal, color: "text-white", bg: "bg-white/5" },
                      ].map(({ label, value, color, bg }) => (
                        <div key={label} className={`${bg} rounded-xl p-2.5 text-center`}>
                          <p className={`text-lg font-bold ${color}`}>{value}</p>
                          <p className="text-[10px] text-white/40 mt-0.5 uppercase tracking-wide">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Linear progress bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-white/30">
                        <span>0%</span>
                        <span className="text-white/50">Target {overallTarget}%</span>
                        <span>100%</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden relative">
                        {/* Target line */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-white/30 z-10"
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
          {mergedStats.map((stat) => {
            const sub = subjects.find(s => s.id === stat.id);
            return (
              <SubjectCard
                key={stat.id}
                stat={stat}
                onEdit={() => sub && handleEdit(sub)}
                onDelete={() => handleDelete(stat.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
