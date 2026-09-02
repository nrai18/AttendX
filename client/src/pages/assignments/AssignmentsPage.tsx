import React, { useEffect, useState } from "react";
import { format, isPast, isToday } from "date-fns";
import { useAssignmentStore } from "../../stores/assignmentStore";
import { Plus, Check, Clock, AlertCircle } from "lucide-react";
import { BottomNav } from "../../components/layout/BottomNav";
import { AddAssignmentModal } from "./AddAssignmentModal";

export function AssignmentsPage() {
  const { assignments, fetchAssignments, toggleCompletion } = useAssignmentStore();
  const [isAddOpen, setIsAddOpen] = useState(false);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  return (
    <div className="min-h-screen bg-neutral-900 text-white pb-24">
      <header className="pt-12 pb-6 px-6 bg-neutral-900 sticky top-0 z-10 border-b border-white/10">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Assignments</h1>
          <button 
            onClick={() => setIsAddOpen(true)}
            className="p-2 bg-violet-600 rounded-full hover:bg-violet-700 transition"
          >
            <Plus size={24} />
          </button>
        </div>
      </header>

      <main className="p-6 space-y-4">
        {assignments.length === 0 ? (
          <div className="text-center text-neutral-400 py-12">
            <Clock size={48} className="mx-auto mb-4 opacity-50" />
            <p>No assignments found.</p>
            <p className="text-sm">Tap + to add your first deadline.</p>
          </div>
        ) : (
          assignments.map((assignment) => (
            <div 
              key={assignment.id} 
              className={`p-4 rounded-xl border ${assignment.completions?.length ? "bg-green-900/20 border-green-500/30" : "bg-neutral-800 border-white/10"} flex items-start gap-4`}
            >
              <button 
                onClick={() => toggleCompletion(assignment.id)}
                className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center
                  ${assignment.completions?.length ? "bg-green-500 border-green-500" : "border-neutral-500"}
                `}
              >
                {assignment.completions?.length ? <Check size={14} className="text-white" /> : null}
              </button>
              
              <div className="flex-1">
                <h3 className={`font-semibold ${assignment.completions?.length ? "text-neutral-400 line-through" : "text-white"}`}>
                  {assignment.title}
                </h3>
                {assignment.description && (
                  <p className="text-sm text-neutral-400 mt-1">{assignment.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2 text-xs font-medium text-violet-400">
                  <Clock size={12} />
                  <span>{format(new Date(assignment.deadline), "MMM d, h:mm a")}</span>
                  {isPast(new Date(assignment.deadline)) && !assignment.completions?.length && (
                    <span className="text-red-400 flex items-center gap-1 ml-2">
                      <AlertCircle size={12} /> Overdue
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </main>

      <AddAssignmentModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
      <BottomNav />
    </div>
  );
}
