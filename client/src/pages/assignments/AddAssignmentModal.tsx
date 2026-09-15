import React, { useState } from "react";
import { X, Calendar } from "lucide-react";
import { useAssignmentStore } from "../../stores/assignmentStore";

export function AddAssignmentModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { addAssignment } = useAssignmentStore();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState<"high"|"medium"|"low">("medium");
  const [isSubmitting, setIsSubmitting] = useState(false);

  
  // Anti-scroll lock
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !deadline) return;
    
    setIsSubmitting(true);
    await addAssignment({
      title,
      description,
      deadline: new Date(deadline).toISOString(),
      priority,
    });
    // We should also trigger the scheduling
    const { NotificationService } = await import("../../services/NotificationService");
    await NotificationService.scheduleAssignmentReminders();
    
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-white/40 dark:bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="bg-white dark:bg-[#111111] border-2 border-slate-300 dark:border-[#333333] w-full max-w-md rounded-none shadow-[8px_8px_0_0_rgba(0,0,0,0.1)] dark:shadow-[8px_8px_0_0_rgba(255,255,255,0.05)] overflow-hidden animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between p-4 border-b-2 border-slate-300 dark:border-[#333333]">
          <h2 className="text-xl font-semibold">New Assignment</h2>
          <button onClick={onClose} className="p-2 text-slate-600 dark:text-slate-50/60 hover:text-slate-900 dark:text-slate-50 rounded-none bg-slate-50 dark:bg-[#050505]/50 border-2 border-transparent hover:border-slate-300 dark:hover:border-[#333333]">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Title</label>
            <input 
              required
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#050505]/50 border-2 border-slate-300 dark:border-[#333333] rounded-none focus:border-[#E63946] focus:outline-none p-3 text-foreground placeholder:text-muted-foreground"
              placeholder="e.g. Physics Lab Report"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Description (Optional)</label>
            <textarea 
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#050505]/50 border-2 border-slate-300 dark:border-[#333333] rounded-none focus:border-[#E63946] focus:outline-none p-3 text-foreground placeholder:text-muted-foreground h-24"
              placeholder="Details..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Deadline</label>
            <input 
              required
              type="datetime-local" 
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#050505]/50 border-2 border-slate-300 dark:border-[#333333] rounded-none focus:border-[#E63946] focus:outline-none p-3 text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Priority</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-[#050505]/50 border-2 border-slate-300 dark:border-[#333333] rounded-none focus:border-[#E63946] focus:outline-none p-3 text-foreground placeholder:text-muted-foreground"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full py-3.5 bg-[#E63946] hover:bg-[#E63946]/90 text-slate-50 font-bold rounded-none border-2 border-[#E63946] shadow-[4px_4px_0_0_rgba(230,57,70,0.3)] mt-4 disabled:opacity-50 transition-all active:translate-y-1 active:shadow-none"
          >
            {isSubmitting ? "Adding..." : "Add Assignment"}
          </button>
        </form>
      </div>
    </div>
  );
}

