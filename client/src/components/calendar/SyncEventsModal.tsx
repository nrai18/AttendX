import React, { useState } from "react";
import { X, Calendar, Palmtree, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { parse, format } from "date-fns";
import { FIXED_HOLIDAYS, RESTRICTED_HOLIDAYS } from "../../pages/semester/HolidayListTab";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { CalendarImportModal } from "./CalendarImportModal";

interface SyncEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const SyncEventsModal: React.FC<SyncEventsModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [syncHolidayList, setSyncHolidayList] = useState(true);
  const [syncAcademicCalendar, setSyncAcademicCalendar] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showCalendarImport, setShowCalendarImport] = useState(false);
  const { activeSemesterId } = useAttendanceStore();

  const handleSync = async () => {
    if (!syncHolidayList && !syncAcademicCalendar) {
      toast.error("Please select at least one item to sync.");
      return;
    }

    try {
      setIsSyncing(true);

      if (syncHolidayList) {
        if (!activeSemesterId) {
          toast.error("No active semester found.");
          setIsSyncing(false);
          return;
        }

        let payloadEvents: any[] = [];
        
        FIXED_HOLIDAYS.forEach(h => {
          try {
            const dateStr = `${h.date} 2026`;
            const parsedDate = parse(dateStr, "dd MMMM yyyy", new Date());
            payloadEvents.push({
              title: h.name,
              date: format(parsedDate, "yyyy-MM-dd"),
              endDate: format(parsedDate, "yyyy-MM-dd"),
              eventType: "holiday",
              allDay: true,
              isHolidayList: true,
              isHoliday: true
            });
          } catch(e) {}
        });

        RESTRICTED_HOLIDAYS.forEach(h => {
          try {
            const dateStr = `${h.date} 2026`;
            const parsedDate = parse(dateStr, "dd MMMM yyyy", new Date());
            payloadEvents.push({
              title: h.name,
              date: format(parsedDate, "yyyy-MM-dd"),
              endDate: format(parsedDate, "yyyy-MM-dd"),
              eventType: "restricted_holiday",
              allDay: true,
              isHolidayList: true,
              isHoliday: true
            });
          } catch(e) {}
        });
        
        await api.post("/events/save-wizard", {
          semesterId: activeSemesterId,
          events: payloadEvents,
        });
        toast.success("Holiday List synced successfully!");
      }

      if (syncAcademicCalendar) {
        setShowCalendarImport(true);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err) {
      console.error("Failed to sync", err);
      toast.error("Failed to sync events.");
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
              <p className="text-sm text-muted-foreground mt-1">Select what you would like to sync to your calendar.</p>
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
                  <h3 className="font-semibold text-foreground flex items-center gap-2"><Palmtree className="w-4 h-4 text-emerald-500" /> Sync Holiday List</h3>
                  <p className="text-sm text-muted-foreground mt-1">Pre-loads standard and restricted holidays. Distinct UI elements are automatically applied.</p>
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
                  <p className="text-sm text-muted-foreground mt-1">Import events via AI. Automatically resolves overlapping conflicts with the holiday list.</p>
                </div>
              </div>
            </div>

            <div className="p-6 pt-0 mt-2">
              <button
                onClick={handleSync}
                disabled={isSyncing || (!syncHolidayList && !syncAcademicCalendar)}
                className="w-full py-3 px-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {isSyncing ? "Syncing..." : "Continue"}
              </button>
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
          onSuccess();
          setShowCalendarImport(false);
          onClose();
        }}
      />
    </AnimatePresence>
  );
};
