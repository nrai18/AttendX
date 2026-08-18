import React, { useState, useEffect, useRef } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, isAfter, startOfDay, differenceInDays } from "date-fns";
import { ChevronLeft, ChevronRight, Upload, Calendar as CalendarIcon, Loader2, Sparkles, AlertTriangle, ListFilter, AlignLeft, CalendarDays, Timer, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { EventWizardModal } from "./EventWizardModal";
import { CreateSemesterModal } from "../../components/semester/CreateSemesterModal";
import { Link } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";

interface AppEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  endDate?: string;
  eventType: "ct" | "midsem" | "endsem" | "holiday" | "vacation" | "fest" | "institute" | "other";
  allDay: boolean;
}

interface Semester {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export const SemesterHubPage = () => {
  const [activeTab, setActiveTab] = useState<"timeline" | "calendar" | "events" | "countdowns">("timeline");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [calendarData, setCalendarData] = useState<any>(null);
  const user = useAuthStore((state) => state.user);
  
  // OCR State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardPayload, setWizardPayload] = useState<any>(null);
  const [isCreateSemesterOpen, setIsCreateSemesterOpen] = useState(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const semRes = await api.get("/semesters/active");
      
      let eventsUrl = "/events";
      if (semRes.data) {
        setActiveSemester(semRes.data);
        eventsUrl = `/events?semesterId=${semRes.data.id}`;
      }

      const eventsRes = await api.get(eventsUrl);
      setEvents(eventsRes.data);
    } catch (error) {
      console.error("Failed to fetch academic data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCalendar = async () => {
    try {
      const monthStr = format(currentDate, "yyyy-MM");
      const res = await api.get(`/attendance/calendar?month=${monthStr}`);
      setCalendarData(res.data);
    } catch (error) {
      console.error("Failed to fetch calendar:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchCalendar();
  }, [currentDate]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSemester) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("semesterId", activeSemester.id);

    try {
      setIsUploading(true);
      const res = await api.post("/events/ocr-import", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      if (res.data.status === "needs_setup") {
        setWizardPayload(res.data.rawEvents);
        setIsWizardOpen(true);
      } else {
        alert("Calendar imported successfully!");
        fetchData();
      }
    } catch (error) {
      console.error("OCR import failed:", error);
      alert("Failed to process calendar file.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveEvents = async (selectedEvents: any[], semesterId: string) => {
    try {
      await api.post("/events/save-wizard", {
        semesterId,
        events: selectedEvents
      });
      setIsWizardOpen(false);
      fetchData();
      window.dispatchEvent(new Event("attendance-updated"));
    } catch (error) {
      console.error("Failed to save events:", error);
      alert("Failed to save events.");
    }
  };

  const handleClearEvents = async () => {
    if (!confirm("Are you sure you want to remove all academic calendar events? The calendar will render cleanly without event indicators.")) return;
    try {
      await api.post("/events/clear");
      setEvents([]);
      fetchCalendar();
      window.dispatchEvent(new Event("attendance-updated"));
    } catch (error) {
      console.error("Failed to clear events:", error);
      alert("Failed to clear events.");
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case "ct":
      case "midsem":
      case "endsem": return "bg-rose-500/20 text-rose-400 border-rose-500/30";
      case "fest":
      case "institute": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "holiday":
      case "vacation": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      default: return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    }
  };

  const getDotColor = (status?: string) => {
    switch (status) {
      case "attended": return "bg-emerald-500";
      case "missed": return "bg-rose-500";
      case "mixed": return "bg-purple-500";
      case "off": return "bg-yellow-500";
      case "not_marked":
      case "future": return "bg-zinc-500";
      default: return "bg-zinc-500/50";
    }
  };

  // Calendar Grid Generation
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = [];
  let day = startDate;
  while (day <= endDate) {
    calendarDays.push(day);
    day = addDays(day, 1);
  }

  // Upcoming Events logic
  const today = startOfDay(new Date());
  const upcomingEvents = events
    .filter(e => isAfter(new Date(e.date), today) || isSameDay(new Date(e.date), today))
    .slice(0, 10);

  // Semester Progress
  let progress = 0;
  let daysCompleted = 0;
  let daysRemaining = 0;

  if (activeSemester) {
    const now = Date.now();
    const semStartMs = new Date(activeSemester.startDate).getTime();
    const semEndMs = new Date(activeSemester.endDate).getTime();
    const totalMs = semEndMs - semStartMs;

    if (totalMs > 0) {
      const totalDays = Math.ceil(totalMs / (1000 * 60 * 60 * 24));
      if (now < semStartMs) {
        progress = 0;
        daysCompleted = 0;
        daysRemaining = totalDays;
      } else if (now >= semEndMs) {
        progress = 100;
        daysCompleted = totalDays;
        daysRemaining = 0;
      } else {
        const elapsedMs = now - semStartMs;
        progress = Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100)));
        daysCompleted = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
        daysRemaining = Math.max(0, totalDays - daysCompleted);
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full pb-24 md:pb-8 flex flex-col min-h-full space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Semester Overview</h1>
          <p className="text-muted-foreground mt-1">
            {activeSemester ? `Managing ${activeSemester.name}` : "Track events, exams, and holidays."}
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {events.length > 0 && (
            <button
              onClick={handleClearEvents}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer"
              title="Remove academic events & calendar items"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Remove Calendar</span>
            </button>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".jpg,.jpeg,.png,.pdf" 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || !activeSemester}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isUploading ? "Scanning..." : "Auto Import"}
          </button>
        </div>
      </div>

      {activeSemester ? (
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col md:flex-row md:items-center gap-6 shadow-xl">
          <div className="flex-1">
            <div className="flex justify-between items-end mb-2">
              <span className="text-sm font-medium text-foreground">Semester Progress</span>
              <span className="text-2xl font-bold text-primary">{progress}%</span>
            </div>
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground font-medium">
              <span>{daysCompleted} days completed</span>
              <span>{daysRemaining} days remaining</span>
            </div>
          </div>
          <div className="hidden md:block w-px h-16 bg-border" />
          <div className="flex-1">
            <span className="text-sm font-medium text-foreground mb-2 block">Next Milestone</span>
            {upcomingEvents.length > 0 ? (
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-bold text-foreground leading-tight">{upcomingEvents[0].title}</h4>
                  <p className="text-sm text-primary font-medium mt-0.5">
                    {differenceInDays(new Date(upcomingEvents[0].date), today)} days left
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${getEventColor(upcomingEvents[0].eventType)}`}>
                  <Timer className="w-6 h-6" />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming milestones.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-foreground">No Active Semester</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Set up your semester start and end dates to activate academic tracking and calendar view.
            </p>
          </div>
          <button
            onClick={() => setIsCreateSemesterOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Semester</span>
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-1 border-b border-border">
        <TabButton active={activeTab === "timeline"} onClick={() => setActiveTab("timeline")} icon={<AlignLeft className="w-4 h-4" />} label="Timeline" />
        <TabButton active={activeTab === "calendar"} onClick={() => setActiveTab("calendar")} icon={<CalendarDays className="w-4 h-4" />} label="Calendar" />
        <TabButton active={activeTab === "countdowns"} onClick={() => setActiveTab("countdowns")} icon={<Timer className="w-4 h-4" />} label="Countdowns" />
        <TabButton active={activeTab === "events"} onClick={() => setActiveTab("events")} icon={<ListFilter className="w-4 h-4" />} label="Events" />
      </div>

      {/* Tab Content */}
      <div className="flex-1 bg-card border border-border rounded-3xl p-6 min-h-[500px]">
        
        {activeTab === "calendar" && (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">{format(currentDate, "MMMM yyyy")}</h2>
              <div className="flex gap-2">
                <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 hover:bg-muted rounded-lg text-sm font-medium text-foreground">
                  Today
                </button>
                <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-px mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2 uppercase tracking-wider">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2 flex-1 mb-8">
              {calendarDays.map((day, i) => {
                const dayEvents = events.filter(e => {
                  const s = startOfDay(new Date(e.date));
                  const ed = e.endDate ? startOfDay(new Date(e.endDate)) : s;
                  return day >= s && day <= ed;
                });
                
                const dateKey = format(day, "yyyy-MM-dd");
                const status = calendarData?.days?.[dateKey];
                const isCurrentMonth = isSameMonth(day, monthStart);

                return (
                  <Link 
                    key={i} 
                    to={isCurrentMonth ? `/today?date=${dateKey}` : "#"} 
                    className={`min-h-[80px] p-2 rounded-xl border ${
                      !isCurrentMonth ? "opacity-30 border-transparent cursor-default pointer-events-none" : 
                      isSameDay(day, new Date()) ? "border-primary/50 bg-primary/5 cursor-pointer" : "border-white/5 hover:border-white/10 bg-white/[0.02] cursor-pointer"
                    } transition-colors flex flex-col`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-sm font-medium ${isSameDay(day, new Date()) ? "text-primary bg-primary/10 w-6 h-6 rounded-full flex items-center justify-center -ml-1 -mt-1" : "text-white/80"}`}>
                        {format(day, "d")}
                      </span>
                      {isCurrentMonth && status && (
                        <div className={`w-2 h-2 rounded-full mt-1 ${getDotColor(status)}`} title={status.replace("_", " ")} />
                      )}
                    </div>
                    <div className="space-y-1 mt-auto">
                      {dayEvents.slice(0, 2).map(e => (
                        <div key={e.id} className={`text-[10px] px-1.5 py-0.5 rounded truncate border ${getEventColor(e.eventType)}`} title={e.title}>
                          {e.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && <div className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 2} more</div>}
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Calendar Stats */}
            {calendarData?.stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-auto">
                <div className="bg-card rounded-2xl overflow-hidden border border-border shadow-xs">
                  <div className="grid grid-cols-5 p-4 text-center divide-x divide-border">
                    <div>
                      <div className="text-lg font-bold text-foreground mb-0.5">{calendarData.stats.days.not_marked}</div>
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider hidden sm:inline">None</span>
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider sm:hidden">No</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-foreground mb-0.5">{calendarData.stats.days.off}</div>
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Off</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-foreground mb-0.5">{calendarData.stats.days.missed}</div>
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Missed</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-foreground mb-0.5">{calendarData.stats.days.attended}</div>
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Attended</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-foreground mb-0.5">{calendarData.stats.days.mixed}</div>
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Mixed</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-muted/40 text-center py-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest border-t border-border">
                    Days Summary
                  </div>
                </div>

                <div className="bg-card rounded-2xl overflow-hidden border border-border shadow-xs">
                  <div className="grid grid-cols-5 p-4 text-center divide-x divide-border">
                    <div>
                      <div className="text-lg font-bold text-foreground mb-0.5">{calendarData.stats.lectures.off}</div>
                      <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Off</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-foreground mb-0.5">{calendarData.stats.lectures.missed}</div>
                      <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Missed</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-foreground mb-0.5">{calendarData.stats.lectures.attended}</div>
                      <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Attended</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-foreground mb-0.5">{calendarData.stats.lectures.total}</div>
                      <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-white mb-0.5">{(calendarData?.stats?.lectures?.percentage ?? 0).toFixed(0)}%</div>
                      <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Percent</div>
                    </div>
                  </div>
                  <div className="bg-white/[0.03] text-center py-2 text-xs font-semibold text-white/50 uppercase tracking-widest border-t border-white/5">
                    Lectures Summary
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "timeline" && (
          <div className="max-w-2xl mx-auto py-8">
            <h2 className="text-xl font-bold text-white mb-8">Semester Journey</h2>
            <div className="space-y-0 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-white/10">
              {events.map((event) => {
                const isPast = isAfter(today, new Date(event.endDate || event.date));
                const isCurrent = isSameDay(today, new Date(event.date)) || (event.endDate && today >= new Date(event.date) && today <= new Date(event.endDate));
                
                return (
                  <div key={event.id} className="relative flex items-center mb-8 group">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#0c0d12] z-10 shrink-0 ${
                      isCurrent ? 'bg-primary shadow-[0_0_15px_rgba(var(--primary),0.5)]' : 
                      isPast ? 'bg-emerald-500' : 'bg-white/10'
                    }`}>
                      {isPast ? <CheckCircle2 className="w-5 h-5 text-white" /> : <div className={`w-3 h-3 rounded-full ${isCurrent ? 'bg-white' : 'bg-white/50'}`} />}
                    </div>
                    
                    <div className={`ml-6 p-5 rounded-2xl border flex-1 transition-colors ${
                      isCurrent ? 'bg-primary/5 border-primary/30' : 'bg-white/[0.02] border-white/5 group-hover:border-white/10'
                    }`}>
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        {format(new Date(event.date), "MMM d, yyyy")}
                      </div>
                      <h3 className={`text-lg font-bold ${isCurrent ? 'text-primary' : 'text-white'}`}>{event.title}</h3>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "countdowns" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingEvents.map(event => {
              const daysLeft = differenceInDays(new Date(event.date), today);
              return (
                <div key={event.id} className="bg-white/[0.02] border border-white/5 hover:border-white/20 transition-colors rounded-2xl p-6 flex flex-col items-center text-center">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 mb-4 ${getEventColor(event.eventType)}`}>
                    <span className="text-2xl font-bold">{daysLeft}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">{event.title}</h3>
                  <p className="text-sm text-muted-foreground">Days Remaining</p>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "events" && (
          <div className="space-y-4">
            {events.map(event => (
              <div key={event.id} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                <div>
                  <h4 className="font-bold text-white">{event.title}</h4>
                  <p className="text-sm text-muted-foreground">{format(new Date(event.date), "MMMM d, yyyy")}</p>
                </div>
                <span className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${getEventColor(event.eventType)}`}>
                  {event.eventType}
                </span>
              </div>
            ))}
          </div>
        )}

      </div>

      <EventWizardModal 
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onSave={handleSaveEvents}
        eventsPayload={wizardPayload}
      />

      <CreateSemesterModal
        isOpen={isCreateSemesterOpen}
        onClose={() => setIsCreateSemesterOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl text-sm font-bold transition-all ${
      active ? "bg-card text-foreground border-t border-l border-r border-border border-b-transparent -mb-[1px]" 
      : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
    }`}
  >
    {icon}
    {label}
  </button>
);
