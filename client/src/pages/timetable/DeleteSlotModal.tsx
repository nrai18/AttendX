import React, { useState } from "react";
import { Trash2, ShieldCheck, AlertCircle, Calendar, CalendarRange, X } from "lucide-react";
import { formatTimeRange } from "../../utils/timeUtils";

interface Subject {
  id: string;
  name: string;
  code?: string;
  colorHex?: string;
}

export interface TimetableSlot {
  id: string;
  subjectId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string;
  slotType: string;
  subject: Subject;
}

interface DeleteSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  slotsToDelete: TimetableSlot[];
  dayName: string;
  onConfirmDelete: (options: {
    scope: "this_day_only" | "all_occurrences";
    preserveHistory: boolean;
  }) => Promise<void>;
}

export const DeleteSlotModal: React.FC<DeleteSlotModalProps> = ({
  isOpen,
  onClose,
  slotsToDelete,
  dayName,
  onConfirmDelete,
}) => {
  const [scope, setScope] = useState<"this_day_only" | "all_occurrences">("this_day_only");
  const [preserveHistory, setPreserveHistory] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || slotsToDelete.length === 0) return null;

  const isSingle = slotsToDelete.length === 1;
  const singleSlot = slotsToDelete[0];
  const subjectName = isSingle ? singleSlot.subject?.name : `${slotsToDelete.length} lectures`;

  const handleAction = async (forcePreserve?: boolean) => {
    setIsDeleting(true);
    try {
      await onConfirmDelete({
        scope,
        preserveHistory: forcePreserve !== undefined ? forcePreserve : preserveHistory,
      });
      onClose();
    } catch (err) {
      console.error("Failed to delete slot(s):", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">Delete lectures?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isSingle ? (
                  <>
                    Removing <span className="font-semibold text-foreground">{singleSlot.subject?.name}</span> ({formatTimeRange(singleSlot.startTime, singleSlot.endTime)})
                  </>
                ) : (
                  <>Removing {slotsToDelete.length} selected lectures from your timetable.</>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-2 space-y-4">
          {/* Scope Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Deletion Scope
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setScope("this_day_only")}
                className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  scope === "this_day_only"
                    ? "border-teal-500/60 bg-teal-500/10 text-teal-600 dark:text-teal-400 ring-1 ring-teal-500/30"
                    : "border-border bg-muted/40 hover:bg-muted/70 text-foreground"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Calendar className="w-4 h-4" />
                  <span>This Day Only</span>
                </div>
                <span className="text-[11px] text-muted-foreground mt-1 font-normal">
                  Remove only on {dayName}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setScope("all_occurrences")}
                className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  scope === "all_occurrences"
                    ? "border-teal-500/60 bg-teal-500/10 text-teal-600 dark:text-teal-400 ring-1 ring-teal-500/30"
                    : "border-border bg-muted/40 hover:bg-muted/70 text-foreground"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CalendarRange className="w-4 h-4" />
                  <span>All Days</span>
                </div>
                <span className="text-[11px] text-muted-foreground mt-1 font-normal">
                  Remove all weekly occurrences
                </span>
              </button>
            </div>
          </div>

          {/* Safe Delete Description Banner */}
          <div className="p-3.5 bg-muted/50 rounded-2xl border border-border/80 text-xs text-muted-foreground space-y-1.5">
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <ShieldCheck className="w-4 h-4 text-teal-500" />
              <span>Safe Delete Protection</span>
            </div>
            <p className="leading-relaxed">
              Use <strong className="text-teal-600 dark:text-teal-400 font-semibold">SAFE DELETE</strong> to delete the lectures from the timetable while keeping any previously recorded attendance and statistics.
            </p>
          </div>
        </div>

        {/* Actions matching Screenshot 2 */}
        <div className="p-6 pt-4 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleAction(false)}
            disabled={isDeleting}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => handleAction(true)}
            disabled={isDeleting}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-bold bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Safe Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};
