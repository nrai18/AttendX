import React, { useEffect, useState } from "react";
import { format, isPast } from "date-fns";
import { useAssignmentStore } from "../../stores/assignmentStore";
import { Plus, Check, Clock, AlertCircle, Trash2, Send } from "lucide-react";
import { AddAssignmentModal } from "./AddAssignmentModal";
import { motion, AnimatePresence } from "framer-motion";
import { SoundFX } from "../../utils/soundEffects";
import { triggerDynamicHUD } from "../../components/ui/dynamic-island-hud";
import { confirmDeleteToast } from "../../components/ui/confirm-delete-toast";
import { hapticHeavy, hapticLight, hapticSuccess } from "../../utils/haptics";

const safeFormatDeadline = (deadlineStr?: string | null): string => {
  if (!deadlineStr) return "No deadline set";
  try {
    const d = new Date(deadlineStr);
    if (isNaN(d.getTime())) return "Invalid deadline";
    return format(d, "MMM d, h:mm a");
  } catch {
    return "Invalid deadline";
  }
};

const safeIsOverdue = (deadlineStr?: string | null): boolean => {
  if (!deadlineStr) return false;
  try {
    const d = new Date(deadlineStr);
    if (isNaN(d.getTime())) return false;
    return isPast(d);
  } catch {
    return false;
  }
};

