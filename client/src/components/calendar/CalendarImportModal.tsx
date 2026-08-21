import React, { useState } from "react";
import { X, Upload, Loader2, Calendar, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { RunActionButton } from "../ui/run-action-button";
import { SaveToggle } from "../ui/save-toggle";
import { FileText, Cpu, CheckCircle2, Tags } from "lucide-react";

interface CalendarImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedEvent {
  title: string;
  startDate: string;
  endDate: string;
  category: string;
  isHoliday: boolean;
}

interface ParsedEventGroup {
  targetSemester: string;
  events: ParsedEvent[];
}

export const CalendarImportModal: React.FC<CalendarImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { activeSemesterId } = useAttendanceStore();
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parsedGroups, setParsedGroups] = useState<ParsedEventGroup[] | null>(null);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  React.useEffect(() => {
    if (isOpen && !parsedGroups) {
      api.get("/events/import-rag/cache").then(res => {
        if (res.data.events) {
          setParsedGroups(res.data.events);
        }
      }).catch(console.error);
    }
  }, [isOpen]);

  const handleClearCache = async () => {
    try {
      await api.delete("/events/import-rag/cache");
    } catch(e) {}
    setParsedGroups(null);
    setFile(null);
  };

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

      const groups: ParsedEventGroup[] = res.data.events;
      setParsedGroups(groups);
      
      if (groups.length > 0) {
        setSelectedGroupIndex(0);
        setSelectedIndices(new Set(groups[0].events.map((_, i) => i)));
      }
    } catch (error: any) {
      console.error("Failed to parse calendar:", error);
      toast.error(error.response?.data?.error || "Failed to parse calendar document");
    } finally {
      setIsParsing(false);
    }
  };

  const currentGroup = parsedGroups?.[selectedGroupIndex];
  const currentEvents = currentGroup?.events || [];

  const handleGroupChange = (newIdx: number) => {
    setSelectedGroupIndex(newIdx);
    if (parsedGroups) {
      setSelectedIndices(new Set(parsedGroups[newIdx].events.map((_, i) => i)));
    }
  };

  const toggleSelection = (idx: number) => {
    const event = currentEvents[idx];
    if (event?.isHoliday || event?.category === 'HOLIDAY') return;
    
    const newSet = new Set(selectedIndices);
    if (newSet.has(idx)) {
      newSet.delete(idx);
    } else {
      newSet.add(idx);
    }
    setSelectedIndices(newSet);
  };

  const handleSelectAllToggle = () => {
    if (selectedIndices.size === currentEvents.length) {
      // Deselect all non-holidays
      const holidayOnly = new Set<number>();
      currentEvents.forEach((e, i) => {
        if (e.isHoliday || e.category === 'HOLIDAY') {
          holidayOnly.add(i);
        }
      });
      setSelectedIndices(holidayOnly);
    } else {
      // Select all
      setSelectedIndices(new Set(currentEvents.map((_, i) => i)));
    }
  };

  const handleSave = async () => {
    if (!currentGroup || !activeSemesterId) return;

    const selectedEvents = currentEvents.filter((_, i) => selectedIndices.has(i));
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
          date: e.startDate,
          endDate: e.endDate,
          eventType: e.category.toLowerCase(),
          isHoliday: e.isHoliday
        }))
      });
      toast.success("Calendar events imported successfully");
      window.dispatchEvent(new Event("attendance-updated"));
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Failed to save calendar events:", error);
      toast.error(error.response?.data?.error || "Failed to save calendar events");
    } finally {
      setIsSaving(false);
    }
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
            onClick={() => !isSaving && !isParsing && onClose()}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-card border shadow-xl rounded-3xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">AI Calendar Import</h2>
                <p className="text-sm text-muted-foreground">Upload your academic calendar PDF</p>
              </div>
              <button
                onClick={onClose}
                disabled={isParsing || isSaving}
                className="p-2 hover:bg-muted rounded-full transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {!parsedGroups ? (
                <div className="space-y-6">
                  <p className="text-sm text-muted-foreground">
                    Powered by Google Gemini 3.6 Flash. This tool will extract all academic events, holidays, and exams directly from your institution's PDF calendar.
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

                  <div className="pt-2">
                    <RunActionButton 
                      disabled={!file}
                      action={handleParse}
                      idleLabel="Extract Events"
                      doneLabel="Data Finalized"
                      idleIcon={<Upload className="h-5 w-5 fill-current text-primary-foreground opacity-90" />}
                      widths={{ idle: 220, running: 340, done: 220 }}
                      steps={[
                        { id: 1, label: 'Uploading Document', icon: Upload },
                        { id: 2, label: 'Extracting Text (OCR)', icon: FileText },
                        { id: 3, label: 'Parsing AI Dates', icon: Cpu },
                        { id: 4, label: 'Classifying Events', icon: Tags },
                        { id: 5, label: 'Finalizing Data', icon: CheckCircle2 },
                      ]}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-foreground">Select Target Semester</label>
                      <button 
                        onClick={handleClearCache}
                        className="text-xs text-rose-500 hover:text-rose-600 font-medium px-2 py-1 hover:bg-rose-500/10 rounded transition-colors"
                      >
                        Upload Different PDF
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {parsedGroups.map((g, i) => (
                        <button
                          key={i}
                          onClick={() => handleGroupChange(i)}
                          className={`flex-1 min-w-[100px] py-2 px-3 text-sm font-medium rounded-xl border transition-all ${
                            selectedGroupIndex === i 
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm' 
                              : 'bg-background border-border text-foreground hover:bg-muted/50 hover:border-border/80'
                          }`}
                        >
                          {g.targetSemester}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground">Extracted Events ({currentEvents.length})</h3>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={handleSelectAllToggle}
                          className="text-xs text-primary hover:underline font-medium"
                        >
                          {currentEvents.length === selectedIndices.size ? "Deselect Non-Holidays" : "Select All"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {currentEvents.map((event, idx) => {
                      const isMandatory = event.isHoliday || event.category === 'HOLIDAY';
                      return (
                        <div 
                          key={idx} 
                          onClick={() => toggleSelection(idx)}
                          className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${
                            isMandatory 
                              ? 'bg-background/50 border-border opacity-70 cursor-not-allowed'
                              : selectedIndices.has(idx) 
                                ? 'bg-primary/5 border-primary/30 cursor-pointer' 
                                : 'bg-background border-border hover:border-border/80 cursor-pointer'
                          }`}
                        >
                          <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center ${
                            isMandatory 
                              ? 'bg-muted border-muted-foreground/30 text-muted-foreground'
                              : selectedIndices.has(idx) 
                                ? 'bg-primary border-primary text-primary-foreground' 
                                : 'border-muted-foreground/30'
                          }`}>
                            {selectedIndices.has(idx) && <Check className="w-3.5 h-3.5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <h4 className="text-sm font-medium text-foreground truncate">{event.title}</h4>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                                event.category === 'EXAM' || event.category === 'LAB_EXAM' ? 'bg-rose-500/15 text-rose-500 dark:text-rose-400' :
                                event.category === 'FEST' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400' :
                                event.isHoliday || event.category === 'HOLIDAY' || event.category === 'VACATION' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                                'bg-muted text-muted-foreground'
                              }`}>
                                {event.category.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Calendar className="w-3 h-3" />
                              {event.startDate === event.endDate 
                                ? event.startDate 
                                : `${event.startDate} to ${event.endDate}`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-border/50">
                    <button
                      onClick={() => setParsedGroups(null)}
                      className="flex-1 py-3 px-4 bg-muted text-foreground font-semibold rounded-xl hover:bg-muted/80 transition-colors"
                    >
                      Back
                    </button>
                    <SaveToggle
                      onClick={handleSave}
                      idleText={`Save ${selectedIndices.size} Events`}
                      savedText="Imported!"
                      size="sm"
                    />
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
