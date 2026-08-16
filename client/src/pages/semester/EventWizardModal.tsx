import React, { useState, useMemo } from "react";
import { 
  Loader2, 
  CalendarRange, 
  CheckCircle2, 
  X, 
  Filter, 
  CheckSquare, 
  Square, 
  Trash2, 
  Layers,
  Sparkles,
  CalendarDays
} from "lucide-react";

export interface EventItem {
  title: string;
  eventType: string;
  date: string;
  endDate?: string;
  targetSemester?: string;
}

interface WizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (events: EventItem[]) => Promise<void>;
  eventsPayload: EventItem[] | null;
}

export const EventWizardModal: React.FC<WizardProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  eventsPayload 
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [editableEvents, setEditableEvents] = useState<EventItem[]>([]);

  // Initialize events when payload changes
  React.useEffect(() => {
    if (eventsPayload) {
      setEditableEvents(eventsPayload);
      // Select all by default
      setSelectedIndices(new Set(eventsPayload.map((_, i) => i)));
    }
  }, [eventsPayload]);

  // Extract unique semester filters from events
  const semesterFilters = useMemo(() => {
    const filters = new Set<string>();
    editableEvents.forEach(evt => {
      if (evt.targetSemester && evt.targetSemester !== "All") {
        filters.add(evt.targetSemester);
      }
    });
    return Array.from(filters);
  }, [editableEvents]);

  if (!isOpen || !eventsPayload) return null;

  const toggleSelect = (index: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIndices(new Set(editableEvents.map((_, i) => i)));
  };

  const handleDeselectAll = () => {
    setSelectedIndices(new Set());
  };

  const handleFilterSelect = (filterVal: string) => {
    setActiveFilter(filterVal);
    if (filterVal === "all") {
      setSelectedIndices(new Set(editableEvents.map((_, i) => i)));
    } else {
      const matchingIndices = new Set<number>();
      editableEvents.forEach((evt, idx) => {
        if (!evt.targetSemester || evt.targetSemester === "All" || evt.targetSemester === filterVal) {
          matchingIndices.add(idx);
        }
      });
      setSelectedIndices(matchingIndices);
    }
  };

  const handleDeleteEvent = (indexToDelete: number) => {
    setEditableEvents(prev => prev.filter((_, i) => i !== indexToDelete));
    setSelectedIndices(prev => {
      const next = new Set<number>();
      prev.forEach(i => {
        if (i < indexToDelete) next.add(i);
        else if (i > indexToDelete) next.add(i - 1);
      });
      return next;
    });
  };

  const handleSave = async () => {
    const finalEventsToSave = editableEvents.filter((_, i) => selectedIndices.has(i));
    if (finalEventsToSave.length === 0) {
      alert("Please select at least one event to import.");
      return;
    }
    setIsSaving(true);
    await onSave(finalEventsToSave);
    setIsSaving(false);
  };

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "midsem":
      case "endsem":
      case "ct":
        return "text-rose-500 bg-rose-500/10 border-rose-500/20";
      case "holiday":
      case "vacation":
        return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
      case "fest":
      case "institute":
        return "text-purple-500 bg-purple-500/10 border-purple-500/20";
      default:
        return "text-blue-500 bg-blue-500/10 border-blue-500/20";
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const filteredEvents = editableEvents.map((evt, originalIdx) => ({ evt, originalIdx })).filter(({ evt }) => {
    if (activeFilter === "all") return true;
    return !evt.targetSemester || evt.targetSemester === "All" || evt.targetSemester === activeFilter;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={() => !isSaving && onClose()}
      />
      
      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-card-foreground">
        
        {/* Top Accent Bar */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />
        
        {/* Header */}
        <div className="p-6 border-b border-border/80 bg-muted/20 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-primary/10 text-primary border border-primary/20 rounded-2xl shrink-0 shadow-xs">
              <CalendarRange className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Select Calendar Events
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {selectedIndices.size} of {editableEvents.length} selected
                </span>
              </div>
              <p className="text-muted-foreground text-xs mt-0.5">
                Review OCR extracted activities and select the events you want in your personal schedule.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={isSaving} 
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Semester Filter Tabs & Bulk Actions */}
        <div className="px-6 py-3 border-b border-border/60 bg-muted/30 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Semester Selector Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <span className="text-muted-foreground font-semibold flex items-center gap-1 shrink-0 mr-1 text-[11px]">
              <Filter className="w-3 h-3 text-primary" /> Filter:
            </span>
            <button
              onClick={() => handleFilterSelect("all")}
              className={`px-3 py-1 rounded-lg font-semibold tracking-tight transition-colors cursor-pointer text-xs ${
                activeFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              All Events ({editableEvents.length})
            </button>

            {semesterFilters.map((sem, idx) => (
              <button
                key={idx}
                onClick={() => handleFilterSelect(sem)}
                className={`px-3 py-1 rounded-lg font-semibold tracking-tight transition-colors cursor-pointer text-xs whitespace-nowrap ${
                  activeFilter === sem
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {sem}
              </button>
            ))}
          </div>

          {/* Bulk Selection Toggles */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSelectAll}
              className="text-[11px] font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1"
            >
              <CheckSquare className="w-3.5 h-3.5" /> Select All
            </button>
            <span className="text-border">|</span>
            <button
              onClick={handleDeselectAll}
              className="text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:underline cursor-pointer flex items-center gap-1"
            >
              <Square className="w-3.5 h-3.5" /> Deselect All
            </button>
          </div>
        </div>

        {/* Scrollable Event List with Checkboxes */}
        <div className="p-6 overflow-y-auto space-y-2.5 flex-1">
          {filteredEvents.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs space-y-2">
              <CalendarDays className="w-8 h-8 mx-auto opacity-40 text-primary" />
              <p>No events found for the selected filter.</p>
            </div>
          ) : (
            filteredEvents.map(({ evt, originalIdx }) => {
              const isSelected = selectedIndices.has(originalIdx);
              return (
                <div 
                  key={originalIdx} 
                  onClick={() => toggleSelect(originalIdx)}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected 
                      ? "bg-primary/5 border-primary/40 shadow-xs" 
                      : "bg-muted/20 border-border/60 opacity-60 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 pr-3">
                    {/* Checkbox */}
                    <div className="shrink-0">
                      {isSelected ? (
                        <div className="w-5 h-5 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-lg border-2 border-muted-foreground/40" />
                      )}
                    </div>

                    {/* Event Details */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={`text-xs font-bold truncate ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                          {evt.title}
                        </h4>
                        {evt.targetSemester && evt.targetSemester !== "All" && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold bg-secondary text-secondary-foreground border border-border">
                            {evt.targetSemester}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                        {formatDate(evt.date)}
                        {evt.endDate && ` – ${formatDate(evt.endDate)}`}
                      </p>
                    </div>
                  </div>

                  {/* Badges & Delete */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${getTypeColor(evt.eventType)}`}>
                      {evt.eventType}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEvent(originalIdx);
                      }}
                      className="p-1.5 text-muted-foreground/60 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Delete event"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-border/80 bg-muted/20 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            <span className="font-bold text-foreground">{selectedIndices.size}</span> events will be imported into your calendar.
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving || selectedIndices.size === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Import Selected Events</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
