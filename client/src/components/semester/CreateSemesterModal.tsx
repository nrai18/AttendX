import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { useScrollLock } from "../../hooks/useScrollLock";
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
  useScrollLock(isOpen);
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
      setSemesters(Array.isArray(res.data) ? res.data : []);
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
      toast.success("Semester activated successfully!");
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Failed to activate semester", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="bg-[#18181B] border border-[#27272A] rounded-[8px] p-6 max-w-lg w-full shadow-2xl space-y-6 relative overflow-hidden">
        
        <div className="flex items-center justify-between border-b border-[#27272A] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[8px] bg-[#48CAE4]/10 border border-[#48CAE4]/20 flex items-center justify-center text-[#48CAE4]">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-medium text-white tracking-tight">Create Active Semester</h2>
              <p className="text-sm text-[#A1A1AA] mt-1">
                Define start and end dates to enable timetable & attendance tracking
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#A1A1AA] hover:text-white p-1 rounded-[8px] hover:bg-[#27272A] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Existing inactive semesters list (if any) */}
        {semesters.filter((s) => !s.isActive).length > 0 && (
          <div className="space-y-2 bg-black/50 p-4 rounded-[8px] border border-[#27272A]">
            <h3 className="text-xs font-medium text-[#A1A1AA] uppercase tracking-widest font-mono">
              Or Activate Existing Semester
            </h3>
            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {semesters
                .filter((s) => !s.isActive)
                .map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 rounded-[8px] bg-[#18181B] border border-[#27272A] text-sm text-white"
                  >
                    <div>
                      <span className="font-medium">{s.name}</span>
                      <span className="text-[#A1A1AA] ml-2 text-xs font-mono">
                        ({new Date(s.startDate).toLocaleDateString()} -{" "}
                        {new Date(s.endDate).toLocaleDateString()})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleActivate(s.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-white font-medium transition-colors"
                    >
                      <Check className="w-3 h-3 text-[#48CAE4]" />
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
              <label className="block text-xs font-medium text-[#A1A1AA] uppercase tracking-widest font-mono mb-2">
                Year
              </label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full px-4 py-2.5 rounded-[8px] bg-black border border-[#27272A] text-white text-sm focus:outline-none focus:border-[#48CAE4] focus:ring-1 focus:ring-[#48CAE4] font-medium appearance-none transition-colors"
              >
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#A1A1AA] uppercase tracking-widest font-mono mb-2">
                Semester
              </label>
              <select
                value={semesterOption}
                onChange={(e) => setSemesterOption(e.target.value)}
                className="w-full px-4 py-2.5 rounded-[8px] bg-black border border-[#27272A] text-white text-sm focus:outline-none focus:border-[#48CAE4] focus:ring-1 focus:ring-[#48CAE4] font-medium appearance-none transition-colors"
              >
                <option value={String(parseInt(year) * 2 - 1)}>Semester {parseInt(year) * 2 - 1}</option>
                <option value={String(parseInt(year) * 2)}>Semester {parseInt(year) * 2}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#A1A1AA] uppercase tracking-widest font-mono mb-2">
                Start Month
              </label>
              <input
                type="month"
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                className="w-full px-3 py-2.5 rounded-[8px] bg-black border border-[#27272A] text-white text-sm focus:outline-none focus:border-[#48CAE4] focus:ring-1 focus:ring-[#48CAE4] font-medium transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#A1A1AA] uppercase tracking-widest font-mono mb-2">
                End Month
              </label>
              <input
                type="month"
                value={endMonth}
                onChange={(e) => setEndMonth(e.target.value)}
                className="w-full px-3 py-2.5 rounded-[8px] bg-black border border-[#27272A] text-white text-sm focus:outline-none focus:border-[#48CAE4] focus:ring-1 focus:ring-[#48CAE4] font-medium transition-colors"
                required
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-[#E63946] bg-[#E63946]/10 p-2.5 rounded-[8px] border border-[#E63946]/20 font-medium">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-[8px] text-sm font-medium text-[#A1A1AA] hover:text-white hover:bg-[#27272A] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="flex items-center gap-2 px-6 py-2.5 rounded-[8px] text-sm font-semibold bg-[#48CAE4] hover:bg-[#48CAE4]/90 text-black transition-all disabled:opacity-50 shadow-none"
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
