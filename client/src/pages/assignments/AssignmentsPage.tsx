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
    <div className="min-h-screen bg-background text-foreground pb-32">
      <header className="pt-12 pb-6 px-6 bg-background/95 backdrop-blur-md sticky top-0 z-10 border-b border-border">
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
          <div className="text-center text-muted-foreground py-12">
            <Clock size={48} className="mx-auto mb-4 opacity-50" />
            <p>No assignments found.</p>
            <p className="text-sm">Tap + to add your first deadline.</p>
          </div>
        ) : (
          assignments.map((assignment) => (
            <div 
              key={assignment.id} 
              className={`p-4 rounded-xl border ${assignment.completions?.length ? "bg-green-900/20 border-green-500/30" : "bg-card border-border"} flex items-start gap-4`}
            >
              <button 
                onClick={() => toggleCompletion(assignment.id)}
                className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center
                  ${assignment.completions?.length ? "bg-green-500 border-green-500" : "border-muted-foreground/50"}
                `}
              >
                {assignment.completions?.length ? <Check size={14} stroke="white" /> : null}
              </button>
              
              <div className="flex-1">
                <h3 className={`font-semibold ${assignment.completions?.length ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {assignment.title}
                </h3>
                {assignment.description && (
                  <p className="text-sm text-muted-foreground mt-1">{assignment.description}</p>
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



