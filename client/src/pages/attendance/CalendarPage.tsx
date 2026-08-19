// Replace the whole file to make it simpler and cleaner
import React, { useState, useEffect } from "react";
import { format, subMonths, addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2, MessageSquare, Upload, CalendarDays } from "lucide-react";
import { api } from "../../lib/api";
import { useNavigate } from "react-router-dom";
import { CalendarImportModal } from "../../components/calendar/CalendarImportModal";
import { InlineAction } from "../../components/ui/inline-action";
import { toast } from "sonner";

interface DayDetail {
  id: string;
  subjectName: string;
  status: string; // "present" | "absent" | "medical" | "od" | "off"
  remarks: string | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  eventType: string;
}

interface CalendarData {
  hasCalendar?: boolean;
  days: Record<string, string>; // "YYYY-MM-DD" -> "attended" | "missed" | "mixed" | "off" | "not_marked" | "future"
  details?: Record<string, DayDetail[]>;
  events?: Record<string, CalendarEvent[]>;
  stats: {
    days: {
      not_marked: number;
      off: number;
      missed: number;
      attended: number;
      mixed: number;
    };
    lectures: {
      off: number;
      missed: number;
      attended: number;
      total: number;
      percentage: number;
    };
  };
}

export const CalendarPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [data, setData] = useState<CalendarData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const navigate = useNavigate();

  const fetchCalendar = async (force: boolean = false) => {
    try {
      setIsLoading(true);
      const monthStr = format(currentDate, "yyyy-MM");
      const res = await api.get(`/attendance/calendar?month=${monthStr}${force ? '&force=true' : ''}`);
      setData(res.data);
      return res.data;
    } catch (error) {
      console.error("Failed to fetch calendar:", error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();

    // Check if we were redirected here and should prompt the user to force sync
    const params = new URLSearchParams(window.location.search);
    if (params.get("promptSync") === "true") {
      setTimeout(() => {
        toast.info("Please click 'Sync Events' to ensure all your dates, lectures, and data are perfectly synchronized!", {
          duration: 8000,
          position: "top-center"
        });
        // Remove the param so it doesn't keep prompting on refresh
        window.history.replaceState({}, document.title, "/calendar");
      }, 500);
    }

    const handleAttendanceUpdate = () => {
      fetchCalendar();
    };
    window.addEventListener("attendance-updated", handleAttendanceUpdate);
    return () => window.removeEventListener("attendance-updated", handleAttendanceUpdate);
  }, [currentDate]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  // our weeks start on Monday (1)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = [];
  let day = startDate;
  while (day <= endDate) {
    calendarDays.push(day);
    day = addDays(day, 1);
  }

  const getDotColor = (status?: string) => {
    switch (status) {
      case "attended": return "bg-emerald-500";
      case "missed": return "bg-rose-500";
      case "mixed": return "bg-purple-500";
      case "off": return "bg-yellow-500";
      case "not_marked":
      case "future": return "bg-muted-foreground/30";
      default: return "bg-muted-foreground/20";
    }
  };

  if (isLoading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const days: Record<string, string> = data?.days || {};
  const details: Record<string, DayDetail[]> = data?.details || {};
  const events: Record<string, CalendarEvent[]> = data?.events || {};
  const stats = data?.stats || { 
    days: { not_marked: 0, off: 0, missed: 0, attended: 0, mixed: 0 }, 
    lectures: { off: 0, missed: 0, attended: 0, total: 0, percentage: 0 } 
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-foreground tracking-tight">{format(currentDate, "MMMM yyyy")}</h2>
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-semibold transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            AI Import
          </button>
          <div className="hidden sm:block ml-2 w-80 transform scale-90 origin-left">
            <InlineAction 
              label="Calendar" 
              icon={<CalendarDays size={18} />} 
              actionText="Sync Events" 
              onAction={async () => {
                const refreshedData = await fetchCalendar(true);
                await new Promise(resolve => setTimeout(resolve, 500));
                
                if (refreshedData && !refreshedData.hasCalendar) {
                  toast.warning("Synced successfully, but no academic calendar found for this semester. Click 'AI Import' to add events.", {
                    duration: 5000
                  });
                } else if (refreshedData) {
                  toast.success("Calendar synced successfully! All data is now up-to-date.");
                }
              }} 
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors cursor-pointer">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 hover:bg-muted rounded-lg text-sm font-medium text-foreground transition-colors cursor-pointer">
            Today
          </button>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors cursor-pointer">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-4 text-center mb-6">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
          <div key={d} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{d}</div>
        ))}

        {calendarDays.map((d, i) => {
          const dateKey = format(d, "yyyy-MM-dd");
          const status = days[dateKey];
          const isCurrentMonth = isSameMonth(d, currentDate);
          const isToday = isSameDay(d, new Date());
          const dayDetails = details[dateKey] || [];
          const dayEvents = events[dateKey] || [];
          const hasRemarks = dayDetails.some(item => !!item.remarks);

          const isEndSem = dayEvents.some(e => e.eventType === "endsem" || e.title.toLowerCase().includes("end sem") || e.title.toLowerCase().includes("end-sem"));
          const isMidSem = dayEvents.some(e => e.eventType === "midsem" || e.title.toLowerCase().includes("mid sem") || e.title.toLowerCase().includes("mid-sem"));
          const isExam = dayEvents.some(e => e.eventType === "exam" || (e.title.toLowerCase().includes("exam") && !e.title.toLowerCase().includes("lab")));
          const isLabExam = dayEvents.some(e => e.eventType === "lab_exam" || e.title.toLowerCase().includes("lab") || e.title.toLowerCase().includes("practical"));
          const isFest = dayEvents.some(e => e.eventType === "fest" || e.title.toLowerCase().includes("yalgaar") || e.title.toLowerCase().includes("fest"));
          const isSports = dayEvents.some(e => e.eventType === "sports" || e.title.toLowerCase().includes("sports") || e.title.toLowerCase().includes("tournament"));
          const isHoliday = dayEvents.some(e => e.eventType === "holiday" || e.title.toLowerCase().includes("holiday") || e.title.toLowerCase().includes("jayanti") || e.title.toLowerCase().includes("diwali") || e.title.toLowerCase().includes("dussehra"));
          const isVacation = dayEvents.some(e => e.eventType === "vacation" || e.title.toLowerCase().includes("vacation") || e.title.toLowerCase().includes("break"));
          const hasEvent = dayEvents.length > 0;

          let animBorder = "";
          if (isEndSem) {
            animBorder = "ring-2 ring-red-600 bg-red-600/10 dark:bg-red-600/20";
          } else if (isMidSem) {
            animBorder = "ring-2 ring-rose-500 bg-rose-500/10 dark:bg-rose-500/20";
          } else if (isExam) {
            animBorder = "ring-2 ring-orange-500 bg-orange-500/10 dark:bg-orange-500/20";
          } else if (isLabExam) {
            animBorder = "ring-2 ring-amber-500 bg-amber-500/10 dark:bg-amber-500/20";
          } else if (isFest) {
            animBorder = "ring-2 ring-purple-500 bg-purple-500/10 dark:bg-purple-500/20";
          } else if (isSports) {
            animBorder = "ring-2 ring-blue-500 bg-blue-500/10 dark:bg-blue-500/20";
          } else if (isHoliday) {
            animBorder = "ring-2 ring-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20";
          } else if (isVacation) {
            animBorder = "ring-2 ring-cyan-500 bg-cyan-500/10 dark:bg-cyan-500/20";
          } else if (hasEvent) {
            animBorder = "ring-2 ring-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/20";
          }

          return (
            <div key={i} className="flex justify-center">
              {isCurrentMonth ? (
                <button
                  onClick={() => navigate(`/today?date=${dateKey}`)}
                  className={`flex flex-col items-center justify-center relative w-12 h-14 hover:bg-muted/60 rounded-2xl transition-all cursor-pointer group ${animBorder}`}
                  title={dayEvents.map(e => e.title).join(", ") || (hasRemarks ? "Has logged remarks" : undefined)}
                >
                  <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-transform group-hover:scale-110 ${
                    isToday ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20" : "text-foreground"
                  }`}>
                    {format(d, "d")}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${getDotColor(status)}`} />
                    {hasRemarks && (
                      <MessageSquare className="w-2.5 h-2.5 text-primary" />
                    )}
                    {hasEvent && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                    )}
                  </div>
                </button>
              ) : (
                <div className="w-12 h-14" />
              )}
            </div>
          );
        })}
      </div>

      {/* Stats Cards */}
      <div className="space-y-4">
        {/* Days Stats */}
        <div className="bg-card rounded-2xl overflow-hidden border border-border shadow-sm">
          <div className="grid grid-cols-5 p-4 text-center divide-x divide-border">
            <div>
              <div className="text-lg font-bold text-foreground mb-0.5">{stats.days.not_marked}</div>
              <div className="flex items-center justify-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider hidden sm:inline">Not marked</span>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider sm:hidden">None</span>
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-foreground mb-0.5">{stats.days.off}</div>
              <div className="flex items-center justify-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Off</span>
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-foreground mb-0.5">{stats.days.missed}</div>
              <div className="flex items-center justify-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Missed</span>
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-foreground mb-0.5">{stats.days.attended}</div>
              <div className="flex items-center justify-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Attended</span>
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-foreground mb-0.5">{stats.days.mixed}</div>
              <div className="flex items-center justify-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Mixed</span>
              </div>
            </div>
          </div>
          <div className="bg-muted/40 text-center py-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest border-t border-border">
            Days
          </div>
        </div>

        {/* Lectures Stats */}
        <div className="bg-card rounded-2xl overflow-hidden border border-border shadow-sm">
          <div className="grid grid-cols-5 p-4 text-center divide-x divide-border">
            <div>
              <div className="text-lg font-bold text-foreground mb-0.5">{stats.lectures.off}</div>
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Off</div>
            </div>
            <div>
              <div className="text-lg font-bold text-foreground mb-0.5">{stats.lectures.missed}</div>
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Missed</div>
            </div>
            <div>
              <div className="text-lg font-bold text-foreground mb-0.5">{stats.lectures.attended}</div>
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Attended</div>
            </div>
            <div>
              <div className="text-lg font-bold text-foreground mb-0.5">{stats.lectures.total}</div>
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total</div>
            </div>
            <div>
              <div className="text-lg font-bold text-foreground mb-0.5">{(stats?.lectures?.percentage ?? 0).toFixed(2)}%</div>
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Percent</div>
            </div>
          </div>
          <div className="bg-muted/40 text-center py-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest border-t border-border">
            Lectures
          </div>
        </div>
      </div>

      <CalendarImportModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={fetchCalendar}
      />
    </div>
  );
};

