import React, { useState, useEffect, useRef } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, isAfter, startOfDay, differenceInDays } from "date-fns";
import { ChevronLeft, ChevronRight, Upload, Calendar as CalendarIcon, Loader2, Sparkles, AlertTriangle, ListFilter, AlignLeft, CalendarDays, Timer, CheckCircle2, Plus, Trash2, Palmtree } from "lucide-react";
import { api } from "../../lib/api";
import { EventWizardModal } from "./EventWizardModal";
import { CreateSemesterModal } from "../../components/semester/CreateSemesterModal";
import { CalendarImportModal } from "../../components/calendar/CalendarImportModal";
import { HolidayListTab } from "./HolidayListTab";
import { Link, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { useCacheStore } from "../../stores/cacheStore";
import { DiscreteTabs } from "../../components/ui/discrete-tabs";
import { toast } from "sonner";
import { TimedUndoAction } from "../../components/ui/timed-undo-action";

interface AppEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  endDate?: string;
  eventType: "ct" | "midsem" | "endsem" | "holiday" | "restricted_holiday" | "vacation" | "fest" | "institute" | "other";
  allDay: boolean;
  isHolidayList?: boolean;
}

interface Semester {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export const SemesterHubPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTab = (searchParams.get("tab") as any) || "timeline";
  const [activeTab, setActiveTab] = useState<"timeline" | "calendar" | "events" | "countdowns" | "holidays">(defaultTab);
  const [currentDate, setCurrentDate] = useState(new Date());
  const cachedData = useCacheStore((state) => state.semester);
  const setCache = useCacheStore((state) => state.setCache);

  const [events, setEvents] = useState<AppEvent[]>(cachedData?.events || []);
  const [activeSemester, setActiveSemester] = useState<Semester | null>(cachedData?.activeSemester || null);
  const [calendarData, setCalendarData] = useState<any>(cachedData?.calendarData || null);
  const [isLoading, setIsLoading] = useState(!cachedData);
  const user = useAuthStore((state) => state.user);
  
