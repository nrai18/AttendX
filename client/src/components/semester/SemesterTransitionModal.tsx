import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { useScrollLock } from "../../hooks/useScrollLock";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { useCacheStore } from "../../stores/cacheStore";
import {
  GraduationCap,
  ArrowRight,
  RotateCcw,
  Calendar,
  Sparkles,
  Loader2,
  X,
  CheckCircle2
} from "lucide-react";

interface TransitionStatus {
  hasActiveSemester: boolean;
  activeSemester?: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  };
  currentSemesterNumber?: number;
  currentYearName?: string;
  isSemesterEnded?: boolean;
  isTeachingEnded?: boolean;
  lastTeachingDate?: string | null;
  nextSemester?: {
    semesterNumber: number;
    yearNumber: number;
    yearName: string;
    name: string;
    semesterType: "odd" | "even";
    year: number;
    suggestedStartDate: string;
    suggestedEndDate: string;
  };
}

interface SemesterTransitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialStatus?: TransitionStatus | null;
}

export const SemesterTransitionModal: React.FC<SemesterTransitionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialStatus
}) => {
  useScrollLock(isOpen);
  const [loadingStatus, setLoadingStatus] = useState(!initialStatus);
  const [status, setStatus] = useState<TransitionStatus | null>(initialStatus || null);

  // Form states
  const [nextName, setNextName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [wipeOldData, setWipeOldData] = useState(true);
  const [autoSyncTemplates, setAutoSyncTemplates] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchStatus = async () => {
    try {
      setLoadingStatus(true);
      const res = await api.get("/semesters/transition-status");
      setStatus(res.data);
      if (res.data?.nextSemester) {
        setNextName(res.data.nextSemester.name);
        setStartDate(res.data.nextSemester.suggestedStartDate);
        setEndDate(res.data.nextSemester.suggestedEndDate);
      }
    } catch (err) {
      console.error("Failed to fetch semester transition status:", err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialStatus?.nextSemester) {
        setStatus(initialStatus);
        setNextName(initialStatus.nextSemester.name);
        setStartDate(initialStatus.nextSemester.suggestedStartDate);
        setEndDate(initialStatus.nextSemester.suggestedEndDate);
        setLoadingStatus(false);
      } else {
        fetchStatus();
      }
    }
  }, [isOpen, initialStatus]);

  if (!isOpen) return null;

  const handleTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const res = await api.post("/semesters/transition", {
        nextName,
        startDate,
        endDate,
        semesterNumber: status?.nextSemester?.semesterNumber,
        wipeOldData,
        autoSyncCalendar: autoSyncTemplates,
        autoSyncHolidays: autoSyncTemplates
      });

      // Clear all local caches and pending offline sync queue for a completely fresh start
      useCacheStore.getState().clearCache();
      try {
        const { useOfflineStore } = await import("../../stores/offlineStore");
        useOfflineStore.getState().clearQueue();
        const { Preferences } = await import("@capacitor/preferences");
        for (const k of ["attendx-attendance-cache", "attendx-api-cache", "attendx-sync-storage", "attendx-offline-queue"]) {
          Preferences.remove({ key: k }).catch(() => {});
          localStorage.removeItem(k);
        }
      } catch (e) {}

      toast.success(`Welcome to ${nextName}!`, {
        description: autoSyncTemplates
          ? "Old semester reset & official academic events pre-loaded."
          : "Previous semester reset successfully."
      });

      if (onSuccess) onSuccess();
      onClose();
      useAttendanceStore.getState().fetchStats(true);
      window.dispatchEvent(new Event("attendance-updated"));
      window.dispatchEvent(new Event("timetable-updated"));
      window.dispatchEvent(new Event("events-updated"));
      import("../../services/NotificationService")
        .then((m) => m.NotificationService.autoScheduleFromTimetable())
        .catch(() => {});
    } catch (err: any) {
      console.error("Failed to transition semester:", err);
      setError(err?.response?.data?.message || err?.message || "Failed to complete semester transition.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/60 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white/40 dark:bg-black/60 backdrop-blur-3xl border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border/60 flex items-start justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-sm">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-foreground tracking-tight">
                Semester Complete!
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                Reset app data & begin your next semester
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-foreground bg-muted/80 hover:bg-muted border border-border rounded-full transition-colors cursor-pointer shadow-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loadingStatus ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <p className="text-xs font-medium">Loading semester status...</p>
            </div>
          ) : (
            <form onSubmit={handleTransition} id="transition-form" className="space-y-6">
              {/* Transition Flow Banner */}
              <div className="bg-muted/40 border border-border/60 rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="flex-1 text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Completed
                  </p>
                  <p className="text-sm font-bold text-foreground truncate">
                    {status?.activeSemester?.name || "Current Semester"}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <div className="flex-1 text-center">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">
                    Next Semester
                  </p>
                  <p className="text-sm font-bold text-primary truncate">
                    {nextName || "Next Semester"}
                  </p>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-500 text-xs font-semibold">
                  {error}
                </div>
              )}

              {/* Form Inputs */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5 uppercase tracking-wider">
                    New Semester Name
                  </label>
                  <input
                    type="text"
                    required
                    value={nextName}
                    onChange={(e) => setNextName(e.target.value)}
                    placeholder="e.g. Semester 6 (3rd Year)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border/70 bg-background text-foreground text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-primary/40 transition-all shadow-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5 uppercase tracking-wider">
                      Start Date
                    </label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border/70 bg-background text-foreground text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-primary/40 transition-all shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5 uppercase tracking-wider">
                      End Date
                    </label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border/70 bg-background text-foreground text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-primary/40 transition-all shadow-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-1">
                <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-muted/40 border border-border/60 hover:border-border transition-colors cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={wipeOldData}
                    onChange={(e) => setWipeOldData(e.target.checked)}
                    className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4 shrink-0"
                  />
                  <div>
                    <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                      Reset App Attendance & Timetable
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Clears previous semester logs so you start with 0% and fresh course targets.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-muted/40 border border-border/60 hover:border-border transition-colors cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoSyncTemplates}
                    onChange={(e) => setAutoSyncTemplates(e.target.checked)}
                    className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4 shrink-0"
                  />
                  <div>
                    <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      Auto-sync Academic Calendar & Holidays
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Pre-loads official exams, vacations, and government holidays for this semester.
                    </p>
                  </div>
                </label>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground text-xs font-bold transition-colors cursor-pointer"
          >
            Remind Me Later
          </button>
          <button
            type="submit"
            form="transition-form"
            disabled={isSubmitting || loadingStatus || !nextName}
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold transition-all shadow-md shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Transitioning...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Reset & Start Semester</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
