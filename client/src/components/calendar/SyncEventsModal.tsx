import React, { useState } from "react";
import { X, Calendar, Palmtree, Loader2, FileUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { useCacheStore } from "../../stores/cacheStore";
import { CalendarImportModal } from "./CalendarImportModal";
import { useScrollLock } from "../../hooks/useScrollLock";

interface SyncEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const SyncEventsModal: React.FC<SyncEventsModalProps> = ({ isOpen, onClose, onSuccess }) => {
  useScrollLock(isOpen);
  const [syncHolidayList, setSyncHolidayList] = useState(true);
  const [syncAcademicCalendar, setSyncAcademicCalendar] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showCalendarImport, setShowCalendarImport] = useState(false);
  const { activeSemesterId } = useAttendanceStore();

  const handleSync = async () => {
    if (!syncHolidayList && !syncAcademicCalendar) {
      toast.error("Please select at least one item to sync.");
      return;
    }

    if (!activeSemesterId) {
      toast.error("No active semester found. Please create or activate a semester first.");
      return;
    }

    try {
      setIsSyncing(true);
      const res = await api.post("/events/templates/sync", {
        semesterId: activeSemesterId,
        syncHolidayList,
        syncAcademicCalendar
      });

      const count = res.data?.syncedCount ?? 0;
      toast.success(`Successfully synced ${count} events to your calendar!`);
      useCacheStore.getState().setCache("calendar", null);
      useAttendanceStore.getState().fetchStats(true);
      window.dispatchEvent(new Event("attendance-updated"));
      window.dispatchEvent(new Event("events-updated"));
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Failed to sync template events", err);
      toast.error(err?.response?.data?.message || "Failed to sync events.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && !showCalendarImport && (
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
            className="relative w-full max-w-md bg-card border shadow-xl rounded-3xl overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-foreground">Sync Events</h2>
                <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Select official university events to sync to your calendar.</p>
            </div>

            <div className="p-6 space-y-4">
              <div 
                onClick={() => setSyncHolidayList(!syncHolidayList)}
                className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${syncHolidayList ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
              >
                <div className="mt-0.5">
                  <input type="checkbox" checked={syncHolidayList} readOnly className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2"><Palmtree className="w-4 h-4 text-emerald-500" /> Sync Official Holiday List</h3>
                  <p className="text-sm text-muted-foreground mt-1">Pre-loads official fixed and restricted holidays directly from the backend catalog.</p>
                </div>
              </div>

              <div 
                onClick={() => setSyncAcademicCalendar(!syncAcademicCalendar)}
                className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${syncAcademicCalendar ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
              >
                <div className="mt-0.5">
                  <input type="checkbox" checked={syncAcademicCalendar} readOnly className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2"><Calendar className="w-4 h-4 text-indigo-500" /> Sync Academic Calendar</h3>
                  <p className="text-sm text-muted-foreground mt-1">Pre-loads official exams, lab demos, and academic milestones tailored to your active semester.</p>
                </div>
              </div>
            </div>

            <div className="p-6 pt-0 mt-2 space-y-3">
              <button
                onClick={handleSync}
                disabled={isSyncing || (!syncHolidayList && !syncAcademicCalendar)}
                className="w-full py-3 px-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {isSyncing ? "Syncing from Backend..." : "Sync to Calendar"}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowCalendarImport(true)}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
                >
                  <FileUp className="w-3.5 h-3.5" />
                  Have a custom PDF or image? Upload via AI OCR
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <CalendarImportModal 
        isOpen={showCalendarImport}
        onClose={() => {
          setShowCalendarImport(false);
          onClose();
        }}
        onSuccess={() => {
          useCacheStore.getState().setCache("calendar", null);
      useAttendanceStore.getState().fetchStats(true);
      window.dispatchEvent(new Event("attendance-updated"));
      window.dispatchEvent(new Event("events-updated"));
      onSuccess();
          setShowCalendarImport(false);
          onClose();
        }}
      />
    </AnimatePresence>
  );
};
