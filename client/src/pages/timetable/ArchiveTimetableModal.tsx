import React, { useState, useEffect } from "react";
import { X, Calendar as CalendarIcon, Clock, BookOpen, MapPin } from "lucide-react";
import { api } from "../../lib/api";
import { format } from "date-fns";

interface ArchiveTimetableModalProps {
  isOpen: boolean;
  onClose: () => void;
  semesterId: string;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const ArchiveTimetableModal: React.FC<ArchiveTimetableModalProps> = ({ isOpen, onClose, semesterId }) => {
  const [versions, setVersions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && semesterId) {
      fetchArchivedVersions();
    }
  }, [isOpen, semesterId]);

  const fetchArchivedVersions = async () => {
    try {
      setIsLoading(true);
      const res = await api.get(`/timetable/semester/${semesterId}/archived`);
      setVersions(res.data || []);
      if (res.data && res.data.length > 0) {
        setSelectedVersionId(res.data[0].id);
      }
    } catch (error) {
      console.error("Failed to load archived timetables:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedVersion = versions.find(v => v.id === selectedVersionId);

  // Group slots by day
  const slotsByDay: Record<number, any[]> = {};
  if (selectedVersion) {
    selectedVersion.slots.forEach((s: any) => {
      if (!slotsByDay[s.dayOfWeek]) slotsByDay[s.dayOfWeek] = [];
      slotsByDay[s.dayOfWeek].push(s);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <img src="/src/assets/archive.svg" alt="Archive" className="w-5 h-5 dark:invert" />
            Archived Timetables
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Sidebar - Versions */}
          <div className="w-full md:w-64 border-r border-border bg-muted/10 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Loading archive...</div>
            ) : versions.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No archived timetables found.</div>
            ) : (
              <div className="flex flex-col p-3 gap-2">
                {versions.map((v, i) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVersionId(v.id)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      selectedVersionId === v.id
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-card border-border hover:border-primary/30 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="font-bold text-sm mb-1 text-foreground">Version {versions.length - i}</div>
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-1.5">
                        <CalendarIcon className="w-3 h-3" />
                        <span>{format(new Date(v.validFrom), "MMM d, yyyy")} - {v.validUntil ? format(new Date(v.validUntil), "MMM d, yyyy") : "Present"}</span>
                      </div>
                      
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Main Content - Schedule */}
          <div className="flex-1 overflow-y-auto bg-card p-4">
            {selectedVersion ? (
              <div className="space-y-6">
                {DAYS.map((dayName, dayIndex) => {
                  const daySlots = slotsByDay[dayIndex] || [];
                  if (daySlots.length === 0) return null;
                  
                  return (
                    <div key={dayIndex} className="space-y-3">
                      <h3 className="text-sm font-bold text-foreground/80 uppercase tracking-wider border-b border-border pb-2">
                        {dayName}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {daySlots.map(slot => (
                          <div key={slot.id} className="bg-muted/30 border border-border rounded-xl p-3 flex flex-col gap-2">
                            <div className="flex justify-between items-start gap-2">
                              <div className="font-bold text-sm text-foreground line-clamp-2">
                                {slot.subject?.name || "Unknown Subject"}
                              </div>
                              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-primary/10 text-primary whitespace-nowrap">
                                {slot.slotType}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto pt-2 border-t border-border/50">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {slot.startTime} - {slot.endTime}
                              </div>
                              {slot.room && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5" />
                                  {slot.room}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Select an archived version to view its schedule
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
