import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { useScrollLock } from "../../hooks/useScrollLock";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { useCacheStore } from "../../stores/cacheStore";
import { SoundFX } from "../../utils/soundEffects";
import { triggerDynamicHUD } from "../ui/dynamic-island-hud";
import { triggerShockwaveCelebration } from "../ui/shockwave-celebration";
import { hapticSuccess } from "../../utils/haptics";
import {
  GraduationCap,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Loader2,
  X,
  CheckCircle2,
  Check
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

      const newSemester = res.data?.semester;

      // Clear all local caches and pending offline sync queue for a completely fresh start
      useCacheStore.getState().clearCache();

      // Immediately activate new semester in frontend stores
      if (newSemester) {
        useAttendanceStore.setState({
          activeSemesterId: newSemester.id,
          hasActiveSemester: true,
          subjects: [],
          totalAttended: 0,
          totalClasses: 0,
          overallPercentage: 0,
        });
        useCacheStore.getState().setCache("semester", {
          activeSemester: newSemester,
        });
      }

      try {
        const { useOfflineStore } = await import("../../stores/offlineStore");
        useOfflineStore.getState().clearQueue();
        const { Preferences } = await import("@capacitor/preferences");
        for (const k of ["attendx-attendance-cache", "attendx-api-cache", "attendx-sync-storage", "attendx-offline-queue"]) {
          Preferences.remove({ key: k }).catch(() => {});
          localStorage.removeItem(k);
        }
      } catch (e) {}

      SoundFX.playShockwaveSound();
      hapticSuccess();
      triggerDynamicHUD({ type: "cap", label: `Welcome to ${nextName}!` });
      triggerShockwaveCelebration({
        title: `Welcome to ${nextName}!`,
        subtitle: "Semester Transition Activated",
      });

      if (onSuccess) onSuccess();
      onClose();
      useAttendanceStore.getState().invalidateInFlightStats();
      useAttendanceStore.getState().fetchStats(true);
      window.dispatchEvent(new Event("semester-updated"));
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-card text-card-foreground border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 pb-4 border-b border-border/60 flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-xs">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-foreground tracking-tight truncate">
                Semester Complete!
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                Reset app data & begin your next semester
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted border border-border/70 rounded-full transition-colors cursor-pointer shadow-xs shrink-0 ml-2"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {loadingStatus ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <p className="text-xs font-medium">Loading semester status...</p>
            </div>
          ) : (
            <form onSubmit={handleTransition} id="transition-form" className="space-y-5">
              {/* Transition Flow Banner */}
              <div className="bg-muted/40 border border-border/70 rounded-2xl p-3.5 flex items-center justify-between gap-2.5 shadow-xs">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">
                    Completed
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-foreground truncate" title={status?.activeSemester?.name || "Current Semester"}>
                    {status?.activeSemester?.name || "Current Semester"}
                  </p>
                </div>
                <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/25 text-primary flex items-center justify-center shrink-0 shadow-xs">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider block mb-0.5">
                    Next Semester
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-primary truncate" title={nextName || "Next Semester"}>
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
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono mb-1.5">
                    New Semester Name
                  </label>
                  <input
                    type="text"
                    required
                    value={nextName}
                    onChange={(e) => setNextName(e.target.value)}
                    placeholder="e.g. Semester 6 (3rd Year)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background text-foreground text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all shadow-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono mb-1.5">
                      Start Date
                    </label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background text-foreground text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all shadow-xs [color-scheme:light] dark:[color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono mb-1.5">
                      End Date
                    </label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background text-foreground text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all shadow-xs [color-scheme:light] dark:[color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-1">
                <div
                  role="checkbox"
                  aria-checked={wipeOldData}
                  tabIndex={0}
                  onClick={() => setWipeOldData(!wipeOldData)}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      setWipeOldData(!wipeOldData);
                    }
                  }}
                  className="flex items-start gap-3 p-3.5 rounded-2xl bg-muted/30 border border-border/70 hover:border-primary/40 hover:bg-muted/50 transition-all cursor-pointer select-none"
                >
                  <div
                    className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                      wipeOldData
                        ? "bg-primary border-primary text-primary-foreground shadow-xs shadow-primary/20"
                        : "border-border/80 bg-background hover:border-muted-foreground/50"
                    }`}
                  >
                    {wipeOldData && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>Reset App Attendance & Timetable</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      Clears previous semester logs so you start with 0% and fresh course targets.
                    </p>
                  </div>
                </div>

                <div
                  role="checkbox"
                  aria-checked={autoSyncTemplates}
                  tabIndex={0}
                  onClick={() => setAutoSyncTemplates(!autoSyncTemplates)}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      setAutoSyncTemplates(!autoSyncTemplates);
                    }
                  }}
                  className="flex items-start gap-3 p-3.5 rounded-2xl bg-muted/30 border border-border/70 hover:border-primary/40 hover:bg-muted/50 transition-all cursor-pointer select-none"
                >
                  <div
                    className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                      autoSyncTemplates
                        ? "bg-primary border-primary text-primary-foreground shadow-xs shadow-primary/20"
                        : "border-border/80 bg-background hover:border-muted-foreground/50"
                    }`}
                  >
                    {autoSyncTemplates && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>Auto-sync Academic Calendar & Holidays</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      Pre-loads official exams, vacations, and government holidays for this semester.
                    </p>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-border/60 bg-muted/20 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl border border-border/80 bg-background/50 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-bold transition-all cursor-pointer text-center"
          >
            Remind Me Later
          </button>
          <button
            type="submit"
            form="transition-form"
            disabled={isSubmitting || loadingStatus || !nextName.trim() || !startDate || !endDate}
            className="flex-[1.4] py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold transition-all shadow-md shadow-primary/25 hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span className="truncate">Transitioning...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="truncate">Reset & Start Semester</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
