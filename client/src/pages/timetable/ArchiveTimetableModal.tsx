import React, { useState, useEffect } from "react";
import { X, Calendar as CalendarIcon, Clock, BookOpen, MapPin, Archive } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../../lib/api";
import { useCacheStore } from "../../stores/cacheStore";
import { hapticLight, hapticSelection } from "../../utils/haptics";

import { format } from "date-fns";
import { useScrollLock } from "../../hooks/useScrollLock";

interface ArchiveTimetableModalProps {
  isOpen: boolean;
  onClose: () => void;
  semesterId: string;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const safeFormatDate = (dateVal: any, fallback = "Unknown Date") => {
  if (!dateVal) return fallback;
  try {
    const raw = String(dateVal).split("T")[0];
    const d = new Date(raw + "T00:00:00");
    if (isNaN(d.getTime())) return fallback;
    return format(d, "MMM d, yyyy");
  } catch {
    return fallback;
  }
};

export const ArchiveTimetableModal: React.FC<ArchiveTimetableModalProps> = ({ isOpen, onClose, semesterId }) => {
  useScrollLock(isOpen);
  const [versions, setVersions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [isClosePressed, setIsClosePressed] = useState(false);

  const handleCloseWithFeedback = () => {
    if (isClosePressed) return;
    hapticLight();
    setIsClosePressed(true);
    setTimeout(() => {
      setIsClosePressed(false);
      onClose();
    }, 150);
  };

  useEffect(() => {
    if (isOpen && semesterId) {
      setIsClosePressed(false);
      fetchArchivedVersions();
    }
  }, [isOpen, semesterId]);

  const getCachedVersions = (semId?: string) => {
    const cacheStore = useCacheStore.getState();
    const semKey = semId ? `archived_timetables_${semId}` : null;
    if (semKey && (cacheStore as any)[semKey] && Array.isArray((cacheStore as any)[semKey]) && (cacheStore as any)[semKey].length > 0) {
      return (cacheStore as any)[semKey];
    }
    if (cacheStore.archived_timetables && Array.isArray(cacheStore.archived_timetables) && cacheStore.archived_timetables.length > 0) {
      return cacheStore.archived_timetables;
    }
    if ((cacheStore.timetable as any)?.archivedSlots && Array.isArray((cacheStore.timetable as any).archivedSlots)) {
      return (cacheStore.timetable as any).archivedSlots;
    }
    return [];
  };

  const fetchArchivedVersions = async () => {
    const effectiveSemesterId = semesterId || (useCacheStore.getState().timetable as any)?.activeSemester?.id;

    // Load from offline cache first (both keys supported)
    const cached = getCachedVersions(effectiveSemesterId);
    if (cached.length > 0) {
      setVersions(cached);
      if (!selectedVersionId) {
        setSelectedVersionId(cached[0].id);
      }
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsLoading(false);
      return;
    }

    if (!effectiveSemesterId) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.get(`/timetable/semester/${effectiveSemesterId}/archived?force=true`);
      const newData = res.data || [];
      
      // Update cache
      useCacheStore.getState().setCache(`archived_timetables_${effectiveSemesterId}`, newData);
      useCacheStore.getState().setCache('archived_timetables', newData);
      const currentTtCache = useCacheStore.getState().timetable;
      if (currentTtCache) {
        useCacheStore.getState().setCache('timetable', {
          ...currentTtCache,
          archivedSlots: newData,
        });
      }
      
      setVersions(newData);
      if (newData.length > 0) {
        if (!selectedVersionId || !newData.some((v: any) => v.id === selectedVersionId)) {
          setSelectedVersionId(newData[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to load archived timetables:", error);
    } finally {
      setIsLoading(false);
    }
  };

  
  // Anti-scroll lock
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const selectedVersion = versions.find(v => v.id === selectedVersionId);

  // Group slots by day
  const slotsByDay: Record<number, any[]> = {};
  if (selectedVersion && Array.isArray(selectedVersion.slots)) {
    selectedVersion.slots.forEach((s: any) => {
      if (!slotsByDay[s.dayOfWeek]) slotsByDay[s.dayOfWeek] = [];
      slotsByDay[s.dayOfWeek].push(s);
    });
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isClosePressed ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          onClick={handleCloseWithFeedback}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/40 dark:bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={
              isClosePressed
                ? { opacity: 0, scale: 0.92, y: 10 }
                : { opacity: 1, scale: 1, y: 0 }
            }
            exit={{ opacity: 0, scale: 0.93, y: 12 }}
            transition={{ type: "spring", damping: 26, stiffness: 360, mass: 0.7 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Archive className="w-5 h-5 text-muted-foreground" />
                Archived Timetables
              </h2>
              <motion.button
                type="button"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.78, rotate: 90 }}
                onClick={handleCloseWithFeedback}
                aria-label="Close Archived Timetables"
                className={`relative w-9 h-9 rounded-xl flex items-center justify-center border transition-all duration-150 cursor-pointer group ${
                  isClosePressed
                    ? "bg-rose-500/25 border-rose-500/50 text-rose-500 ring-4 ring-rose-500/20 scale-90"
                    : "bg-muted/40 hover:bg-rose-500/15 border-border/60 hover:border-rose-500/35 text-muted-foreground hover:text-rose-500 shadow-sm"
                }`}
              >
                <X
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isClosePressed ? "rotate-90 scale-90" : "group-hover:rotate-90"
                  }`}
                />
              </motion.button>
            </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Sidebar - Versions */}
          <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-muted/10 overflow-y-auto flex-none max-h-[140px] md:max-h-none">
            {isLoading && versions.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Loading archive...</div>
            ) : versions.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No archived timetables found.</div>
            ) : (
              <div className="flex flex-col md:flex-col p-3 gap-2">
                {versions.map((v, i) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      hapticSelection();
                      setSelectedVersionId(v.id);
                    }}
                    className={`text-left p-3 rounded-xl border transition-all active:scale-[0.98] cursor-pointer ${
                      selectedVersionId === v.id
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-card border-border hover:border-primary/30 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="font-bold text-sm mb-1 text-foreground flex items-center justify-between gap-1.5">
                      <span>{v.isCurrent ? "Current Timetable" : `Version ${v.versionNumber || (versions.length - i)}`}</span>
                      {v.isCurrent && (
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-1.5">
                        <CalendarIcon className="w-3 h-3 flex-shrink-0" />
                        <span>
                          {safeFormatDate(v.validFrom)} - 
                          {v.validUntil ? safeFormatDate(v.validUntil) : "Present"}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground pl-4.5">
                        {v.slots?.length || 0} classes
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
                                {slot.subject?.code ? `${slot.subject.name} (${slot.subject.code})` : slot.subject?.name || "Unknown Subject"}
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
