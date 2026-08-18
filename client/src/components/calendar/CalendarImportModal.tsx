import React, { useState } from "react";
import { X, Upload, Loader2, Calendar, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { useAttendanceStore } from "../../stores/attendanceStore";

interface CalendarImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedEvent {
  title: string;
  startDate: string;
  endDate: string;
  eventType: "holiday" | "vacation" | "exam" | "other";
  isSemesterBased: boolean;
}

export const CalendarImportModal: React.FC<CalendarImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { activeSemesterId } = useAttendanceStore();
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parsedEvents, setParsedEvents] = useState<ParsedEvent[] | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleParse = async () => {
    if (!file) return;

    try {
      setIsParsing(true);
      const formData = new FormData();
      formData.append("file", file);
      if (activeSemesterId) {
        formData.append("semesterId", activeSemesterId);
      }

      const res = await api.post("/events/import-rag", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const events: ParsedEvent[] = res.data.events;
      setParsedEvents(events);
      setSelectedIndices(new Set(events.map((_, i) => i)));
    } catch (error: any) {
      console.error("Failed to parse calendar:", error);
      toast.error(error.response?.data?.error || "Failed to parse calendar document");
    } finally {
      setIsParsing(false);
    }
  };

  const handleSave = async () => {
    if (!parsedEvents || !activeSemesterId) return;

    const selectedEvents = parsedEvents.filter((_, i) => selectedIndices.has(i));
    if (selectedEvents.length === 0) {
      toast.error("Please select at least one event to save");
      return;
    }

    try {
      setIsSaving(true);
      await api.post("/events/import-rag/save", {
        semesterId: activeSemesterId,
        events: selectedEvents.map(e => ({
          title: e.title,
          startDate: new Date(e.startDate).toISOString(),
          endDate: new Date(e.endDate).toISOString(),
          eventType: e.eventType,
          isGlobal: !e.isSemesterBased,
        })),
      });

      toast.success("Calendar events imported successfully!");
      window.dispatchEvent(new Event("attendance-updated"));
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Failed to save calendar events:", error);
      toast.error(error.response?.data?.error || "Failed to save events");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSelection = (index: number) => {
    const newSelection = new Set(selectedIndices);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedIndices(newSelection);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-card border border-border rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="flex items-center justify-between p-6 pb-4 border-b border-border/50">
              <h2 className="text-xl font-bold text-foreground">Import Academic Calendar</h2>
              <button
                onClick={onClose}
                className="p-2 -mr-2 rounded-full text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {!parsedEvents ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Upload your university's academic calendar document (PDF, TXT) and our AI will automatically extract holidays, exams, and important dates using LangChain.
                  </p>
                  
                  <div className="relative group cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf,.txt,.csv"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl transition-colors ${file ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30 bg-muted/30'}`}>
                      <Upload className={`w-10 h-10 mb-4 ${file ? 'text-primary' : 'text-muted-foreground'}`} />
                      <p className="text-sm font-medium text-foreground mb-1">
                        {file ? file.name : "Click or drag to upload"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Supports PDF, TXT
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleParse}
                    disabled={!file || isParsing}
                    className="w-full py-3 px-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isParsing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Analyzing Document...
                      </>
                    ) : (
                      "Extract Events"
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Extracted Events ({parsedEvents.length})</h3>
                    <button 
                      onClick={() => setSelectedIndices(new Set(parsedEvents.length === selectedIndices.size ? [] : parsedEvents.map((_, i) => i)))}
                      className="text-xs text-primary hover:underline"
                    >
                      {parsedEvents.length === selectedIndices.size ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {parsedEvents.map((event, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => toggleSelection(idx)}
                        className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${selectedIndices.has(idx) ? 'bg-primary/5 border-primary/30' : 'bg-background border-border hover:border-border/80'}`}
                      >
                        <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center ${selectedIndices.has(idx) ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30'}`}>
                          {selectedIndices.has(idx) && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h4 className="text-sm font-medium text-foreground truncate">{event.title}</h4>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                              {event.eventType}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Calendar className="w-3 h-3" />
                            {event.startDate === event.endDate 
                              ? event.startDate 
                              : `${event.startDate} to ${event.endDate}`}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1.5">
                            {event.isSemesterBased ? "Applies to this semester only" : "Global event (all students)"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-border/50">
                    <button
                      onClick={() => setParsedEvents(null)}
                      className="flex-1 py-3 px-4 bg-muted text-foreground font-semibold rounded-xl hover:bg-muted/80 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving || selectedIndices.size === 0}
                      className="flex-[2] py-3 px-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        `Import ${selectedIndices.size} Events`
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
