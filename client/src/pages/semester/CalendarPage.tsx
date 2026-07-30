import React, { useState, useEffect, useRef } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, isAfter, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, Upload, Calendar as CalendarIcon, MapPin, Clock, Loader2, Sparkles, CheckCircle2, AlertTriangle } from "lucide-react";
import { api } from "../../lib/api";

interface AppEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  endDate?: string;
  eventType: "ct" | "midsem" | "endsem" | "holiday" | "vacation" | "fest" | "institute" | "other";
  allDay: boolean;
}

export const CalendarPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // OCR State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/events");
      setEvents(res.data);
    } catch (error) {
      console.error("Failed to fetch events:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    try {
      setIsUploading(true);
      setUploadStatus("idle");
      const res = await api.post("/events/ocr-import", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setUploadStatus("success");
      // Refresh events
      fetchEvents();
      setTimeout(() => setUploadStatus("idle"), 3000);
    } catch (error) {
      console.error("OCR import failed:", error);
      setUploadStatus("error");
      setTimeout(() => setUploadStatus("idle"), 3000);
    } finally {
      setIsUploading(false);
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case "ct":
      case "midsem":
      case "endsem": return "bg-rose-500/20 text-rose-400 border-rose-500/30";
      case "fest":
      case "institute": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "holiday":
      case "vacation": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      default: return "bg-white/10 text-white/70 border-white/10";
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

  // Upcoming Events timeline
  const today = startOfDay(new Date());
  const upcomingEvents = events
    .filter(e => isAfter(new Date(e.date), today) || isSameDay(new Date(e.date), today))
    .slice(0, 5);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full pb-24 md:pb-8 flex flex-col h-full">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Academic Calendar</h1>
          <p className="text-muted-foreground mt-1">Track events, exams, and holidays.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept="image/*" 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              uploadStatus === "success" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50" :
              uploadStatus === "error" ? "bg-rose-500/20 text-rose-400 border border-rose-500/50" :
              "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 
             uploadStatus === "success" ? <CheckCircle2 className="w-4 h-4" /> :
             uploadStatus === "error" ? <AlertTriangle className="w-4 h-4" /> :
             <Sparkles className="w-4 h-4" />}
            {isUploading ? "Scanning..." : 
             uploadStatus === "success" ? "Imported!" :
             uploadStatus === "error" ? "Failed" :
             "Auto Import"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
        
        {/* Monthly Calendar View */}
        <div className="lg:col-span-2 bg-[#0c0d12] border border-white/5 rounded-3xl p-6 h-full flex flex-col">
          
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">{format(currentDate, "MMMM yyyy")}</h2>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1.5 hover:bg-white/10 rounded-lg transition-colors text-sm font-medium text-white/80"
              >
                Today
              </button>
              <button 
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
              <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2 uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2 flex-1">
            {calendarDays.map((day, i) => {
              const dayEvents = events.filter(e => isSameDay(new Date(e.date), day));
              
              return (
                <div 
                  key={i}
                  className={`min-h-[80px] p-2 rounded-xl border ${
                    !isSameMonth(day, monthStart) ? "opacity-30 border-transparent" : 
                    isSameDay(day, new Date()) ? "border-primary/50 bg-primary/5" : "border-white/5 hover:border-white/10 bg-white/[0.02]"
                  } transition-colors flex flex-col`}
                >
                  <span className={`text-sm font-medium mb-1 ${
                    isSameDay(day, new Date()) ? "text-primary bg-primary/10 w-6 h-6 rounded-full flex items-center justify-center" : "text-white/80"
                  }`}>
                    {format(day, "d")}
                  </span>
                  
                  <div className="space-y-1 mt-auto">
                    {dayEvents.slice(0, 2).map(e => (
                      <div key={e.id} className={`text-[10px] px-1.5 py-0.5 rounded truncate border ${getEventColor(e.eventType)}`}>
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[10px] text-muted-foreground pl-1">
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Events Timeline */}
        <div className="bg-[#050508] border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          
          <div className="flex items-center gap-3 mb-6 relative">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white">Upcoming</h2>
          </div>

          <div className="space-y-6 relative flex-1 overflow-y-auto pr-2">
            {isLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : upcomingEvents.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground text-sm border border-dashed border-white/10 rounded-xl">
                No upcoming events.<br/>Try importing your calendar!
              </div>
            ) : (
              <div className="relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
                {upcomingEvents.map((event, index) => (
                  <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mb-6">
                    {/* Marker */}
                    <div className={`flex items-center justify-center w-5 h-5 rounded-full border-4 border-[#050508] bg-white/20 z-10 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${
                      event.eventType === 'ct' || event.eventType === 'midsem' || event.eventType === 'endsem' ? 'bg-rose-500' :
                      event.eventType === 'fest' ? 'bg-blue-500' : 'bg-primary'
                    }`} />
                    
                    {/* Card */}
                    <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] bg-[#0c0d12] border border-white/5 rounded-2xl p-4 hover:bg-white/[0.03] transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-primary uppercase tracking-wider">{format(new Date(event.date), "MMM d")}</span>
                      </div>
                      <h3 className="text-sm font-bold text-white mb-2 leading-snug">{event.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className={`px-2 py-0.5 rounded border ${getEventColor(event.eventType)}`}>
                          {event.eventType}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