  // OCR State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timelineNextEventRef = useRef<HTMLDivElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardPayload, setWizardPayload] = useState<any>(null);
  const [isCreateSemesterOpen, setIsCreateSemesterOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const nextEventId = React.useMemo(() => {
    const _today = startOfDay(new Date());
    return events.find(e => {
      const isPast = isAfter(_today, new Date(e.endDate || e.date));
      return !isPast;
    })?.id;
  }, [events]);

  useEffect(() => {
    if (activeTab === "timeline" && timelineNextEventRef.current) {
      setTimeout(() => {
        timelineNextEventRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [activeTab, events]);

  const fetchData = async () => {
    try {
      if (!cachedData) setIsLoading(true);
      const semRes = await api.get("/semesters/active");
      
      let eventsUrl = "/events";
      let nextSemester = null;
      if (semRes.data) {
        nextSemester = semRes.data;
        setActiveSemester(nextSemester);
        eventsUrl = `/events?semesterId=${semRes.data.id}`;
      }

      const eventsRes = await api.get(eventsUrl);
      setEvents(eventsRes.data);
      
      setCache('semester', {
        ...useCacheStore.getState().semester,
        activeSemester: nextSemester,
        events: eventsRes.data
      });
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
      
      setCache('semester', {
        ...useCacheStore.getState().semester,
        calendarData: res.data
      });
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
        toast.success("Calendar imported successfully!");
        fetchData();
      }
    } catch (error) {
      console.error("OCR import failed:", error);
      toast.error("Failed to process calendar file.");
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
      toast.success("Calendar imported successfully!", {
        action: {
          label: "View Calendar",
          onClick: () => window.location.href = "/calendar?promptSync=true",
        }
      });
    } catch (error) {
      console.error("Failed to save events:", error);
      toast.error("Failed to save events.");
    }
  };

  const handleClearEvents = async () => {
    try {
      await api.post("/events/clear?target=academic_calendar");
      fetchData(); // re-fetch events
      fetchCalendar();
      window.dispatchEvent(new Event("attendance-updated"));
    } catch (error) {
      console.error("Failed to clear events:", error);
      toast.error("Failed to clear events.");
    }
  };

  const getEventDotSolidColor = (event: any) => {
    const type = event?.eventType || "";
    if (type === "fest") return "bg-fuchsia-500";
    if (type === "holiday") {
      if (event?.isHolidayList) return "bg-blue-500";
      return "bg-emerald-500";
    }
    if (type === "restricted_holiday" || (type === "other" && event?.isHolidayList)) return "bg-cyan-500";
    
    switch (type) {
      case "midsem": return "bg-orange-500";
      case "endsem": return "bg-rose-500";
      case "ct": return "bg-amber-500";
      case "exam": return "bg-red-500";
      case "lab_exam": return "bg-yellow-500";
      case "vacation": return "bg-lime-500";
      case "institute": return "bg-sky-500";
      default: return "bg-blue-500";
    }
  };

  const getEventColor = (event: any) => {
    const type = event?.eventType || "";
    if (type === "fest" && event?.title) {
      const hash = event.title.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
      const colors = [
        "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30",
        "bg-pink-500/20 text-pink-400 border-pink-500/30",
        "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
        "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
        "bg-teal-500/20 text-teal-400 border-teal-500/30",
        "bg-violet-500/20 text-violet-400 border-violet-500/30",
        "bg-fuchsia-600/20 text-fuchsia-500 border-fuchsia-600/30",
        "bg-purple-600/20 text-purple-400 border-purple-500/30"
      ];
      return colors[hash % colors.length];
    }
    
    if (type === "holiday") {
      if (event?.isHolidayList) {
        return "bg-blue-500/20 text-blue-400 border-blue-500/30"; // Blue for Holiday List
      }
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"; // Emerald for Academic Calendar
    }
    if (type === "restricted_holiday" || (type === "other" && event?.isHolidayList)) {
      return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"; // Cyan for restricted
    }
    
    switch (type) {
      case "midsem": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "endsem": return "bg-rose-500/20 text-rose-400 border-rose-500/30";
      case "ct": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "exam": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "lab_exam": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "vacation": return "bg-lime-500/20 text-lime-400 border-lime-500/30";
      case "institute": return "bg-sky-500/20 text-sky-400 border-sky-500/30";
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
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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
    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full pb-24 md:pb-8 flex flex-col min-h-full space-y-6 overflow-x-hidden">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Semester Overview</h1>
          <p className="text-muted-foreground mt-1">
            {activeSemester ? `Managing ${activeSemester.name}` : "Track events, exams, and holidays."}
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {events.length > 0 && (
            <div className="flex h-[42px] items-center justify-center">
              <TimedUndoAction 
                initialSeconds={5} 
                deleteLabel="Remove Calendar" 
                undoLabel="Cancel Deletion"
                onConfirm={handleClearEvents} 
                icon={<Trash2 className="w-4 h-4 mr-2 inline-block" />}
              />
            </div>
          )}
          <button 
            onClick={() => setIsImportModalOpen(true)}
            disabled={!activeSemester}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            AI Import
          </button>
        </div>
        
        <CalendarImportModal 
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={fetchData}
        />
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
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-foreground px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Semester</span>
          </button>
        </div>
      )}

      {/* Tabs */}
      <DiscreteTabs
        defaultTab={activeTab}
        onTabChange={(id) => setActiveTab(id as any)}
        tabs={[
          { id: 'timeline', icon: <AlignLeft size={20} />, label: 'Timeline', activeColor: 'text-blue-500' },
          { id: 'calendar', icon: <CalendarDays size={20} />, label: 'Calendar', activeColor: 'text-indigo-500' },
          { id: 'countdowns', icon: <Timer size={20} />, label: 'Countdowns', activeColor: 'text-amber-500' },
          { id: 'events', icon: <ListFilter size={20} />, label: 'Events', activeColor: 'text-rose-500' },
          { id: 'holidays', icon: <Palmtree size={20} />, label: 'Holidays', activeColor: 'text-emerald-500' }
        ]}
      />

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

            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-8">
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
                    className={`min-h-[70px] sm:min-h-[80px] p-1 sm:p-2 rounded-lg sm:rounded-xl border ${
                      !isCurrentMonth ? "opacity-30 border-transparent cursor-default pointer-events-none" : 
                      isSameDay(day, new Date()) ? "border-primary/50 bg-primary/5 cursor-pointer" : "border-border/50 hover:border-border bg-card cursor-pointer"
                    } transition-colors flex flex-col`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-sm font-medium ${isSameDay(day, new Date()) ? "text-primary bg-primary/10 w-6 h-6 rounded-full flex items-center justify-center -ml-1 -mt-1" : "text-foreground/80"}`}>
                        {format(day, "d")}
                      </span>
                      {isCurrentMonth && status && (
                        <div className={`w-2 h-2 rounded-full mt-1 ${getDotColor(status)}`} title={status.replace("_", " ")} />
                      )}
                    </div>
                    <div className="space-y-1 mt-auto hidden sm:block">
                      {dayEvents.slice(0, 2).map(e => (
                        <div key={e.id} className={`text-[10px] px-1.5 py-0.5 rounded truncate border ${getEventColor(e)}`} title={e.title}>
                          {e.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && <div className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 2} more</div>}
                    </div>
                    {/* Mobile event dots */}
                    {dayEvents.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-auto sm:hidden pb-0.5 justify-center w-full">
                        {dayEvents.slice(0, 3).map(e => (
                          <div key={e.id} className={`w-1.5 h-1.5 rounded-full ${getEventDotSolidColor(e)}`} />
                        ))}
                        {dayEvents.length > 3 && (
                           <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                        )}
                      </div>
                    )}
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
                      <div className="text-lg font-bold text-foreground mb-0.5">{(calendarData?.stats?.lectures?.percentage ?? 0).toFixed(0)}%</div>
                      <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Percent</div>
                    </div>
                  </div>
                  <div className="bg-white/[0.03] text-center py-2 text-xs font-semibold text-foreground/50 uppercase tracking-widest border-t border-border/50">
                    Lectures Summary
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

          {activeTab === "timeline" && (
            <div className="max-w-2xl mx-auto py-8">
              <h2 className="text-xl font-bold text-foreground mb-8">Semester Journey</h2>
              <div className="space-y-0 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-border">
                {events.map((event) => {
                  const isPast = isAfter(today, new Date(event.endDate || event.date));
                  const isCurrent = isSameDay(today, new Date(event.date)) || (event.endDate && today >= new Date(event.date) && today <= new Date(event.endDate));
                  
                  return (
                    <div 
                      key={event.id} 
                      ref={event.id === nextEventId ? timelineNextEventRef : null}
                      className="relative flex items-center mb-8 group"
                    >
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-background z-10 shrink-0 ${
                        isCurrent ? 'bg-primary shadow-[0_0_15px_rgba(var(--primary),0.5)]' : 
                        isPast ? 'bg-emerald-500' : 'bg-muted'
                      }`}>
                        {isPast ? <CheckCircle2 className="w-5 h-5 text-foreground" /> : <div className={`w-3 h-3 rounded-full ${isCurrent ? 'bg-white' : 'bg-foreground/20'}`} />}
                      </div>
                      
                      <div className={`ml-6 p-5 rounded-2xl border flex-1 transition-colors ${
                        isCurrent ? 'bg-primary/5 border-primary/30' : 'bg-card border-border group-hover:border-primary/30'
                      }`}>
                        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          {event.endDate && event.endDate !== event.date 
                            ? `${format(new Date(event.date), "MMM d, yyyy")} - ${format(new Date(event.endDate), "MMM d, yyyy")}`
                            : format(new Date(event.date), "MMM d, yyyy")}
                        </div>
                        <h3 className={`text-lg font-bold ${isCurrent ? 'text-primary' : 'text-foreground'}`}>{event.title}</h3>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        {activeTab === "countdowns" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingEvents.map(event => {
              const daysLeft = differenceInDays(new Date(event.date), today);
              return (
                <div key={event.id} className="bg-card border border-border/60 hover:border-border transition-colors rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                  <div className={`w-16 h-16 shrink-0 rounded-full flex flex-col items-center justify-center border-2 ${getEventColor(event)}`}>
                    <span className="text-2xl font-black leading-none">{daysLeft}</span>
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-sm sm:text-base font-bold text-foreground leading-tight line-clamp-2">{event.title}</h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <p className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                        <CalendarIcon className="w-3.5 h-3.5" />
                        {format(new Date(event.date), "MMM d")}
                      </p>
                      <span className="w-1 h-1 rounded-full bg-border" />
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        {daysLeft === 0 ? "Today" : daysLeft === 1 ? "Tomorrow" : `${daysLeft} Days`}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "events" && (
          <div className="space-y-4">
            {events.map(event => (
              <div key={event.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-card border border-border/60 shadow-sm rounded-2xl gap-3 hover:border-border transition-colors">
                <div className="space-y-1">
                  <h4 className="font-bold text-foreground text-base">{event.title}</h4>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    {event.endDate && event.endDate !== event.date 
                      ? `${format(new Date(event.date), "MMMM d, yyyy")} - ${format(new Date(event.endDate), "MMMM d, yyyy")}`
                      : format(new Date(event.date), "MMMM d, yyyy")}
                  </p>
                </div>
                <div className="flex justify-start">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getEventColor(event)}`}>
                    {event.eventType.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "holidays" as any && (
          <div className="py-2">
            <HolidayListTab 
              semesterId={activeSemester?.id} 
              semesterStartDate={activeSemester?.startDate}
              semesterEndDate={activeSemester?.endDate}
            />
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


