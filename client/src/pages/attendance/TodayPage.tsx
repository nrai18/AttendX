import React, { useState, useEffect } from "react";
import { Loader2, CheckCircle2, XCircle, AlertCircle, PartyPopper, BookOpen, Palmtree, Timer, TrendingUp, TrendingDown, Plus, MessageSquare, Sparkles, ChevronRight, X } from "lucide-react";
import { api } from "../../lib/api";
import { CreateSemesterModal } from "../../components/semester/CreateSemesterModal";

import { useSearchParams, useNavigate } from "react-router-dom";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { triggerAttendancePopup } from "../../stores/animationPopupStore";

interface AgendaItem {
  id: string;
  type: "slot" | "override";
  isExtra?: boolean;
  subject: {
    id: string;
    name: string;
    code?: string;
    colorHex?: string;
  };
  startTime: string;
  endTime: string;
  room?: string;
  slotType: string;
  status: "present" | "absent" | "off" | "cancelled" | "medical" | "od" | null;
  remarks?: string | null;
  attendanceId: string | null;
}

export const TodayPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get("date");
  const targetDateStr = dateParam || new Date().toISOString().split("T")[0];
  
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [todayStatus, setTodayStatus] = useState<any>(null);
  const [activeSemester, setActiveSemester] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateSemesterOpen, setIsCreateSemesterOpen] = useState(false);

  // Extra Lecture Modal State
  const [isAddExtraModalOpen, setIsAddExtraModalOpen] = useState(false);
  const [subjectsForExtra, setSubjectsForExtra] = useState<any[]>([]);
  const [isAddingExtra, setIsAddingExtra] = useState(false);

  // Remark Modal / Prompt State
  const [selectedRemarkItem, setSelectedRemarkItem] = useState<{ item: AgendaItem; status: string } | null>(null);
  const [remarkInput, setRemarkInput] = useState("");

  const [isMarkingFullDayOff, setIsMarkingFullDayOff] = useState(false);

  const fetchStats = useAttendanceStore((state) => state.fetchStats);
  const { overallPercentage, targetPercentage } = useAttendanceStore();

  const handleMarkFullDayOff = async () => {
    if (agenda.length === 0) return;
    try {
      setIsMarkingFullDayOff(true);
      // Optimistically mark all agenda items as "off"
      setAgenda(prev => prev.map(a => ({ ...a, status: "off" as any })));

      // Trigger full day off celebration popup animation!
      triggerAttendancePopup("full_day_off", "Congratulations on a full day off! 🥳🎉");

      // Save all to backend
      await Promise.all(
        agenda.map(item =>
          api.post("/attendance/mark", {
            subjectId: item.subject.id,
            date: targetDateStr,
            status: "off",
            timetableSlotId: item.type === "slot" ? item.id : undefined,
            overrideId: item.type === "override" ? item.id : undefined,
          })
        )
      );

      fetchStats();
      window.dispatchEvent(new Event("attendance-updated"));
    } catch (error) {
      console.error("Failed to mark full day off:", error);
      fetchData();
    } finally {
      setIsMarkingFullDayOff(false);
    }
  };

  const openAddExtraModal = async () => {
    try {
      const res = await api.get("/subjects");
      setSubjectsForExtra(res.data || []);
      setIsAddExtraModalOpen(true);
    } catch (err) {
      console.error("Failed to load subjects:", err);
    }
  };

  const handleAddExtraLecture = async (subjectId: string) => {
    try {
      setIsAddingExtra(true);
      await api.post("/timetable/extra-class", {
        subjectId,
        date: targetDateStr,
        startTime: "00:00",
        endTime: "00:00",
        reason: "Extra Lecture"
      });
      setIsAddExtraModalOpen(false);
      fetchData();
      fetchStats();
      window.dispatchEvent(new Event("attendance-updated"));
    } catch (err) {
      console.error("Failed to add extra lecture:", err);
    } finally {
      setIsAddingExtra(false);
    }
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      // Fetch active semester first
      const semRes = await api.get("/semesters/active");
      if (semRes.data) {
        setActiveSemester(semRes.data);
        const semesterId = semRes.data.id;
        // Fetch today status based on active semester
        const statusRes = await api.get(`/events/today-status?semesterId=${semesterId}&date=${targetDateStr}`);
        setTodayStatus(statusRes.data);
      } else {
        setActiveSemester(null);
      }

      const res = await api.get(`/attendance/today?date=${targetDateStr}`);
      setAgenda(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Failed to fetch today data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleUpdate = () => {
      fetchData();
      fetchStats();
    };
    window.addEventListener("attendance-updated", handleUpdate);
    return () => window.removeEventListener("attendance-updated", handleUpdate);
  }, [targetDateStr]);

  const markAttendance = async (item: AgendaItem, status: string, remarks?: string) => {
    const updatedAgenda = agenda.map(a => 
      a.id === item.id ? { ...a, status: status as any, remarks: remarks || a.remarks } : a
    );
    setAgenda(updatedAgenda);

    // Trigger Popup Animation
    if (status === "absent") {
      triggerAttendancePopup("crying", "Attendance Dropped! 😭");
    } else if (status === "present" || status === "medical" || status === "od") {
      const { overallPercentage, targetPercentage } = useAttendanceStore.getState();
      if (overallPercentage >= (targetPercentage || 75)) {
        triggerAttendancePopup("target_hit", `Target ${targetPercentage || 75}% Touched! 🎯`);
      } else {
        triggerAttendancePopup("thumbs_up", "Awesome! Marked Present 👍");
      }
    } else if (status === "off" || status === "cancelled") {
      const allOthersOff = updatedAgenda.every(a => a.status === "off" || a.status === "cancelled");
      if (allOthersOff && updatedAgenda.length > 0) {
        triggerAttendancePopup("full_day_off", "Congratulations on a full day off! 🥳🎉");
      } else {
        triggerAttendancePopup("off_class", "Yay! Off class today! 💃🕺");
      }
    }

    try {
      await api.post("/attendance/mark", {
        subjectId: item.subject.id,
        date: targetDateStr,
        status,
        remarks,
        timetableSlotId: item.type === "slot" ? item.id : undefined,
        overrideId: item.type === "override" ? item.id : undefined,
      });
      fetchStats();
      window.dispatchEvent(new Event("attendance-updated"));
    } catch (error) {
      console.error("Failed to mark attendance:", error);
      fetchData();
    }
  };

  const handleStatusClick = (item: AgendaItem, status: string) => {
    if (status === "absent") {
      setSelectedRemarkItem({ item, status });
      setRemarkInput(item.remarks || "");
    } else {
      markAttendance(item, status);
    }
  };

  const handleSaveRemark = () => {
    if (!selectedRemarkItem) return;
    markAttendance(selectedRemarkItem.item, selectedRemarkItem.status, remarkInput.trim() || undefined);
    setSelectedRemarkItem(null);
    setRemarkInput("");
  };

  const pendingCount = agenda.filter(a => a.status === null).length;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Determine if we should show the holiday/exam state instead of classes
  const activeEvent = todayStatus?.activeEvent;
  const isGlobalEventActive = activeEvent && ["holiday", "vacation", "fest", "midsem", "endsem", "institute"].includes(activeEvent.eventType);

  const getEventStateConfig = (type: string) => {
    switch(type) {
      case "midsem":
      case "endsem":
        return { icon: <BookOpen className="w-16 h-16 text-rose-500 mb-4 mx-auto" />, color: "border-rose-500/20 bg-rose-500/5", title: "Exam Mode", msg: "Focus on your exams. No regular classes today." };
      case "fest":
      case "institute":
        return { icon: <PartyPopper className="w-16 h-16 text-purple-500 mb-4 mx-auto" />, color: "border-purple-500/20 bg-purple-500/5", title: "Festivities", msg: "Enjoy the celebrations! Classes are suspended." };
      case "vacation":
        return { icon: <Palmtree className="w-16 h-16 text-emerald-500 mb-4 mx-auto" />, color: "border-emerald-500/20 bg-emerald-500/5", title: "Vacation", msg: "You're officially on vacation. Recharge and relax!" };
      case "holiday":
      default:
        return { icon: <Palmtree className="w-16 h-16 text-emerald-500 mb-4 mx-auto" />, color: "border-emerald-500/20 bg-emerald-500/5", title: "Holiday", msg: "Enjoy your day off!" };
    }
  };

  const displayDate = new Date(targetDateStr);
  const userTimezoneOffset = displayDate.getTimezoneOffset() * 60000;
  const adjustedDate = new Date(displayDate.getTime() + userTimezoneOffset);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto w-full pb-24 md:pb-8">
      
      {todayStatus?.nextEvent && !activeEvent && (
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Timer className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-foreground">Upcoming: <span className="font-bold">{todayStatus.nextEvent.title}</span></span>
          </div>
          <span className="text-xs font-bold bg-primary/20 text-primary px-3 py-1 rounded-full uppercase tracking-wider">
            {new Date(todayStatus.nextEvent.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      )}

      {/* Overall Attendance & Predictive Forecast Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className={`rounded-2xl border p-4 flex items-center justify-between gap-4 transition-colors ${
          overallPercentage >= targetPercentage
            ? "bg-emerald-500/10 border-emerald-500/20"
            : "bg-rose-500/10 border-rose-500/20"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              overallPercentage >= targetPercentage ? "bg-emerald-500/20" : "bg-rose-500/20"
            }`}>
              {overallPercentage >= targetPercentage
                ? <TrendingUp className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                : <TrendingDown className="w-5 h-5 text-rose-500 dark:text-rose-400" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Overall Attendance</p>
              <p className={`text-xs mt-0.5 font-medium ${
                overallPercentage >= targetPercentage ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              }`}>
                {overallPercentage >= targetPercentage
                  ? `${((overallPercentage ?? 0) - (targetPercentage ?? 75)).toFixed(1)}% above target (${targetPercentage}%)`
                  : `${((targetPercentage ?? 75) - (overallPercentage ?? 0)).toFixed(1)}% below target (${targetPercentage}%)`}
              </p>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-mono font-bold text-sm ${
            overallPercentage >= targetPercentage
              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
              : "bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30"
          }`}>
            <span>{(overallPercentage ?? 0).toFixed(2)}%</span>
          </div>
        </div>

        {/* Predictive AI Quick Access Card */}
        <div 
          onClick={() => navigate("/predictive")}
          className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-card to-card p-4 flex items-center justify-between gap-3 cursor-pointer hover:border-primary/60 transition-all group shadow-sm"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-foreground truncate">Predictive Engine</p>
                <span className="text-[10px] font-extrabold text-primary bg-primary/20 px-1.5 py-0.2 rounded uppercase">Forecast</span>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                Calculate consecutive classes needed for {targetPercentage}% target
              </p>
            </div>
          </div>
          <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all shrink-0">
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{dateParam ? "Classes on" : "Today's Schedule"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {adjustedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {activeSemester && agenda.length > 0 && (
            <button
              onClick={handleMarkFullDayOff}
              disabled={isMarkingFullDayOff}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              title="Mark all today's classes as Off"
            >
              <Palmtree className="w-4 h-4 text-amber-500" />
              <span>{isMarkingFullDayOff ? "Marking..." : "Mark Full Day Off"}</span>
            </button>
          )}
          {activeSemester && (
            <button
              onClick={openAddExtraModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md shadow-primary/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Extra Lecture</span>
            </button>
          )}
          <div className="text-right ml-2">
            <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending</p>
          </div>
        </div>
      </div>

      {/* Event Highlight Banner (Exams, Yalgaar, Fests, Holidays) */}
      {activeEvent && (
        <div className={`p-4 rounded-2xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
          ["midsem", "endsem", "exam"].includes((activeEvent.eventType || "").toLowerCase())
            ? "bg-rose-500/10 border-rose-500/30"
            : ["fest", "institute", "yalgaar"].includes((activeEvent.eventType || "").toLowerCase())
            ? "bg-purple-500/10 border-purple-500/30"
            : "bg-amber-500/10 border-amber-500/30"
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center text-xl shadow-xs shrink-0">
              {["midsem", "endsem", "exam"].includes((activeEvent.eventType || "").toLowerCase()) ? "📝" : "🎉"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-card border border-border text-foreground">
                  {activeEvent.eventType || "Special"} Event
                </span>
                <span className="text-xs font-semibold text-primary">Today</span>
              </div>
              <h3 className="text-base font-extrabold text-foreground mt-0.5">{activeEvent.title}</h3>
            </div>
          </div>
          <div className="text-xs font-medium text-muted-foreground">
            📌 Event highlighted for today. Use <span className="font-bold text-foreground">Mark Full Day Off</span> if classes are suspended.
          </div>
        </div>
      )}

      {!activeSemester ? (
        <div className="text-center py-12 bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
          <BookOpen className="w-12 h-12 text-primary mx-auto opacity-80" />
          <h3 className="text-lg font-bold text-foreground">No Active Semester</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Please create and activate a semester to manage your timetable, subjects, and daily class attendance.
          </p>
          <button
            onClick={() => setIsCreateSemesterOpen(true)}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-primary/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Active Semester</span>
          </button>
        </div>
      ) : agenda.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-2xl shadow-sm">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4 opacity-80" />
          <h3 className="text-lg font-medium text-foreground mb-2">No classes scheduled today!</h3>
          <p className="text-muted-foreground max-w-sm mx-auto text-sm">
            Enjoy your day off or catch up on assignments and self-study.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {agenda.map(item => (
            <div 
              key={item.id} 
              className={`p-4 md:p-5 rounded-2xl border transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                item.status 
                  ? "bg-card/60 border-border/60 opacity-90" 
                  : "bg-card border-border shadow-sm hover:shadow-md"
              }`}
            >
              <div className="flex items-center gap-4">
                <div 
                  className="w-1.5 h-14 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: item.subject?.colorHex || "#6366f1" }} 
                />
                <div>
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 flex-wrap">
                    <span>{item.subject?.name || "Unknown Subject"}</span>
                    {(item.isExtra || item.type === "override" || item.slotType === "Extra") && (
                      <span className="bg-amber-500/20 text-amber-500 border border-amber-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        Extra
                      </span>
                    )}
                    {item.remarks && (
                      <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-md flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-primary" />
                        {item.remarks}
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground font-medium">
                    <span className="bg-muted px-2 py-0.5 rounded text-foreground font-mono">{item.startTime} - {item.endTime}</span>
                    <span className="uppercase tracking-wide font-semibold">{item.slotType}</span>
                    {item.room && <span>• Room {item.room}</span>}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-end md:self-auto">
                <button
                  onClick={() => handleStatusClick(item, "present")}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    item.status === "present"
                      ? "bg-emerald-500 text-white font-bold shadow-md shadow-emerald-500/20"
                      : "bg-muted text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Attended
                </button>
                <button
                  onClick={() => handleStatusClick(item, "absent")}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    item.status === "absent"
                      ? "bg-rose-500 text-white font-bold shadow-md shadow-rose-500/20"
                      : "bg-muted text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Missed
                </button>
                <button
                  onClick={() => handleStatusClick(item, "off")}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    item.status === "off"
                      ? "bg-amber-500 text-white font-bold shadow-md shadow-amber-500/20"
                      : "bg-muted text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400"
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  Off
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Contextual Remark Modal */}
      {selectedRemarkItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Log Contextual Remark
            </h3>
            <p className="text-xs text-muted-foreground">
              Logging status <span className="font-bold uppercase text-primary">{selectedRemarkItem.status}</span> for <span className="font-semibold text-foreground">{selectedRemarkItem.item.subject.name}</span>. Add an optional remark (e.g., "Medical Leave", "OD for Techfest").
            </p>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Remark / Reason</label>
              <input
                type="text"
                placeholder="e.g. Medical, Event, Fever, Travel..."
                value={remarkInput}
                onChange={(e) => setRemarkInput(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {["Medical", "Event", "Fever", "College OD", "Personal"].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setRemarkInput(tag)}
                    className="px-2.5 py-1 rounded-lg text-xs bg-muted hover:bg-primary/20 hover:text-primary transition-colors text-muted-foreground font-medium cursor-pointer"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedRemarkItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRemark}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
              >
                Save Attendance Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Extra Lecture Modal */}
      {isAddExtraModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-card border border-border/80 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-extrabold text-foreground tracking-tight">
                Add extra lecture
              </h3>
              <button
                onClick={() => setIsAddExtraModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1 no-scrollbar">
              {subjectsForExtra.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No subjects found for active semester.
                </div>
              ) : (
                subjectsForExtra.map((sub) => (
                  <button
                    key={sub.id}
                    disabled={isAddingExtra}
                    onClick={() => handleAddExtraLecture(sub.id)}
                    className="w-full text-left p-4 rounded-2xl bg-muted/30 hover:bg-muted/70 border border-border/40 hover:border-primary/40 transition-all font-semibold text-foreground text-sm flex items-center justify-between group cursor-pointer"
                  >
                    <span>{sub.name}</span>
                    <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <CreateSemesterModal
        isOpen={isCreateSemesterOpen}
        onClose={() => setIsCreateSemesterOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  );
};
