import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Loader2, Users, Plus, Hash, LogIn } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";

interface Classroom {
  id: string;
  name: string;
  section?: string;
  joinCode: string;
  userRole: "admin" | "member";
  _count: { members: number };
  createdBy: { name: string };
}

export const ClassroomsPage = () => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals state
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchClassrooms = async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/classrooms");
      setClassrooms(res.data);
    } catch (error) {
      console.error("Failed to fetch classrooms:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClassrooms();
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput) return;
    try {
      setIsSubmitting(true);
      await api.post("/classrooms/join", { joinCode: joinCodeInput });
      setShowJoinModal(false);
      setJoinCodeInput("");
      fetchClassrooms();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to join classroom");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName) return;
    try {
      setIsSubmitting(true);
      await api.post("/classrooms/create", { name: newClassName });
      setShowCreateModal(false);
      setNewClassName("");
      fetchClassrooms();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create classroom");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto w-full pb-24 md:pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Classrooms</h1>
          <p className="text-sm text-muted-foreground mt-1">Join a class to sync timetables and announcements.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={() => setShowJoinModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            <LogIn className="w-4 h-4" />
            Join
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary/10 text-primary hover:bg-primary/20 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Create
          </button>
        </div>
      </div>

      {classrooms.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-2">No classrooms yet</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mb-6">
            Join your class group to get synced timetables, and announcements.
          </p>
          <button 
            onClick={() => setShowJoinModal(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-lg transition-colors font-medium"
          >
            Join a Classroom
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {classrooms.map(cls => (
            <Link 
              key={cls.id}
              to={`/classrooms/${cls.id}`}
              className="group p-5 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-300 block shadow-sm"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    {cls.name}
                  </h3>
                  {cls.section && <p className="text-sm text-muted-foreground">Section {cls.section}</p>}
                </div>
                {cls.userRole === "admin" && (
                  <span className="bg-primary/20 text-primary text-[10px] uppercase font-bold px-2 py-0.5 rounded tracking-wider">
                    Admin
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  {cls._count.members} Members
                </div>
                {cls.userRole === "admin" && (
                  <div className="flex items-center gap-1.5">
                    <Hash className="w-4 h-4" />
                    Code: <span className="font-mono text-white">{cls.joinCode}</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Join Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-foreground mb-4">Join Classroom</h3>
            <form onSubmit={handleJoin}>
              <div className="mb-4">
                <label className="block text-sm text-muted-foreground mb-2">Enter 6-digit Join Code</label>
                <input 
                  type="text" 
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="w-full bg-background border border-border rounded-xl p-3 text-foreground font-mono text-center tracking-widest text-xl focus:border-primary outline-none transition-colors uppercase"
                  
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowJoinModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors disabled:opacity-50">Join</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-foreground mb-4">Create Classroom</h3>
            <form onSubmit={handleCreate}>
              <div className="mb-4">
                <label className="block text-sm text-muted-foreground mb-2">Classroom Name</label>
                <input 
                  type="text" 
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl p-3 text-foreground focus:border-primary outline-none transition-colors"
                  
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors disabled:opacity-50">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
