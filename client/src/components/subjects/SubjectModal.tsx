import React, { useState, useEffect } from "react";
import { X, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { useAuthStore } from "../../stores/authStore";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { Stepper } from "../ui/stepper";
import { useScrollLock } from "../../hooks/useScrollLock";
import { hapticMedium, hapticSuccess, hapticError, hapticSelection } from "../../utils/haptics";
import { SoundFX } from "../../utils/soundEffects";
import { triggerDynamicHUD } from "../ui/dynamic-island-hud";

interface SubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newSubject?: any) => void;
  semesterId?: string;
  subject?: {
    id: string;
    name: string;
    code?: string;
    faculty?: string;
    colorHex?: string;
    targetAttendance?: number;
  } | null;
}

const COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#f43f5e"];

export const SubjectModal: React.FC<SubjectModalProps> = ({ isOpen, onClose, onSuccess, semesterId, subject }) => {
  useScrollLock(isOpen);
  const { user } = useAuthStore();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [faculty, setFaculty] = useState("");
  const [colorHex, setColorHex] = useState(COLORS[0]);
  const [targetAttendance, setTargetAttendance] = useState<number | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (subject) {
        setName(subject.name);
        setCode(subject.code || "");
        setFaculty(subject.faculty || "");
        setColorHex(subject.colorHex || COLORS[0]);
        setTargetAttendance(subject.targetAttendance || "");
      } else {
        setName("");
        setCode("");
        setFaculty("");
        setColorHex(COLORS[0]);
        setTargetAttendance("");
      }
    }
  }, [isOpen, subject]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      hapticError();
      toast.error("Subject name is required");
      return;
    }

    try {
      hapticMedium();
      setIsSubmitting(true);
      const targetSemId = semesterId || useAttendanceStore.getState().activeSemesterId || undefined;
      const payload: any = {
        name: name.trim(),
        code: code.trim() || undefined,
        faculty: faculty.trim() || undefined,
        colorHex,
        targetAttendance: targetAttendance !== "" ? Number(targetAttendance) : null,
        ...(targetSemId ? { semesterId: targetSemId } : {}),
      };

      let savedSubject: any = null;
      if (subject?.id) {
        const res = await api.patch(`/subjects/${subject.id}`, payload);
        savedSubject = res.data;
        hapticSuccess();
        SoundFX.playSnapPopSound();
        triggerDynamicHUD({ type: "sparkle", label: "Subject Updated" });
      } else {
        const res = await api.post("/subjects", payload);
        savedSubject = res.data;
        hapticSuccess();
        SoundFX.playSnapPopSound();
        triggerDynamicHUD({ type: "sparkle", label: "Subject Created" });
      }

      onSuccess(savedSubject);
      onClose();
      // Notify other components in background without race-canceling local state
      setTimeout(() => {
        window.dispatchEvent(new Event("attendance-updated"));
      }, 350);
    } catch (error: any) {
      hapticError();
      console.error("Failed to save subject:", error);
      toast.error(error.response?.data?.error || "Failed to save subject");
    } finally {
      setIsSubmitting(false);
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

  return (
    <AnimatePresence>
      {isOpen && (
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
            className="relative w-full max-w-md bg-card border border-border rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between p-4 sm:p-6 pb-4 border-b border-border/50 shrink-0">
              <h2 className="text-xl font-bold text-foreground">
                {subject ? "Edit Subject" : "New Subject"}
              </h2>
              <button
                onClick={onClose}
                className="p-2 -mr-1 rounded-full text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Subject Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  
                  required
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Course Code</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Faculty</label>
                  <input
                    type="text"
                    value={faculty}
                    onChange={(e) => setFaculty(e.target.value)}
                    
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">Target Attendance (%)</label>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    Global: {user?.targetAttendance ?? 75}%
                  </span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="flex-1 min-w-0">
                    <Stepper 
                      min={0} 
                      max={100} 
                      value={targetAttendance === "" ? (user?.targetAttendance ?? 75) : targetAttendance} 
                      onChange={setTargetAttendance} 
                    />
                  </div>
                  {targetAttendance !== "" && (
                    <button
                      type="button"
                      onClick={() => setTargetAttendance("")}
                      className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-muted-foreground text-xs font-semibold rounded-lg transition-colors shrink-0 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Overrides the global target for this specific subject in the forecast engine.
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Color Theme</label>
                <div className="flex flex-wrap gap-2.5 sm:gap-3">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        hapticSelection();
                        setColorHex(color);
                      }}
                      className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full transition-transform hover:scale-110 focus:outline-none cursor-pointer"
                      style={{ backgroundColor: color }}
                    >
                      {colorHex === color && (
                        <Check className="absolute inset-0 m-auto text-white w-4 h-4 sm:w-5 sm:h-5 drop-shadow-md" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-border/40 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[1.4] sm:flex-none px-5 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-foreground hover:bg-foreground/90 text-background transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-black/10 dark:shadow-white/10 cursor-pointer"
                >
                  {isSubmitting ? "Saving..." : "Save Subject"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
