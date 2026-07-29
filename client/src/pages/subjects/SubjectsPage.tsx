import React, { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Loader2, AlertCircle } from "lucide-react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";

interface Subject {
  id: string;
  name: string;
  code?: string;
  faculty?: string;
  colorHex?: string;
  _count?: { attendance: number };
}

export const SubjectsPage = () => {
  const { user } = useAuthStore();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [faculty, setFaculty] = useState("");
  const [colorHex, setColorHex] = useState("#8b5cf6");

  const fetchSubjects = async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/subjects");
      setSubjects(res.data);
    } catch (error) {
      console.error("Failed to fetch subjects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const resetForm = () => {
    setName("");
    setCode("");
    setFaculty("");
    setColorHex("#8b5cf6");
    setIsAdding(false);
    setEditingId(null);
  };

  const handleEdit = (subject: Subject) => {
    setName(subject.name);
    setCode(subject.code || "");
    setFaculty(subject.faculty || "");
    setColorHex(subject.colorHex || "#8b5cf6");
    setEditingId(subject.id);
    setIsAdding(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.patch(`/subjects/${editingId}`, { name, code, faculty, colorHex });
      } else {
        await api.post("/subjects", { name, code, faculty, colorHex });
      }
      resetForm();
      fetchSubjects();
    } catch (error) {
      console.error("Failed to save subject:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to remove this subject? Past attendance will be safely preserved.")) {
      try {
        await api.delete(`/subjects/${id}?preserveHistory=true`);
        fetchSubjects();
      } catch (error) {
        console.error("Failed to delete subject:", error);
      }
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Your Subjects</h1>
          <p className="text-sm text-muted-foreground">Manage the subjects you are currently studying.</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsAdding(true); }}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Subject</span>
        </button>
      </div>

      {(isAdding || editingId) && (
        <form onSubmit={handleSubmit} className="bg-[#0c0d12] border border-white/10 rounded-2xl p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white">{editingId ? "Edit Subject" : "New Subject"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subject Name *</label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Digital Design"
                className="w-full bg-[#13151a] border border-white/5 rounded-lg px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subject Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. ECSE303"
                className="w-full bg-[#13151a] border border-white/5 rounded-lg px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Faculty Name</label>
              <input
                type="text"
                value={faculty}
                onChange={(e) => setFaculty(e.target.value)}
                placeholder="e.g. SAK"
                className="w-full bg-[#13151a] border border-white/5 rounded-lg px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Color Indicator</label>
              <div className="flex gap-2">
                {["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899"].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setColorHex(color)}
                    className={`w-10 h-10 rounded-full transition-transform ${colorHex === color ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#13151a]" : "opacity-50 hover:opacity-100"}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-black hover:bg-gray-200 transition-colors"
            >
              Save Subject
            </button>
          </div>
        </form>
      )}

      {subjects.length === 0 && !isLoading && !isAdding ? (
        <div className="text-center py-12 bg-[#0c0d12] border border-white/5 rounded-2xl">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No subjects yet</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mb-6">
            You haven't added any subjects to track. Start by adding the subjects you are studying this semester.
          </p>
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-2 bg-primary/20 text-primary hover:bg-primary/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add First Subject
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subjects.map((subject) => (
            <div key={subject.id} className="bg-[#0c0d12] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: subject.colorHex || "#8b5cf6" }} />
              <div className="flex justify-between items-start pl-2">
                <div>
                  <h3 className="text-lg font-semibold text-white">{subject.name}</h3>
                  <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground">
                    {subject.code && <span className="bg-white/5 px-2 py-0.5 rounded text-xs">{subject.code}</span>}
                    {subject.faculty && <span>{subject.faculty}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEdit(subject)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
                    title="Edit Subject"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(subject.id)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    title="Remove Subject"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
