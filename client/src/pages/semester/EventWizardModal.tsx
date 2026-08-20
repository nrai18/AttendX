import React, { useState, useEffect } from "react";
import { Loader2, CalendarRange, CheckCircle2, X } from "lucide-react";
import { api } from "../../lib/api";

interface EventItem {
  title: string;
  category: string;
  startDate: string;
  endDate: string;
  isHoliday: boolean;
}

interface EventGroup {
  targetSemester: string;
  events: EventItem[];
}

interface Semester {
  id: string;
  name: string;
}

interface WizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (events: any[], semesterId: string) => Promise<void>;
  eventsPayload: EventGroup[] | null;
}

export const EventWizardModal: React.FC<WizardProps> = ({ isOpen, onClose, onSave, eventsPayload }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>("");
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const [selectedEvents, setSelectedEvents] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (isOpen) {
      // Fetch semesters
      api.get("/semesters").then(res => {
        setSemesters(res.data);
        const active = res.data.find((s: any) => s.isActive);
        if (active) setSelectedSemester(active.id);
        else if (res.data.length > 0) setSelectedSemester(res.data[0].id);
      }).catch(console.error);
      
      // Select all events of the first group by default
      if (eventsPayload && eventsPayload.length > 0) {
        setSelectedGroupIndex(0);
        setSelectedEvents(new Set(eventsPayload[0].events.map((_, i) => i)));
      }
    }
  }, [isOpen, eventsPayload]);

  useEffect(() => {
    if (eventsPayload && eventsPayload[selectedGroupIndex]) {
      setSelectedEvents(new Set(eventsPayload[selectedGroupIndex].events.map((_, i) => i)));
    }
  }, [selectedGroupIndex, eventsPayload]);

  if (!isOpen || !eventsPayload || eventsPayload.length === 0) return null;

  const currentGroup = eventsPayload[selectedGroupIndex];
  const currentEvents = currentGroup.events;

  const handleSave = async () => {
    setIsSaving(true);
    const filteredEvents = currentEvents
      .filter((_, i) => selectedEvents.has(i))
      .map(e => ({
        title: e.title,
        date: e.startDate,
        endDate: e.endDate,
        eventType: e.category.toLowerCase(),
        isHoliday: e.isHoliday
      }));
    await onSave(filteredEvents, selectedSemester);
    setIsSaving(false);
  };

  const toggleEvent = (index: number) => {
    const evt = currentEvents[index];
    const isHoliday = evt.isHoliday || evt.category?.toUpperCase() === "HOLIDAY" || evt.category?.toUpperCase() === "RESTRICTED_HOLIDAY";
    if (isHoliday) return; // Cannot toggle holiday events

    const next = new Set(selectedEvents);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelectedEvents(next);
  };

  const toggleAll = () => {
    if (selectedEvents.size === currentEvents.length) {
      // Deselect all (except holidays)
      const holidays = currentEvents.reduce((acc, evt, idx) => {
        if (evt.isHoliday || evt.category.toUpperCase() === "HOLIDAY") acc.add(idx);
        return acc;
      }, new Set<number>());
      setSelectedEvents(holidays);
    } else {
      // Select all
      setSelectedEvents(new Set(currentEvents.map((_, i) => i)));
    }
  };

  const getTypeColor = (evt: any) => {
    const type = (evt.category || "").toUpperCase();
    if (type === "FEST" && evt.title) {
      const hash = evt.title.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
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
    
    // Attempt to guess midsem vs endsem from title like the backend does
    const titleLower = (evt.title || "").toLowerCase();
    if (type === "EXAM") {
      if (titleLower.includes("mid")) return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      if (titleLower.includes("end") || titleLower.includes("theory")) return "bg-rose-500/20 text-rose-400 border-rose-500/30";
      if (titleLower.includes("cycle") || titleLower.includes("ct")) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      return "bg-red-500/20 text-red-400 border-red-500/30";
    }

    switch(type) {
      case "LAB_EXAM": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "HOLIDAY": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "VACATION": return "bg-lime-500/20 text-lime-400 border-lime-500/30";
      case "COMMENCEMENT": return "bg-sky-500/20 text-sky-400 border-sky-500/30";
      default: return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", { day: "numeric", month: "short" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => !isSaving && onClose()}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
        
        <div className="p-6 md:p-8 flex-shrink-0">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-indigo-500/20 text-indigo-500 rounded-xl">
                  <CalendarRange className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Review Semester Plan</h2>
              </div>
              <p className="text-muted-foreground text-sm pl-12">
                Select a semester and confirm the events to import.
              </p>
            </div>
            <button onClick={onClose} disabled={isSaving} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="pl-12 flex flex-col gap-4 mb-4">
             <div>
               <label className="block text-sm font-medium text-foreground mb-1.5">Parsed Target Semester</label>
               <div className="flex flex-wrap gap-2">
                 {eventsPayload.map((g, i) => (
                   <button
                     key={i}
                     onClick={() => setSelectedGroupIndex(i)}
                     className={`flex-1 min-w-[100px] py-2 px-3 text-sm font-medium rounded-xl border transition-all ${
                       selectedGroupIndex === i 
                         ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm' 
                         : 'bg-black/20 border-white/10 text-white hover:bg-white/5 hover:border-white/20'
                     }`}
                   >
                     {g.targetSemester}
                   </button>
                 ))}
               </div>
             </div>
             
             <div>
               <label className="block text-sm font-medium text-foreground mb-1.5">Map to System Semester</label>
               <div className="flex flex-wrap gap-2">
                 {semesters.map(s => (
                   <button
                     key={s.id}
                     onClick={() => setSelectedSemester(s.id)}
                     className={`flex-1 min-w-[100px] py-2 px-3 text-sm font-medium rounded-xl border transition-all ${
                       selectedSemester === s.id 
                         ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm' 
                         : 'bg-black/20 border-white/10 text-white hover:bg-white/5 hover:border-white/20'
                     }`}
                   >
                     {s.name}
                   </button>
                 ))}
               </div>
             </div>
          </div>
        </div>
        
        <div className="p-6 md:p-8 pt-0 overflow-y-auto pl-20">
          <div className="flex justify-between items-center mb-4 pr-2">
            <span className="text-sm font-medium text-white/70">
              {selectedEvents.size} of {currentEvents.length} events selected
            </span>
            <button 
              onClick={toggleAll}
              className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {selectedEvents.size === currentEvents.length ? "Deselect All" : "Select All"}
            </button>
          </div>
          <div className="space-y-3">
            {currentEvents.map((evt, idx) => {
              const isHoliday = evt.isHoliday || evt.category.toUpperCase() === "HOLIDAY";
              return (
              <div 
                key={idx} 
                onClick={() => toggleEvent(idx)}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                  selectedEvents.has(idx) ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-white/5 bg-white/[0.02] opacity-50'
                } ${isHoliday ? '!opacity-100 cursor-default' : ''}`}
              >
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                  selectedEvents.has(idx) ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-white/20'
                } ${isHoliday ? 'bg-indigo-600/50 border-indigo-600/50 cursor-not-allowed' : ''}`}>
                  {selectedEvents.has(idx) && <CheckCircle2 className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-white mb-1">{evt.title}</h4>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(evt.startDate)}
                    {evt.endDate !== evt.startDate && ` - ${formatDate(evt.endDate)}`}
                  </p>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${getTypeColor(evt)}`}>
                  {evt.category}
                </span>
              </div>
            )})}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-white/5 bg-black/20 flex justify-end gap-3 flex-shrink-0">
          <button 
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl font-medium text-white hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving || !selectedSemester || selectedEvents.size === 0}
            className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            Import {selectedEvents.size} Events
          </button>
        </div>
      </div>
    </div>
  );
};
