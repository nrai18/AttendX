import React, { useState } from "react";
import { Loader2, CalendarRange, CheckCircle2, X } from "lucide-react";

interface EventItem {
  title: string;
  eventType: string;
  date: string;
  endDate?: string;
}

interface WizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (events: EventItem[]) => Promise<void>;
  eventsPayload: EventItem[] | null;
}

export const EventWizardModal: React.FC<WizardProps> = ({ isOpen, onClose, onSave, eventsPayload }) => {
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !eventsPayload) return null;

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(eventsPayload);
    setIsSaving(false);
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
      <div className="relative w-full max-w-xl bg-[#0c0d12] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
        
        <div className="p-6 md:p-8 overflow-y-auto">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl">
                  <CalendarRange className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-white">Review Semester Plan</h2>
              </div>
              <p className="text-muted-foreground text-sm pl-12">
                We've extracted {eventsPayload.length} academic events from your calendar.
              </p>
            </div>
            <button onClick={onClose} disabled={isSaving} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="pl-12 space-y-3">
            {eventsPayload.map((evt, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                <div>
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
        <div className="p-6 border-t border-white/5 bg-black/20 flex justify-end gap-3">
          <button 
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl font-medium text-white hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            Confirm & Save
          </button>
        </div>
      </div>
    </div>
  );
};
