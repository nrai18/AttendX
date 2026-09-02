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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="bg-neutral-900 border border-white/10 w-full max-w-md rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-xl font-semibold">New Assignment</h2>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-white rounded-full bg-white/5">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Title</label>
            <input 
              required
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-neutral-800 border border-white/10 rounded-lg p-3 text-white"
              placeholder="e.g. Physics Lab Report"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Description (Optional)</label>
            <textarea 
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-neutral-800 border border-white/10 rounded-lg p-3 text-white h-24"
              placeholder="Details..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Deadline</label>
            <input 
              required
              type="datetime-local" 
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="w-full bg-neutral-800 border border-white/10 rounded-lg p-3 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Priority</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as any)}
              className="w-full bg-neutral-800 border border-white/10 rounded-lg p-3 text-white"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-lg mt-4 disabled:opacity-50"
          >
            {isSubmitting ? "Adding..." : "Add Assignment"}
          </button>
        </form>
      </div>
    </div>
  );
}