export function AssignmentsPage() {
  const { assignments, fetchAssignments, toggleCompletion, deleteAssignment } = useAssignmentStore();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [flyingPlaneId, setFlyingPlaneId] = useState<string | null>(null);
  const [flutterDeletingId, setFlutterDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleToggle = (id: string, isCurrentlyDone: boolean) => {
    if (flyingPlaneId || flutterDeletingId) return;

    if (isCurrentlyDone) {
      // Unchecking: instant toggle with light haptic
      hapticLight();
      toggleCompletion(id);
      return;
    }

    // Checking: Paper Aeroplane Flight celebration (Mesmerizing 4.2s flight)
    setFlyingPlaneId(id);
    SoundFX.playPaperAirplaneSound();
    hapticSuccess();
    triggerDynamicHUD({ type: "plane", label: "Assignment Completed!", durationMs: 4500 });

    setTimeout(() => {
      toggleCompletion(id);
      setFlyingPlaneId(null);
    }, 4200);
  };

  const handleDelete = (assignment: any) => {
    if (flutterDeletingId || flyingPlaneId) return;

    confirmDeleteToast({
      title: "Delete Assignment",
      description: "Are you sure you want to remove this assignment from your deadlines?",
      itemName: assignment.title,
      confirmLabel: "Delete Assignment",
      onConfirm: async () => {
        setFlutterDeletingId(assignment.id);
        SoundFX.playButterflyFlutterSound();
        hapticHeavy();
        triggerDynamicHUD({ type: "butterfly", label: "Assignment Removed", durationMs: 4500 });

        setTimeout(() => {
          deleteAssignment(assignment.id);
          setFlutterDeletingId(null);
        }, 4200);
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-slate-50 pb-32">
      <header className="pt-12 pb-6 px-6 bg-white/95 dark:bg-[#111111]/95 backdrop-blur-md sticky top-0 z-10 border-b-2 border-slate-300 dark:border-[#333333]">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Assignments</h1>
          <button 
            onClick={() => setIsAddOpen(true)}
            className="p-3 bg-[#E63946] text-slate-50 rounded-none border-2 border-[#E63946] hover:bg-[#E63946]/90 transition-all shadow-[4px_4px_0_0_rgba(230,57,70,0.3)] font-bold active:translate-y-0.5"
            aria-label="Add Assignment"
          >
            <Plus size={24} />
          </button>
        </div>
      </header>

      <main className="p-6 space-y-4">
        {assignments.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <Clock size={48} className="mx-auto mb-4 opacity-50" />
            <p>No assignments found.</p>
            <p className="text-sm">Tap + to add your first deadline.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {assignments.map((assignment) => {
                const isCompleted = Boolean(assignment.completions?.length);
                const isFlying = flyingPlaneId === assignment.id;
                const isFluttering = flutterDeletingId === assignment.id;

                return (
                  <motion.div 
                    key={assignment.id} 
                    layout
                    initial={{ opacity: 0, y: -24, scale: 0.94 }}
                    animate={
                      isFlying
                        ? {
                            x: [0, -12, 60, 220, 380],
                            y: [0, 14, -45, -95, -160],
                            rotate: [0, -8, 14, 24, 30],
                            skewX: [0, -10, -16, -20, -22],
                            scale: [1, 1.05, 0.92, 0.68, 0.2],
                            opacity: [1, 1, 0.95, 0.8, 0],
                            boxShadow: "0 25px 45px rgba(16, 185, 129, 0.45)",
                          }
                        : isFluttering
                        ? {
                            rotate: [-1, 14, -14, 18, -16, 12, 0],
                            scale: [1, 0.95, 0.8, 0.6, 0.35, 0.1, 0],
                            x: [0, -15, 25, -35, 45, -60, -90],
                            y: [0, -10, 12, -18, 22, 10, -30],
                            opacity: [1, 0.95, 0.85, 0.7, 0.45, 0.2, 0],
                            filter: ["blur(0px)", "blur(0.5px)", "blur(1.5px)", "blur(3px)", "blur(5px)"],
                          }
                        : {
                            opacity: 1,
                            y: 0,
                            x: 0,
                            scale: 1,
                            rotate: 0,
                            skewX: 0,
                            filter: "blur(0px)",
                          }
                    }
                    exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.3 } }}
                    transition={{
                      duration: isFlying ? 4.1 : isFluttering ? 4.0 : 0.3,
                      ease: "easeInOut",
                    }}
                    className={`relative overflow-hidden p-5 rounded-none border-2 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0_0_rgba(255,255,255,0.05)] flex items-start gap-4 transition-colors ${
                      isCompleted 
                        ? "bg-slate-100 dark:bg-[#1A1A1A] border-slate-300 dark:border-[#333333] opacity-60" 
                        : "bg-white dark:bg-[#111111] border-slate-300 dark:border-[#333333] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_rgba(0,0,0,0.1)] dark:hover:shadow-[6px_6px_0_0_rgba(255,255,255,0.05)]"
                    }`}
                  >
                    {/* Visual paper airplane flying overlay during flight */}
                    {isFlying && (
                      <motion.div
                        initial={{ opacity: 0, x: -20, y: 15, scale: 0.6 }}
                        animate={{
                          opacity: [0, 1, 1, 1, 0],
                          x: [-20, 80, 190, 320, 420],
                          y: [15, -25, -60, -110, -170],
                          scale: [0.6, 1.25, 1.45, 1.35, 0.8],
                          rotate: [35, 45, 55, 40, 45],
                        }}
                        transition={{ duration: 4.0, ease: "easeInOut", times: [0, 0.2, 0.55, 0.85, 1] }}
                        className="pointer-events-none absolute z-20 text-emerald-500 drop-shadow-[0_0_12px_rgba(16,185,129,0.9)]"
                      >
                        <Send size={32} />
                      </motion.div>
                    )}

                    <button 
                      disabled={isFlying || isFluttering}
                      onClick={() => handleToggle(assignment.id, isCompleted)}
                      className={`mt-1 flex-shrink-0 w-6 h-6 rounded-none border-2 flex items-center justify-center transition-all ${
                        isCompleted 
                          ? "bg-[#E63946] border-[#E63946] text-white" 
                          : "border-slate-300 dark:border-[#333333] hover:border-[#E63946]/50 bg-white dark:bg-[#111111]"
                      } ${isFlying ? "opacity-60 cursor-not-allowed" : ""}`}
                      aria-label={isCompleted ? "Mark incomplete" : "Mark complete"}
                    >
                      {isCompleted ? <Check size={14} stroke="currentColor" /> : null}
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold break-words ${isCompleted ? "text-muted-foreground line-through" : "text-foreground"}`}>
                        {assignment.title}
                      </h3>
                      {assignment.description && (
                        <p className="text-sm text-muted-foreground mt-1 break-words">{assignment.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-3 text-xs font-medium text-muted-foreground flex-wrap">
                        <Clock size={12} className="flex-shrink-0" />
                        <span>{safeFormatDeadline(assignment.deadline)}</span>
                        {safeIsOverdue(assignment.deadline) && !isCompleted && (
                          <span className="text-rose-500 font-bold flex items-center gap-1 ml-2">
                            <AlertCircle size={12} /> Overdue
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      disabled={isFlying || isFluttering}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(assignment);
                      }}
                      className="text-muted-foreground hover:text-[#E63946] p-1.5 transition-colors self-center flex-shrink-0 disabled:opacity-40"
                      title="Delete assignment"
                      aria-label="Delete assignment"
                    >
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>

      <AddAssignmentModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </div>
  );
}
