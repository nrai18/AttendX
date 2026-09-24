import React, { useEffect, useState } from "react";
import { format, isPast, isToday } from "date-fns";
import { useAssignmentStore } from "../../stores/assignmentStore";
import { Plus, Check, Clock, AlertCircle, Trash2 } from "lucide-react";
import { BottomNav } from "../../components/layout/BottomNav";
import { AddAssignmentModal } from "./AddAssignmentModal";

export function AssignmentsPage() {
  const { assignments, fetchAssignments, toggleCompletion, deleteAssignment } = useAssignmentStore();
  const [isAddOpen, setIsAddOpen] = useState(false);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-slate-50 pb-32">
      <header className="pt-12 pb-6 px-6 bg-white/95 dark:bg-[#111111]/95 backdrop-blur-md sticky top-0 z-10 border-b-2 border-slate-300 dark:border-[#333333]">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Assignments</h1>
          <button 
            onClick={() => setIsAddOpen(true)}
            className="p-3 bg-[#E63946] text-slate-50 rounded-none border-2 border-[#E63946] hover:bg-[#E63946]/90 transition-all shadow-[4px_4px_0_0_rgba(230,57,70,0.3)] font-bold"
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
          assignments.map((assignment) => (
            <div 
              key={assignment.id} 
              className={`p-5 rounded-none border-2 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0_0_rgba(255,255,255,0.05)] flex items-start gap-4 transition-all ${assignment.completions?.length ? "bg-slate-100 dark:bg-[#1A1A1A] border-slate-300 dark:border-[#333333] opacity-60" : "bg-white dark:bg-[#111111] border-slate-300 dark:border-[#333333] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_rgba(0,0,0,0.1)] dark:hover:shadow-[6px_6px_0_0_rgba(255,255,255,0.05)]"}`}
            >
              <button 
                onClick={() => toggleCompletion(assignment.id)}
                className={`mt-1 flex-shrink-0 w-6 h-6 rounded-none border-2 flex items-center justify-center transition-colors
                  ${assignment.completions?.length ? "bg-[#E63946] border-[#E63946] text-white" : "border-slate-300 dark:border-[#333333] hover:border-[#E63946]/50 bg-white dark:bg-[#111111]"}
                `}
              >
                {assignment.completions?.length ? <Check size={14} stroke="currentColor" /> : null}
              </button>
              
              <div className="flex-1">
                <h3 className={`font-semibold ${assignment.completions?.length ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {assignment.title}
                </h3>
                {assignment.description && (
                  <p className="text-sm text-muted-foreground mt-1">{assignment.description}</p>
                )}
                <div className="flex items-center gap-2 mt-3 text-xs font-medium text-muted-foreground">
                  <Clock size={12} />
                  <span>{format(new Date(assignment.deadline), "MMM d, h:mm a")}</span>
                  {isPast(new Date(assignment.deadline)) && !assignment.completions?.length && (
                    <span className="text-rose-500 font-bold flex items-center gap-1 ml-2">
                      <AlertCircle size={12} /> Overdue
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteAssignment(assignment.id);
                }}
                className="text-muted-foreground hover:text-[#E63946] p-1.5 transition-colors self-center"
                title="Delete assignment"
                aria-label="Delete assignment"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </main>

      <AddAssignmentModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
      <BottomNav />
    </div>
  );
}



