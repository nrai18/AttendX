import React, { useState, useEffect } from "react";
import { Loader2, CheckCircle2, XCircle, AlertCircle, PartyPopper, BookOpen, Palmtree, Timer, CalendarPlus } from "lucide-react";
import { api } from "../../lib/api";

import { useSearchParams } from "react-router-dom";
import { useAttendanceStore } from "../../stores/attendanceStore";

interface AgendaItem {
  id: string;
  type: "slot" | "override";
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
  attendanceId: string | null;
}

export const TodayPage = () => {
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get("date");
  const targetDateStr = dateParam || new Date().toISOString().split("T")[0];
  
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [todayStatus, setTodayStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [subjects, setSubjects] = useState<any[]>([]);
  const [activeSemester, setActiveSemester] = useState<any>(null);
  
  // Extra Class Form State
  const [isAddingExtra, setIsAddingExtra] = useState(false);
  const [extraSubjectId, setExtraSubjectId] = useState("");
  const [extraStartTime, setExtraStartTime] = useState("17:30");
  const [extraEndTime, setExtraEndTime] = useState("18:20");

  const fetchStats = useAttendanceStore((state) => state.fetchStats);

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
      }

      const [res, subjRes] = await Promise.all([
        api.get(`/attendance/today?date=${targetDateStr}`),
        api.get("/subjects")
      ]);
      setAgenda(res.data);
      
      if (semRes.data) {
        setSubjects(subjRes.data.filter((s: any) => s.semesterId === semRes.data.id));
      }
    } catch (error) {
      console.error("Failed to fetch today data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [targetDateStr]);

  const handleAddExtraClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraSubjectId || !activeSemester) return alert("Please select a subject.");
    try {
      await api.post("/timetable/extra-class", {
        semesterId: activeSemester.id,
        subjectId: extraSubjectId,
        date: targetDateStr,
        startTime: extraStartTime, 
        endTime: extraEndTime,
        reason: "Ad-hoc extra class"
      });
      setIsAddingExtra(false);
      alert("Extra class added successfully!");
      fetchData(); // refresh the agenda
    } catch (error) {
      console.error("Failed to add extra class:", error);
    }
  };

  const markAttendance = async (item: AgendaItem, status: string) => {
    const updatedAgenda = agenda.map(a => 
      a.id === item.id ? { ...a, status: status as any } : a
    );
    setAgenda(updatedAgenda);

    try {
      await api.post("/attendance/mark", {
        subjectId: item.subject.id,
        date: targetDateStr,
        status,
        timetableSlotId: item.type === "slot" ? item.id : undefined,
        overrideId: item.type === "override" ? item.id : undefined,
      });
      fetchStats();
    } catch (error) {
      console.error("Failed to mark attendance:", error);
      fetchData();
    }
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
  // Fix timezone issue when displaying date created from YYYY-MM-DD
  const userTimezoneOffset = displayDate.getTimezoneOffset() * 60000;
  const adjustedDate = new Date(displayDate.getTime() + userTimezoneOffset);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto w-full pb-24 md:pb-8">
      
      {todayStatus?.nextEvent && !activeEvent && (
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Timer className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-white">Upcoming: <span className="font-bold">{todayStatus.nextEvent.title}</span></span>
          </div>
          <span className="text-xs font-bold bg-primary/20 text-primary px-3 py-1 rounded-full uppercase tracking-wider">
            {new Date(todayStatus.nextEvent.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      )}

      <div className="flex justify-between items-start md:items-end flex-col md:flex-row gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{dateParam ? "Classes on" : "Today's Classes"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {adjustedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsAddingExtra(!isAddingExtra)}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <CalendarPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Extra Class</span>
          </button>
          {!isGlobalEventActive && (
            <div className="text-right">
              <p className="text-2xl font-bold text-white leading-none">{pendingCount}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">Pending</p>
            </div>
          )}
        </div>
      </div>

      {isAddingExtra && (
        <form onSubmit={handleAddExtraClass} className="bg-[#1a1b23] border border-white/10 rounded-2xl p-5 space-y-4 animate-in slide-in-from-top-4 duration-300">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><CalendarPlus className="w-5 h-5 text-indigo-400" /> Schedule Extra Class</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subject</label>
              <select
                required
                value={extraSubjectId}
                onChange={(e) => setExtraSubjectId(e.target.value)}
                className="w-full bg-[#13151a] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow appearance-none"
              >
                <option value="">Select a subject...</option>
                {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Start Time</label>
              <input
                type="time"
                required
                value={extraStartTime}
                onChange={(e) => setExtraStartTime(e.target.value)}
                className="w-full bg-[#13151a] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">End Time</label>
              <input
                type="time"
                required
                value={extraEndTime}
                onChange={(e) => setExtraEndTime(e.target.value)}
                className="w-full bg-[#13151a] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setIsAddingExtra(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-white transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-lg text-sm font-bold bg-indigo-500 text-white hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-500/20">Schedule</button>
          </div>
        </form>
      )}

      {isGlobalEventActive ? (
        <div className={`text-center py-16 border rounded-3xl shadow-2xl ${getEventStateConfig(activeEvent.eventType).color}`}>
          {getEventStateConfig(activeEvent.eventType).icon}
          <h2 className="text-2xl font-bold text-white mb-2">{activeEvent.title}</h2>
          <p className="text-muted-foreground max-w-sm mx-auto">
            {getEventStateConfig(activeEvent.eventType).msg}
          </p>
        </div>
      ) : agenda.length === 0 ? (
        <div className="text-center py-12 bg-[#0c0d12] border border-white/5 rounded-2xl">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-white mb-2">No classes today!</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Enjoy your day off or use this time to catch up on assignments.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {agenda.map(item => (
            <div 
              key={item.id} 
              className={`p-4 md:p-5 rounded-2xl border transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                item.status 
                  ? "bg-[#050508] border-white/5 opacity-70" 
                  : "bg-[#0c0d12] border-white/10 hover:border-white/20 shadow-lg shadow-black/20"
              }`}
            >
              <div className="flex items-center gap-4">
                <div 
                  className="w-1.5 h-14 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: item.subject?.colorHex || "#8b5cf6" }} 
                />
                <div>
                  <h3 className="text-lg font-semibold text-white">{item.subject?.name || "Unknown Subject"}</h3>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground font-medium">
                    <span className="bg-white/5 px-2 py-0.5 rounded text-white/80">{item.startTime} - {item.endTime}</span>
                    <span className="uppercase tracking-wide">{item.slotType}</span>
                    {item.room && <span>• {item.room}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 md:gap-3 self-end md:self-auto">
                <button
                  onClick={() => markAttendance(item, "present")}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    item.status === "present"
                      ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50"
                      : "bg-white/5 text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-400"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Att
                </button>
                <button
                  onClick={() => markAttendance(item, "absent")}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    item.status === "absent"
                      ? "bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/50"
                      : "bg-white/5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-400"
                  }`}
                >
                  <XCircle className="w-4 h-4" />
                  Miss
                </button>
                <button
                  onClick={() => markAttendance(item, "off")}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    item.status === "off"
                      ? "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/50"
                      : "bg-white/5 text-muted-foreground hover:bg-yellow-500/10 hover:text-yellow-400"
                  }`}
                >
                  <AlertCircle className="w-4 h-4" />
                  Off
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
