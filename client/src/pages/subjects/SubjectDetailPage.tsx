import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  SlidersHorizontal,
  Check,
  X,
  Minus,
  Ban,
  Pencil,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Activity,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  ChevronDown,
  Sparkles
} from "lucide-react";
import { api } from "../../lib/api";
import { triggerAttendancePopup } from "../../stores/animationPopupStore";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { useAuthStore } from "../../stores/authStore";

interface AttendanceLogItem {
  id: string;
  date: string;
  dateFormatted: string;
  timestamp: number;
  subjectId: string;
  subjectName: string;
  subjectCode?: string;
  subjectColor?: string;
  target: number;
  currentPercentage: number;
  canMiss: number;
  needAttend: number;
  statusText: string;
  slotType: string;
  isExtra?: boolean;
  startTime?: string;
  endTime?: string;
  status: "present" | "absent" | "off" | "not_marked" | "medical" | "od" | string;
  remarks?: string | null;
  timetableSlotId?: string;
  overrideId?: string;
  attendanceId?: string;
}

interface SubjectHeaderStats {
  id: string;
  name: string;
  code?: string;
  target: number;
  attended: number;
  total: number;
  percentage: number;
  statusText: string;
  canMiss: number;
  needAttend: number;
}

export const SubjectDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const isOverall = !id || id === "overall" || id === "all";

  const [logs, setLogs] = useState<AttendanceLogItem[]>([]);
  const [subjectsList, setSubjectsList] = useState<any[]>([]);
  const [headerStats, setHeaderStats] = useState<SubjectHeaderStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>(isOverall ? "all" : id);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");

  // Filter Dropdown Visibility
  const [showSubjectMenu, setShowSubjectMenu] = useState(false);
  const [showDateMenu, setShowDateMenu] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  // Edit Mode Toggle
  const [isEditMode, setIsEditMode] = useState(false);

  // Active Tab: Logs vs Simulator (for single subject)
  const [activeTab, setActiveTab] = useState<"logs" | "simulator">("logs");

  // Simulator state for single subject
  const [simAttended, setSimAttended] = useState(0);
  const [simMissed, setSimMissed] = useState(0);

  const fetchLogsData = async () => {
    try {
      setIsLoading(true);
      const querySubject = isOverall ? "all" : id;
      const res = await api.get(`/attendance/logs?subjectId=${querySubject}`);
      const rawLogs: AttendanceLogItem[] = res.data.logs || [];
      const subjects = res.data.subjects || [];

      setLogs(rawLogs);
      setSubjectsList(subjects);

      if (isOverall) {
        // Calculate overall header stats
        let totalAttended = 0;
        let totalClasses = 0;
        subjects.forEach((s: any) => {
          totalAttended += s.attended;
          totalClasses += s.total;
        });
        const pct = totalClasses > 0 ? (totalAttended / totalClasses) * 100 : 0;
        const user = useAuthStore.getState().user;
        // Always use user.targetAttendance as the single source of truth
        const avgTarget = user?.targetAttendance ?? 75;

        const totalCanMiss = Math.floor((totalAttended - (avgTarget / 100) * totalClasses) / (avgTarget / 100));

        setHeaderStats({
          id: "overall",
          name: "Overall",
          target: avgTarget,
          attended: totalAttended,
          total: totalClasses,
          percentage: pct,
          canMiss: totalCanMiss > 0 ? totalCanMiss : 0,
          needAttend: 0,
          statusText: totalClasses === 0
            ? "No classes recorded yet"
            : totalCanMiss > 0
            ? `can miss ${totalCanMiss} lecture${totalCanMiss > 1 ? "s" : ""}`
            : "can't miss the next lecture",
        });
      } else {
        const sub = subjects.find((s: any) => s.id === id);
        if (sub) {
          setHeaderStats({
            id: sub.id,
            name: sub.name,
            code: sub.code,
            target: useAuthStore.getState().user?.targetAttendance ?? 75,
            attended: sub.attended,
            total: sub.total,
            percentage: sub.percentage,
            canMiss: sub.canMiss,
            needAttend: sub.needAttend,
            statusText: sub.statusText,
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch attendance logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogsData();

    const handleUpdate = () => {
      fetchLogsData();
    };
    window.addEventListener("attendance-updated", handleUpdate);
    return () => window.removeEventListener("attendance-updated", handleUpdate);
  }, [id]);

  // Mark/Edit Attendance
  const handleMarkAttendance = async (
    item: AttendanceLogItem,
    newStatus: "present" | "absent" | "off" | "not_marked"
  ) => {
    // Trigger Popup Animation
    if (newStatus === "absent") {
      triggerAttendancePopup("crying", "Attendance Dropped! 😭");
    } else if (newStatus === "present") {
      const { overallPercentage } = useAttendanceStore.getState();
      const targetPct = useAuthStore.getState().user?.targetAttendance ?? 75;
      if (overallPercentage >= targetPct) {
        triggerAttendancePopup("target_hit", `Target ${targetPct}% Touched! 🎯`);
      } else {
        triggerAttendancePopup("thumbs_up", "Awesome! Marked Present 👍");
      }
    }

    // Optimistic Update
    setLogs((prev) =>
      prev.map((l) =>
        l.id === item.id || (l.date === item.date && l.subjectId === item.subjectId && l.timetableSlotId === item.timetableSlotId && l.overrideId === item.overrideId)
          ? { ...l, status: newStatus }
          : l
      )
    );

    try {
      await api.post("/attendance/mark", {
        subjectId: item.subjectId,
        date: item.date,
        status: newStatus,
        timetableSlotId: item.timetableSlotId,
        overrideId: item.overrideId,
      });

      window.dispatchEvent(new Event("attendance-updated"));
    } catch (error) {
      console.error("Failed to update attendance:", error);
      fetchLogsData();
    }
  };

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    // Subject filter
    if (selectedSubjectFilter !== "all" && log.subjectId !== selectedSubjectFilter) {
      return false;
    }
    // Status filter
    if (selectedStatusFilter !== "all") {
      if (selectedStatusFilter === "attended" && log.status !== "present" && log.status !== "medical" && log.status !== "od") return false;
      if (selectedStatusFilter === "missed" && log.status !== "absent") return false;
      if (selectedStatusFilter === "off" && log.status !== "off" && log.status !== "cancelled") return false;
      if (selectedStatusFilter === "not_marked" && log.status !== "not_marked") return false;
    }
    // Date filter
    if (selectedDateFilter === "7days") {
      const now = Date.now();
      const diffDays = (now - log.timestamp) / (1000 * 60 * 60 * 24);
      if (diffDays > 7) return false;
    } else if (selectedDateFilter === "30days") {
      const now = Date.now();
      const diffDays = (now - log.timestamp) / (1000 * 60 * 60 * 24);
      if (diffDays > 30) return false;
    }

    return true;
  });

  // Group filtered logs by dateFormatted
  const groupedByDate: Record<string, AttendanceLogItem[]> = {};
  filteredLogs.forEach((log) => {
    if (!groupedByDate[log.dateFormatted]) {
      groupedByDate[log.dateFormatted] = [];
    }
    groupedByDate[log.dateFormatted].push(log);
  });

  if (isLoading && logs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const pct = headerStats ? headerStats.percentage : 0;
  const targetPct = headerStats ? headerStats.target : (useAuthStore.getState().user?.targetAttendance ?? 75);

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      {/* Top Header matching dark screenshot theme */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/subjects"
              className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            {/* Fraction Badge e.g. 80.00 / 75 */}
            <div className="flex flex-col items-center justify-center border-b-2 border-foreground/30 px-2 py-0.5 min-w-[54px]">
              <span className="text-sm font-bold text-foreground leading-none">
                {pct.toFixed(2)}
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground leading-none border-t border-border mt-0.5 pt-0.5 w-full text-center">
                {targetPct}
              </span>
            </div>

            {/* Subject Title & Subtitle */}
            <div>
              <h1 className="text-base font-bold text-foreground leading-tight">
                {headerStats?.name || (isOverall ? "Overall" : "Subject")}
              </h1>
              <p className="text-xs text-emerald-500 font-medium">
                {headerStats?.statusText || "can miss 0 lectures"}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setShowStatusMenu(!showStatusMenu);
            }}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Filter options"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-4 space-y-4">
        {/* Toggle between Logs & Simulator for single subject */}
        {!isOverall && (
          <div className="flex bg-muted/50 p-1 rounded-2xl border border-border">
            <button
              onClick={() => setActiveTab("logs")}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === "logs"
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Attendance Logs
            </button>
            <button
              onClick={() => setActiveTab("simulator")}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === "simulator"
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Attendance Simulator
            </button>
          </div>
        )}

        {activeTab === "logs" ? (
          <>
            {/* Filter Pills Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
              {/* Total Records Pill */}
              <span className="bg-emerald-900/30 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-xl font-medium shrink-0">
                {filteredLogs.length} record{filteredLogs.length !== 1 ? "s" : ""}
              </span>

              {/* Date Filter Pill */}
              <div className="relative shrink-0">
                <button
                  onClick={() => {
                    setShowDateMenu(!showDateMenu);
                    setShowSubjectMenu(false);
                    setShowStatusMenu(false);
                  }}
                  className="bg-muted/60 border border-border hover:border-foreground/20 text-foreground px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 transition-colors"
                >
                  <span>
                    {selectedDateFilter === "all"
                      ? "All dates"
                      : selectedDateFilter === "7days"
                      ? "Last 7 days"
                      : "Last 30 days"}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>

                {showDateMenu && (
                  <div className="absolute top-full left-0 mt-1.5 w-36 bg-card border border-border rounded-2xl shadow-xl z-40 p-1 space-y-0.5">
                    {[
                      { id: "all", label: "All dates" },
                      { id: "7days", label: "Last 7 days" },
                      { id: "30days", label: "Last 30 days" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setSelectedDateFilter(opt.id);
                          setShowDateMenu(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                          selectedDateFilter === opt.id
                            ? "bg-primary/20 text-primary"
                            : "hover:bg-muted text-foreground"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Subject Filter Pill (if overall) */}
              {isOverall && (
                <div className="relative shrink-0">
                  <button
                    onClick={() => {
                      setShowSubjectMenu(!showSubjectMenu);
                      setShowDateMenu(false);
                      setShowStatusMenu(false);
                    }}
                    className="bg-muted/60 border border-border hover:border-foreground/20 text-foreground px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <span>
                      {selectedSubjectFilter === "all"
                        ? "All subjects"
                        : subjectsList.find((s) => s.id === selectedSubjectFilter)?.name || "Subject"}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>

                  {showSubjectMenu && (
                    <div className="absolute top-full left-0 mt-1.5 w-44 bg-card border border-border rounded-2xl shadow-xl z-40 p-1 space-y-0.5 max-h-48 overflow-y-auto">
                      <button
                        onClick={() => {
                          setSelectedSubjectFilter("all");
                          setShowSubjectMenu(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                          selectedSubjectFilter === "all"
                            ? "bg-primary/20 text-primary"
                            : "hover:bg-muted text-foreground"
                        }`}
                      >
                        All subjects
                      </button>
                      {subjectsList.map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => {
                            setSelectedSubjectFilter(sub.id);
                            setShowSubjectMenu(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors truncate ${
                            selectedSubjectFilter === sub.id
                              ? "bg-primary/20 text-primary"
                              : "hover:bg-muted text-foreground"
                          }`}
                        >
                          {sub.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Status Filter Pill */}
              <div className="relative shrink-0">
                <button
                  onClick={() => {
                    setShowStatusMenu(!showStatusMenu);
                    setShowDateMenu(false);
                    setShowSubjectMenu(false);
                  }}
                  className="bg-muted/60 border border-border hover:border-foreground/20 text-foreground px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 transition-colors"
                >
                  <span className="capitalize">
                    {selectedStatusFilter === "all"
                      ? "All attendance"
                      : selectedStatusFilter.replace("_", " ")}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>

                {showStatusMenu && (
                  <div className="absolute top-full right-0 mt-1.5 w-36 bg-card border border-border rounded-2xl shadow-xl z-40 p-1 space-y-0.5">
                    {[
                      { id: "all", label: "All attendance" },
                      { id: "attended", label: "Attended" },
                      { id: "missed", label: "Missed" },
                      { id: "off", label: "Off" },
                      { id: "not_marked", label: "Not Marked" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setSelectedStatusFilter(opt.id);
                          setShowStatusMenu(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                          selectedStatusFilter === opt.id
                            ? "bg-primary/20 text-primary"
                            : "hover:bg-muted text-foreground"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Attendance Timeline grouped by Date */}
            {Object.keys(groupedByDate).length === 0 ? (
              <div className="text-center py-12 bg-card border border-border rounded-3xl p-6">
                <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                <h3 className="text-sm font-bold text-foreground">No Attendance Logs Found</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Try adjusting your filter options or mark attendance from the Today page.
                </p>
              </div>
            ) : (
              <div className="space-y-6 pt-2">
                {Object.entries(groupedByDate).map(([dateLabel, items]) => (
                  <div key={dateLabel} className="space-y-2">
                    {/* Date Section Header */}
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                      {dateLabel}
                    </h3>

                    {/* Class Cards for this date */}
                    <div className="space-y-3">
                      {items.map((item) => {
                        const isAttended =
                          item.status === "present" ||
                          item.status === "medical" ||
                          item.status === "od";
                        const isMissed = item.status === "absent";
                        const isOff = item.status === "off" || item.status === "cancelled";
                        const isNotMarked = !item.status || item.status === "not_marked";

                        return (
                          <div
                            key={item.id}
                            className="bg-card/90 border border-border/80 hover:border-border rounded-2xl p-4 shadow-sm transition-all relative overflow-hidden"
                          >
                            {/* Color accent line */}
                            <div
                              className="absolute top-0 left-0 w-1 h-full rounded-l-2xl"
                              style={{ backgroundColor: item.subjectColor || "#8b5cf6" }}
                            />

                            <div className="pl-2 space-y-3">
                              {/* If overall view: show Subject Mini Card Header */}
                              {isOverall && (
                                <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-2.5">
                                  <div className="flex items-center gap-3">
                                    {/* Subject badge e.g. 90.00 / 75 */}
                                    <div className="flex flex-col items-center justify-center bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-2 py-1 min-w-[50px]">
                                      <span className="text-xs font-bold text-emerald-500 leading-none">
                                        {item.currentPercentage.toFixed(2)}
                                      </span>
                                      <div className="w-full h-px bg-emerald-500/20 my-0.5" />
                                      <span className="text-[9px] font-semibold text-emerald-400 leading-none">
                                        {item.target}
                                      </span>
                                    </div>

                                    <div>
                                      <h4 className="text-sm font-bold text-foreground leading-tight">
                                        {item.subjectName}
                                      </h4>
                                      <p className="text-[11px] text-emerald-500 font-medium">
                                        {item.statusText}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Slot Line & Attendance Actions */}
                              <div className="flex items-center justify-between gap-3 pt-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-sm font-semibold ${item.isExtra || item.slotType === "Extra" ? "text-amber-400 font-bold" : "text-emerald-400"}`}>
                                    {item.slotType}
                                  </span>
                                  {(item.isExtra || item.slotType === "Extra") && (
                                    <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
                                      <Sparkles className="w-3 h-3 text-amber-400" />
                                      Extra Lecture
                                    </span>
                                  )}
                                  {item.startTime && item.startTime !== "00:00" && (
                                    <span className="text-xs text-muted-foreground font-mono">
                                      ({item.startTime} - {item.endTime})
                                    </span>
                                  )}
                                </div>

                                {/* Attendance Status Controls */}
                                {isEditMode ? (
                                  /* 4 Quick Action Icons in Edit Mode */
                                  <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-full border border-border">
                                    {/* Off 🚫 */}
                                    <button
                                      onClick={() => handleMarkAttendance(item, "off")}
                                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                                        isOff
                                          ? "bg-amber-500 text-white shadow-sm"
                                          : "text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"
                                      }`}
                                      title="Mark Off"
                                    >
                                      <Ban className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Clear / Not Marked ➖ */}
                                    <button
                                      onClick={() => handleMarkAttendance(item, "not_marked")}
                                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                                        isNotMarked
                                          ? "bg-muted-foreground text-background shadow-sm"
                                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                      }`}
                                      title="Clear Attendance"
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Missed / Absent ✕ */}
                                    <button
                                      onClick={() => handleMarkAttendance(item, "absent")}
                                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                                        isMissed
                                          ? "bg-rose-500 text-white shadow-sm"
                                          : "text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                                      }`}
                                      title="Mark Missed"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Attended / Present ✓ */}
                                    <button
                                      onClick={() => handleMarkAttendance(item, "present")}
                                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                                        isAttended
                                          ? "bg-emerald-500 text-white shadow-sm"
                                          : "text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10"
                                      }`}
                                      title="Mark Attended"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  /* Static / Tap Status Badge in View Mode */
                                  <button
                                    onClick={() => {
                                      // Cycle status on tap or enter edit mode
                                      const nextStatus = isAttended
                                        ? "absent"
                                        : isMissed
                                        ? "off"
                                        : isOff
                                        ? "not_marked"
                                        : "present";
                                      handleMarkAttendance(item, nextStatus as any);
                                    }}
                                    className={`px-3 py-1.5 rounded-2xl text-xs font-bold border flex items-center gap-1.5 transition-all shadow-sm ${
                                      isAttended
                                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                                        : isMissed
                                        ? "border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                                        : isOff
                                        ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                                        : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                                    }`}
                                  >
                                    <span>
                                      {isAttended
                                        ? "Attended"
                                        : isMissed
                                        ? "Missed"
                                        : isOff
                                        ? "Off"
                                        : "Not Marked"}
                                    </span>
                                    {isAttended && <CheckCircle2 className="w-3.5 h-3.5" />}
                                    {isMissed && <XCircle className="w-3.5 h-3.5" />}
                                    {isOff && <Ban className="w-3.5 h-3.5" />}
                                    {isNotMarked && <Minus className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </div>
                              
                              {/* Log Remarks Context */}
                              {item.remarks && (
                                <div className="mt-1 bg-muted/40 border border-border/60 rounded-xl px-3 py-2 flex items-start gap-2">
                                  <span className="text-[10px] uppercase font-bold text-muted-foreground shrink-0 mt-0.5 opacity-70">
                                    Remark:
                                  </span>
                                  <span className="text-xs text-foreground/80 leading-relaxed italic">
                                    {item.remarks}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Attendance What-If Simulator for single subject */
          <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Attendance Simulator</h2>
                <p className="text-xs text-muted-foreground">
                  Project attendance to the end of the semester.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <label className="text-xs font-semibold text-emerald-500">
                        Classes to ATTEND
                      </label>
                      <span className="text-base font-bold text-foreground">{simAttended}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      value={simAttended}
                      onChange={(e) => setSimAttended(Number(e.target.value))}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <label className="text-xs font-semibold text-rose-500">
                        Classes to MISS
                      </label>
                      <span className="text-base font-bold text-foreground">{simMissed}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      value={simMissed}
                      onChange={(e) => setSimMissed(Number(e.target.value))}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-rose-500"
                    />
                  </div>
                </div>
              </div>

              {/* Simulation Result */}
              {headerStats && (() => {
                const projAtt = headerStats.attended + simAttended;
                const projTot = headerStats.total + simAttended + simMissed;
                const projPct = projTot > 0 ? (projAtt / projTot) * 100 : 0;
                const isSafe = projPct >= headerStats.target;

                return (
                  <div className="flex flex-col items-center justify-center p-6 bg-muted/30 border border-border rounded-2xl">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      Projected Percentage
                    </span>
                    <span
                      className={`text-4xl font-extrabold ${
                        isSafe ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      {projPct.toFixed(1)}%
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                      Target: {headerStats.target}%
                    </span>

                    <div className="mt-4">
                      {isSafe ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          <ShieldCheck className="w-3.5 h-3.5" /> On Track
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                          <AlertTriangle className="w-3.5 h-3.5" /> Below Target
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Floating Bottom Pill Button: [ ✏️ Edit Attendance ] */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <button
          onClick={() => setIsEditMode(!isEditMode)}
          className={`flex items-center gap-2.5 px-6 py-3 rounded-full text-sm font-bold shadow-xl border transition-all transform active:scale-95 ${
            isEditMode
              ? "bg-primary text-primary-foreground border-primary shadow-primary/20"
              : "bg-emerald-950/80 text-emerald-300 border-emerald-500/30 backdrop-blur-md hover:bg-emerald-900/90"
          }`}
        >
          {isEditMode ? (
            <>
              <Eye className="w-4 h-4" />
              <span>Done Editing</span>
            </>
          ) : (
            <>
              <Pencil className="w-4 h-4" />
              <span>Edit Attendance</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
