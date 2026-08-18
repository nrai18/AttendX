import React, { useState, useEffect } from "react";
import { Loader2, CalendarRange, CheckCircle2, X } from "lucide-react";
import { api } from "../../lib/api";

interface EventItem {
  title: string;
  eventType: string;
  date: string;
  endDate?: string;
}

interface Semester {
  id: string;
  name: string;
}

interface WizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (events: EventItem[], semesterId: string) => Promise<void>;
  eventsPayload: EventItem[] | null;
}

export const EventWizardModal: React.FC<WizardProps> = ({ isOpen, onClose, onSave, eventsPayload }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>("");
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
      
      // Select all events by default
      if (eventsPayload) {
        setSelectedEvents(new Set(eventsPayload.map((_, i) => i)));
      }
    }
  }, [isOpen, eventsPayload]);

  if (!isOpen || !eventsPayload) return null;

  const handleSave = async () => {
    setIsSaving(true);
    const filteredEvents = eventsPayload.filter((_, i) => selectedEvents.has(i));
    await onSave(filteredEvents, selectedSemester);
    setIsSaving(false);
  };

  const toggleEvent = (index: number) => {
    const next = new Set(selectedEvents);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelectedEvents(next);
  };

  const getTypeColor = (type: string) => {
    switch(type) {
      case "midsem":
      case "endsem":
      case "ct":
        return "text-red-400 bg-red-400/10 border-red-400/20";
      case "holiday":
      case "vacation":
        return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
      case "fest":
      case "institute":
        return "text-purple-400 bg-purple-400/10 border-purple-400/20";
      default:
        return "text-blue-400 bg-blue-400/10 border-blue-400/20";
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

          <div className="pl-12 mb-4">
             <label className="block text-sm font-medium text-foreground mb-1.5">Target Semester</label>
             <select
               value={selectedSemester}
               onChange={(e) => setSelectedSemester(e.target.value)}
               className="w-full bg-black/20 border border-white/10 text-white rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 transition-colors"
             >
               <option value="" disabled>Select Semester</option>
               {semesters.map(s => (
                 <option key={s.id} value={s.id}>{s.name}</option>
               ))}
             </select>
          </div>
        </div>
        
        <div className="p-6 md:p-8 pt-0 overflow-y-auto pl-20">
          <div className="space-y-3">
            {eventsPayload.map((evt, idx) => (
              <div 
                key={idx} 
                onClick={() => toggleEvent(idx)}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                  selectedEvents.has(idx) ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-white/5 bg-white/[0.02] opacity-50'
                }`}
              >
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                  selectedEvents.has(idx) ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-white/20'
                }`}>
                  {selectedEvents.has(idx) && <CheckCircle2 className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-white mb-1">{evt.title}</h4>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(evt.date)}
                    {evt.endDate && ` - ${formatDate(evt.endDate)}`}
                  </p>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${getTypeColor(evt.eventType)}`}>
                  {evt.eventType}
                </span>
              </div>
            ))}
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
