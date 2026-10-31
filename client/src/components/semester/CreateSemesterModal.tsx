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
  Calendar,
  Plus,
  X,
  Loader2,
  Sparkles,
  Check
} from "lucide-react";

interface Semester {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface CreateSemesterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newSemester?: any) => void;
}

export const CreateSemesterModal: React.FC<CreateSemesterModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  useScrollLock(isOpen);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loadingSemesters, setLoadingSemesters] = useState(false);

  // Form fields
  const [year, setYear] = useState("1");
  const [semesterOption, setSemesterOption] = useState("1");
  
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const dateIn4Months = new Date(new Date().setMonth(new Date().getMonth() + 4));
  const defaultEndMonth = dateIn4Months.toISOString().slice(0, 7);
  
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [endMonth, setEndMonth] = useState(defaultEndMonth);
  const [autoSyncTemplates, setAutoSyncTemplates] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  const fetchSemesters = async () => {
    try {
      setLoadingSemesters(true);
      const res = await api.get("/semesters");
      setSemesters(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch semesters:", err);
    } finally {
      setLoadingSemesters(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSemesters();
    }
  }, [isOpen]);

  // Update semester options when year changes
  useEffect(() => {
    const y = parseInt(year);
    setSemesterOption(String(y * 2 - 1)); // default to odd semester for that year
  }, [year]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsCreating(true);

    const suffix = year === "1" ? "st" : year === "2" ? "nd" : year === "3" ? "rd" : "th";
    const generatedName = `Semester ${semesterOption} (${year}${suffix} Year)`;

    // Calculate dates
    const startDate = `${startMonth}-01`;
    const [endY, endM] = endMonth.split("-");
    const lastDay = new Date(parseInt(endY), parseInt(endM), 0).getDate();
    const endDate = `${endMonth}-${lastDay.toString().padStart(2, "0")}`;

    try {
      const res = await api.post("/semesters", {
        name: generatedName,
        startDate,
        endDate,
        isActive: true,
      });
      const newSemester = res.data;

      useCacheStore.getState().setCache("semester", {
        ...useCacheStore.getState().semester,
        activeSemester: newSemester,
      });
      useAttendanceStore.setState({
        activeSemesterId: newSemester.id,
        hasActiveSemester: true,
      });

      SoundFX.playShockwaveSound();
      hapticSuccess();
      triggerDynamicHUD({ type: "cap", label: "Semester Created & Active!" });
      triggerShockwaveCelebration({
        title: newSemester.name,
        subtitle: "Academic Calendar & Schedule Active",
      });
      onClose();
      onSuccess(newSemester);
      useAttendanceStore.getState().fetchStats(true);
      window.dispatchEvent(new Event("attendance-updated"));
      window.dispatchEvent(new Event("timetable-updated"));
      window.dispatchEvent(new Event("events-updated"));
      window.dispatchEvent(new Event("semester-updated"));

      // Background non-blocking template sync (batch-optimized)
      if (autoSyncTemplates && newSemester?.id) {
        const semNum = parseInt(semesterOption);
        const startYear = parseInt(startMonth.split("-")[0]) || new Date().getFullYear();
        api.post("/events/templates/sync", {
          semesterId: newSemester.id,
          semesterNumber: semNum,
          syncHolidayList: true,
          syncAcademicCalendar: true,
          year: startYear,
        })
          .then(() => {
            toast.success("Official academic calendar and holidays synced!");
            window.dispatchEvent(new CustomEvent("attendance-updated", { detail: { source: "template-sync" } }));
          })
          .catch((syncErr) => {
            console.warn("Failed to auto-sync templates for new semester:", syncErr);
          });
      }
    } catch (err: any) {
      console.error("Failed to create semester", err);
      setError(err?.response?.data?.message || "Failed to create semester. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      const res = await api.patch(`/semesters/${id}/activate`);
      const activatedSemester = res.data || semesters.find((s) => s.id === id) || { id, isActive: true };

      useCacheStore.getState().setCache("semester", {
        ...useCacheStore.getState().semester,
        activeSemester: activatedSemester,
      });
      useAttendanceStore.setState({
        activeSemesterId: activatedSemester.id,
        hasActiveSemester: true,
      });

      SoundFX.playShockwaveSound();
      hapticSuccess();
      triggerDynamicHUD({ type: "cap", label: "Semester Activated!" });
      triggerShockwaveCelebration({
        title: activatedSemester.name || "Semester Activated!",
        subtitle: "Schedule & Attendance Tracking Resumed",
      });
      onClose();
      onSuccess(activatedSemester);
      useAttendanceStore.getState().fetchStats(true);
      window.dispatchEvent(new Event("attendance-updated"));
      window.dispatchEvent(new Event("timetable-updated"));
      window.dispatchEvent(new Event("events-updated"));
      window.dispatchEvent(new Event("semester-updated"));
    } catch (err) {
      console.error("Failed to activate semester", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="relative w-full max-w-lg bg-card text-card-foreground border border-border/80 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto space-y-5 transition-colors">
        
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight truncate">Create Active Semester</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
                Define start and end dates to enable timetable & attendance tracking
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-foreground bg-muted/80 hover:bg-muted border border-border p-2 rounded-full transition-colors cursor-pointer shadow-sm shrink-0 ml-2"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Existing inactive semesters list (if any) */}
        {semesters.filter((s) => !s.isActive).length > 0 && (
          <div className="space-y-2 bg-muted/30 p-3.5 sm:p-4 rounded-2xl border border-border/60">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
              Or Activate Existing Semester
            </h3>
            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {semesters
                .filter((s) => !s.isActive)
                .map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-card border border-border/60 text-sm text-foreground shadow-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-foreground truncate block sm:inline">{s.name}</span>
                      <span className="text-muted-foreground sm:ml-2 text-xs font-mono block sm:inline">
                        ({new Date(s.startDate).toLocaleDateString()} -{" "}
                        {new Date(s.endDate).toLocaleDateString()})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleActivate(s.id)}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary font-semibold text-xs transition-colors cursor-pointer shrink-0 w-full sm:w-auto"
                    >
                      <Check className="w-3.5 h-3.5 text-primary" />
                      Activate
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono mb-2">
                Year
              </label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border/70 bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all shadow-xs cursor-pointer"
              >
                <option value="1" className="bg-card text-foreground">1st Year</option>
                <option value="2" className="bg-card text-foreground">2nd Year</option>
                <option value="3" className="bg-card text-foreground">3rd Year</option>
                <option value="4" className="bg-card text-foreground">4th Year</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono mb-2">
                Semester
              </label>
              <select
                value={semesterOption}
                onChange={(e) => setSemesterOption(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border/70 bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all shadow-xs cursor-pointer"
              >
                <option value={String(parseInt(year) * 2 - 1)} className="bg-card text-foreground">
                  Semester {parseInt(year) * 2 - 1}
                </option>
                <option value={String(parseInt(year) * 2)} className="bg-card text-foreground">
                  Semester {parseInt(year) * 2}
                </option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono mb-2">
                Start Month
              </label>
              <input
                type="month"
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border/70 bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all shadow-xs [color-scheme:light] dark:[color-scheme:dark]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono mb-2">
                End Month
              </label>
              <input
                type="month"
                value={endMonth}
                onChange={(e) => setEndMonth(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border/70 bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all shadow-xs [color-scheme:light] dark:[color-scheme:dark]"
                required
              />
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
            className="flex items-start gap-3 p-3.5 rounded-2xl bg-muted/40 border border-border/60 hover:border-primary/40 cursor-pointer transition-colors select-none"
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
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Auto-sync official academic calendar & holidays</span>
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Pre-loads official exams, breaks, and holidays matching Semester {semesterOption} from backend
              </p>
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 p-3 rounded-xl border border-destructive/20 font-medium">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="flex-[1.4] sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-md shadow-primary/25 disabled:opacity-50 cursor-pointer"
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Plus className="w-4 h-4 shrink-0" />
              )}
              <span>Create & Activate</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
