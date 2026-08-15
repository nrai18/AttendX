import React, { useState } from "react";
import { Trash2, AlertTriangle, ShieldCheck, Loader2, X } from "lucide-react";

interface ClearTimetableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  semesterName?: string;
}

export const ClearTimetableModal: React.FC<ClearTimetableModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  semesterName = "Active Semester",
}) => {
  const [isClearing, setIsClearing] = useState(false);

  if (!isOpen) return null;

  const handleClear = async () => {
    setIsClearing(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error("Failed to clear timetable:", err);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-border flex justify-between items-center bg-rose-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Clear All Timetable Slots</h2>
              <p className="text-xs text-muted-foreground">{semesterName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isClearing}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
              This will remove all weekly lecture and lab slots from your schedule for{" "}
              <strong>{semesterName}</strong>.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed font-medium">
              <strong>Your data is safe:</strong> All subjects, credit settings, and past attendance logs will be preserved.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-muted/40 border-t border-border flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isClearing}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={isClearing}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer"
          >
            {isClearing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Clearing Schedule...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Confirm Clear All</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
