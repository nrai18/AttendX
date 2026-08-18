import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import {
  Calendar,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  Sparkles,
  Check
} from "lucide-react";

interface Semester {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface CreateSemesterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateSemesterModal: React.FC<CreateSemesterModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loadingSemesters, setLoadingSemesters] = useState(false);

  // Form fields
  const [year, setYear] = useState("1");
  const [semesterOption, setSemesterOption] = useState("1");
  
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const dateIn4Months = new Date(new Date().setMonth(new Date().getMonth() + 4));
  const defaultEndMonth = dateIn4Months.toISOString().slice(0, 7);
  
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [endMonth, setEndMonth] = useState(defaultEndMonth);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  const fetchSemesters = async () => {
    try {
      setLoadingSemesters(true);
      const res = await api.get("/semesters");
      setSemesters(res.data);
    } catch (err) {
      console.error("Failed to fetch semesters:", err);
    } finally {
      setLoadingSemesters(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSemesters();
    }
  }, [isOpen]);

  // Update semester options when year changes
  useEffect(() => {
    const y = parseInt(year);
    setSemesterOption(String(y * 2 - 1)); // default to odd semester for that year
  }, [year]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsCreating(true);

    const suffix = year === "1" ? "st" : year === "2" ? "nd" : year === "3" ? "rd" : "th";
    const generatedName = `Semester ${semesterOption} (${year}${suffix} Year)`;

    // Calculate dates
    const startDate = `${startMonth}-01`;
    const [endY, endM] = endMonth.split("-");
    const lastDay = new Date(parseInt(endY), parseInt(endM), 0).getDate();
    const endDate = `${endMonth}-${lastDay.toString().padStart(2, "0")}`;

    try {
      await api.post("/semesters", {
        name: generatedName,
        startDate,
        endDate,
        isActive: true,
      });
      toast.success("Semester created and activated successfully!");
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Failed to create semester", err);
      setError(err?.response?.data?.message || "Failed to create semester. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await api.patch(`/semesters/${id}/activate`);
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Failed to activate semester", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-6 relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Create Active Semester</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Define start and end dates to enable timetable & attendance tracking
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Existing inactive semesters list (if any) */}
        {semesters.filter((s) => !s.isActive).length > 0 && (
          <div className="space-y-2 bg-muted/50 p-3.5 rounded-xl border border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Or Activate Existing Semester
            </h3>
            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {semesters
                .filter((s) => !s.isActive)
                .map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-card border border-border text-xs text-foreground"
                  >
                    <div>
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-muted-foreground ml-2 text-[10px]">
                        ({new Date(s.startDate).toLocaleDateString()} -{" "}
                        {new Date(s.endDate).toLocaleDateString()})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleActivate(s.id)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all"
                    >
                      <Check className="w-3 h-3" />
                      Activate
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Year
              </label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-medium appearance-none"
              >
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Semester
              </label>
              <select
                value={semesterOption}
                onChange={(e) => setSemesterOption(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-medium appearance-none"
              >
                <option value={String(parseInt(year) * 2 - 1)}>Semester {parseInt(year) * 2 - 1}</option>
                <option value={String(parseInt(year) * 2)}>Semester {parseInt(year) * 2}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Start Month
              </label>
              <input
                type="month"
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-medium"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                End Month
              </label>
              <input
                type="month"
                value={endMonth}
                onChange={(e) => setEndMonth(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-medium"
                required
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50"
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Create & Activate
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
