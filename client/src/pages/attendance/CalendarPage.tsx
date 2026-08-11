import React, { useState, useEffect } from "react";
import { format, subMonths, addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2, MessageSquare, X, ExternalLink, CheckCircle2, XCircle, ShieldAlert, Award, AlertCircle, Info } from "lucide-react";
import { api } from "../../lib/api";
import { Link } from "react-router-dom";

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
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const fetchCalendar = async () => {
    try {
      setIsLoading(true);
      const monthStr = format(currentDate, "yyyy-MM");
      const res = await api.get(`/attendance/calendar?month=${monthStr}`);
      setData(res.data);
    } catch (error) {
      console.error("Failed to fetch calendar:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();

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
      case "off": return "bg-amber-500";
      case "not_marked":
      case "future": return "bg-muted-foreground/30";
      default: return "bg-muted-foreground/20";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"><CheckCircle2 className="w-3 h-3" /> Attended</span>;
      case "absent":
        return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"><XCircle className="w-3 h-3" /> Absent</span>;
      case "medical":
        return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"><ShieldAlert className="w-3 h-3" /> Medical</span>;
      case "od":
        return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"><Award className="w-3 h-3" /> Official Duty</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"><AlertCircle className="w-3 h-3" /> Off</span>;
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

  const selectedDayDetails = selectedDateKey ? details[selectedDateKey] || [] : [];
  const selectedDayEvents = selectedDateKey ? events[selectedDateKey] || [] : [];
  const selectedDayStatus = selectedDateKey ? days[selectedDateKey] : null;

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-foreground tracking-tight">{format(currentDate, "MMMM yyyy")}</h2>
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

          const isExam = dayEvents.some(e => e.eventType === "midsem" || e.eventType === "endsem" || e.title.toLowerCase().includes("exam"));
          const isFest = dayEvents.some(e => e.eventType === "fest" || e.title.toLowerCase().includes("yalgaar") || e.title.toLowerCase().includes("fest") || e.title.toLowerCase().includes("sports"));
          const hasEvent = dayEvents.length > 0;

          let animBorder = "";
          if (isExam) {
            animBorder = "ring-2 ring-rose-500 animate-pulse bg-rose-500/10 dark:bg-rose-500/20";
          } else if (isFest) {
            animBorder = "ring-2 ring-purple-500 animate-pulse bg-purple-500/10 dark:bg-purple-500/20";
          } else if (hasEvent) {
            animBorder = "ring-2 ring-blue-500 animate-pulse bg-blue-500/10 dark:bg-blue-500/20";
          }

          return (
            <div key={i} className="flex justify-center">
              {isCurrentMonth ? (
                <button
                  onClick={() => setSelectedDateKey(dateKey)}
                  className={`flex flex-col items-center justify-center relative w-12 h-14 hover:bg-muted/60 rounded-2xl transition-all cursor-pointer group ${animBorder} ${
                    selectedDateKey === dateKey ? "ring-2 ring-primary bg-primary/10" : ""
                  }`}
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
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
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

      {/* Expanded Day Modal / Drawer */}
      {selectedDateKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5 relative">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {format(new Date(selectedDateKey + "T00:00:00"), "EEEE, MMMM d, yyyy")}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                  Status: <span className="font-semibold text-foreground">{selectedDayStatus?.replace("_", " ") || "No classes"}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedDateKey(null)}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {selectedDayEvents.length > 0 && (
                <div className="space-y-2 mb-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Academic Hub Events</span>
                  {selectedDayEvents.map(evt => (
                    <div key={evt.id} className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-foreground">{evt.title}</p>
                        <p className="text-xs text-purple-600 dark:text-purple-400 capitalize font-medium">{evt.eventType.replace("_", " ")}</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500 text-white uppercase tracking-wider animate-pulse">
                        Event
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {selectedDayDetails.length === 0 ? (
                selectedDayEvents.length === 0 && (
                  <div className="text-center py-8 bg-muted/30 border border-border rounded-2xl">
                    <Info className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-60" />
                    <p className="text-xs text-muted-foreground">No specific class logs recorded for this day.</p>
                  </div>
                )
              ) : (
                selectedDayDetails.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 bg-muted/40 border border-border rounded-2xl flex flex-col space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground">{item.subjectName}</span>
                      {getStatusBadge(item.status)}
                    </div>
                    {item.remarks && (
                      <div className="bg-primary/10 border border-primary/20 text-foreground px-3 py-1.5 rounded-xl text-xs flex items-center gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span><strong className="text-primary font-semibold">Remark:</strong> {item.remarks}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-2">
              <Link
                to={`/today?date=${selectedDateKey}`}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl text-xs hover:bg-primary/90 transition-all shadow-md shadow-primary/20 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Day View in Agenda</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

