import React, { useState, useEffect } from "react";
import { X, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { useAuthStore } from "../../stores/authStore";

interface SubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
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

export const SubjectModal: React.FC<SubjectModalProps> = ({ isOpen, onClose, onSuccess, subject }) => {
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
      toast.error("Subject name is required");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        name: name.trim(),
        code: code.trim() || undefined,
        faculty: faculty.trim() || undefined,
        colorHex,
        targetAttendance: targetAttendance !== "" ? Number(targetAttendance) : null,
      };

      if (subject?.id) {
        await api.patch(`/subjects/${subject.id}`, payload);
        toast.success("Subject updated successfully");
      } else {
        await api.post("/subjects", payload);
        toast.success("Subject created successfully");
      }

      // Notify other components that attendance-related data changed
      window.dispatchEvent(new Event("attendance-updated"));
      
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Failed to save subject:", error);
      toast.error(error.response?.data?.error || "Failed to save subject");
    } finally {
      setIsSubmitting(false);
    }
  };

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
            className="relative w-full max-w-md bg-card border border-border rounded-3xl shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between p-6 pb-4 border-b border-border/50">
              <h2 className="text-xl font-bold text-foreground">
                {subject ? "Edit Subject" : "New Subject"}
              </h2>
              <button
                onClick={onClose}
                className="p-2 -mr-2 rounded-full text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Subject Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Digital Design"
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
                    placeholder="e.g. ECSE303"
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Faculty</label>
                  <input
                    type="text"
                    value={faculty}
                    onChange={(e) => setFaculty(e.target.value)}
                    placeholder="e.g. SAK"
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
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={targetAttendance}
                  onChange={(e) => setTargetAttendance(e.target.value ? Number(e.target.value) : "")}
                  placeholder="Leave empty for global target"
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                />
                <p className="text-xs text-muted-foreground">
                  Overrides the global target for this specific subject in the forecast engine.
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Color Theme</label>
                <div className="flex flex-wrap gap-3">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setColorHex(color)}
                      className="relative w-10 h-10 rounded-full transition-transform hover:scale-110 focus:outline-none"
                      style={{ backgroundColor: color }}
                    >
                      {colorHex === color && (
                        <Check className="absolute inset-0 m-auto text-white w-5 h-5 drop-shadow-md" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
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
