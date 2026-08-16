// Replace the whole file to make it simpler and cleaner
import React, { useState, useEffect } from "react";
import { format, subMonths, addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2, MessageSquare, CheckCircle2, XCircle, ShieldAlert, Award, AlertCircle } from "lucide-react";
import { api } from "../../lib/api";
import { Link, useNavigate } from "react-router-dom";

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
  targetSemester?: string;
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
  const navigate = useNavigate();

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
            <div key={i} className="flex justify-center relative">
              {isCurrentMonth ? (
                <button
                  onClick={() => navigate(`/today?date=${dateKey}`)}
                  className={`flex flex-col items-center justify-center relative w-12 h-14 hover:bg-muted/60 rounded-2xl transition-all cursor-pointer group ${animBorder}`}
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

                  {/* Rich Event & Attendance Hover Tooltip Popover */}
                  {(hasEvent || hasRemarks || (status && status !== "not_marked")) && (
                    <div className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col z-50 pointer-events-none w-52 sm:w-60 p-2.5 bg-popover/95 backdrop-blur-md border border-border text-popover-foreground rounded-2xl shadow-xl shadow-black/30 text-left animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between gap-1 pb-1.5 mb-1.5 border-b border-border/60">
                        <span className="text-[11px] font-bold text-foreground">
                          {format(d, "EEE, MMM d, yyyy")}
                        </span>
                        {status && status !== "not_marked" && (
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider ${
                            status === "attended" ? "bg-emerald-500/15 text-emerald-400" :
                            status === "missed" ? "bg-rose-500/15 text-rose-400" :
                            status === "mixed" ? "bg-purple-500/15 text-purple-400" :
                            status === "off" ? "bg-amber-500/15 text-amber-400" : "bg-muted text-muted-foreground"
                          }`}>
                            {status.replace("_", " ")}
                          </span>
                        )}
                      </div>

                      {/* Events list */}
                      {dayEvents.length > 0 && (
                        <div className="space-y-1.5">
                          {dayEvents.map((evt, eIdx) => (
                            <div key={eIdx} className="flex items-start gap-1.5 text-xs">
                              <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                                evt.eventType === "fest" ? "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]" :
                                evt.eventType === "midsem" || evt.eventType === "endsem" ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" :
                                evt.eventType === "holiday" ? "bg-emerald-500" : "bg-blue-500"
                              }`} />
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-foreground text-[11px] leading-snug">
                                  {evt.title}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">
                                    {evt.eventType}
                                  </span>
                                  {evt.targetSemester && evt.targetSemester !== "All" && (
                                    <span className="text-[9px] px-1 py-0.1 bg-secondary text-secondary-foreground rounded text-[8px] font-mono">
                                      {evt.targetSemester}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Remarks */}
                      {hasRemarks && (
                        <div className="mt-1.5 pt-1 border-t border-border/40 text-[10px] text-primary flex items-center gap-1">
                          <MessageSquare className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">Includes logged session remarks</span>
                        </div>
                      )}

                      {/* Tooltip Down Arrow */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-popover" />
                    </div>
                  )}
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
    </div>
  );
};

