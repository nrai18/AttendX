import React, { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Type, X, Loader2 } from "lucide-react";
import { api } from "../../lib/api";
import { useScrollLock } from "../../hooks/useScrollLock";

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  semesterId: string | undefined;
  onSaved: () => void;
}

export function AddEventModal({ isOpen, onClose, semesterId, onSaved }: AddEventModalProps) {
  useScrollLock(isOpen);

  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("other");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date) return;
    
    // We must have a semester to attach the event to!
    if (!semesterId) {
      setError("No active semester found.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await api.post("/events/save-wizard", {
        semesterId,
        events: [
          {
            title,
            eventType: title.toLowerCase().includes("birthday") ? "other" : eventType,
            date: new Date(date).toISOString(),
            endDate: endDate ? new Date(endDate).toISOString() : undefined,
          }
        ]
      });
      window.dispatchEvent(new Event("attendance-updated"));
      onSaved();
      onClose();
      // reset
      setTitle("");
      setEventType("other");
      setEndDate("");
      setDate(format(new Date(), "yyyy-MM-dd"));
    } catch (err: any) {
      console.error(err);
      setError("Failed to add event. " + (err.response?.data?.error || ""));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border/50 rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-border/50 flex items-center justify-between sticky top-0 bg-card z-10">
          <h2 className="text-xl font-bold text-foreground">Add Custom Event</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && <div className="mb-4 p-3 bg-red-500/10 text-red-500 rounded-xl text-sm font-medium">{error}</div>}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground ml-1">Event Title</label>
              <div className="relative">
                <Type className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                  required
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground ml-1">Category</label>
              <select
                value={eventType}
                onChange={e => setEventType(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none"
              >
                <option value="other">Birthday</option>
                <option value="event">Event</option>
                <option value="holiday">Holiday</option>
                <option value="restricted_holiday">Restricted Holiday</option>
                <option value="fest">Fest</option>
                <option value="exam">Exam</option>
                <option value="midsem">Mid-Sem Exams</option>
                <option value="endsem">End-Sem Exams</option>
                <option value="vacation">Vacation / Break</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground ml-1">Start Date</label>
              <div className="relative">
                <CalendarIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                  required
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground ml-1">End Date (Optional)</label>
              <div className="relative">
                <CalendarIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                  type="date"
                  min={date}
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all [color-scheme:dark]"
                />
              </div>
              <p className="text-[10px] text-muted-foreground ml-1">Leave empty for a single-day event.</p>
            </div>

            <div className="mt-4 pt-4 border-t border-border/50">
              <button
                type="submit"
                disabled={isSubmitting || !title || !date}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3.5 px-4 rounded-xl transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <><Loader2 size={18} className="animate-spin" /> Saving...</>
                ) : (
                  "Add Event"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
