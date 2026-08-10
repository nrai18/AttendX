import React, { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, CalendarPlus, Upload, Edit2 } from "lucide-react";
import { api } from "../../lib/api";
import { TimetableWizardModal, OcrSetupPayload } from "./TimetableWizardModal";
import { SortableSlot } from "./SortableSlot";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

interface Subject {
  id: string;
  name: string;
  code?: string;
  colorHex?: string;
}

interface TimetableSlot {
  id: string;
  subjectId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string;
  slotType: string;
  subject: Subject;
}

interface Semester {
  id: string;
  name: string;
  isActive: boolean;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const TimetablePage = () => {
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<number>(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);

  // Form State
  const [isAdding, setIsAdding] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [dayOfWeek, setDayOfWeek] = useState(activeTab);
  const [subjectId, setSubjectId] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [room, setRoom] = useState("");
  const [slotType, setSlotType] = useState("lecture");

  // Extra Class Form State
  const [isAddingExtra, setIsAddingExtra] = useState(false);
  const [extraDate, setExtraDate] = useState(new Date().toISOString().split("T")[0]);
  const [extraSubjectId, setExtraSubjectId] = useState("");

  // Wizard State
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch active semester
      const semRes = await api.get("/semesters/active");
      const semester = semRes.data;
      
      if (!semester) {
        setIsLoading(false);
        return; // Handle no active semester
      }
      
      setActiveSemester(semester);

      // Fetch subjects and slots concurrently
      const [subjRes, slotsRes] = await Promise.all([
        api.get("/subjects"),
        api.get(`/timetable/${semester.id}`)
      ]);
      
      // Filter subjects for the active semester just in case
      const activeSubjects = subjRes.data.filter((s: any) => s.semesterId === semester.id);
      
      setSubjects(activeSubjects);
      setSlots(slotsRes.data);

    } catch (error) {
      console.error("Failed to fetch timetable data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setSubjectId("");
    setStartTime("09:00");
    setEndTime("10:00");
    setRoom("");
    setSlotType("lecture");
    setEditingSlotId(null);
    setIsAdding(false);
  };

  const handleEditSlot = (slot: TimetableSlot) => {
    setSubjectId(slot.subjectId);
    setStartTime(slot.startTime);
    setEndTime(slot.endTime);
    setRoom(slot.room || "");
    setSlotType(slot.slotType);
    setDayOfWeek(slot.dayOfWeek);
    setEditingSlotId(slot.id);
    setIsAdding(true);
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId || !activeSemester) return alert("Please select a subject and ensure you have an active semester.");
    try {
      const payload = {
        semesterId: activeSemester.id,
        subjectId,
        dayOfWeek,
        startTime,
        endTime,
        room,
        slotType
      };

      if (editingSlotId) {
        await api.patch(`/timetable/slots/${editingSlotId}`, payload);
      } else {
        await api.post("/timetable/slots", payload);
      }
      
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Failed to save slot:", error);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const activeSlotId = active.id as string;
      const overSlotId = over.id as string;

      // Optimistically swap the times in local state
      const activeSlot = slots.find(s => s.id === activeSlotId);
      const overSlot = slots.find(s => s.id === overSlotId);
      
      if (activeSlot && overSlot) {
        setSlots(prev => prev.map(s => {
          if (s.id === activeSlotId) return { ...s, startTime: overSlot.startTime, endTime: overSlot.endTime };
          if (s.id === overSlotId) return { ...s, startTime: activeSlot.startTime, endTime: activeSlot.endTime };
          return s;
        }).sort((a, b) => {
          if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
          return a.startTime.localeCompare(b.startTime);
        }));

        try {
          await api.post("/timetable/slots/swap", {
            slotAId: activeSlotId,
            slotBId: overSlotId
          });
        } catch (error) {
          console.error("Failed to swap slots:", error);
          fetchData(); // Revert on failure
        }
      }
    }
  };

  const handleAddExtraClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraSubjectId || !activeSemester) return alert("Please select a subject.");
    try {
      await api.post("/timetable/extra-class", {
        semesterId: activeSemester.id,
        subjectId: extraSubjectId,
        date: extraDate,
        startTime: "17:30", 
        endTime: "18:20",
        reason: "Ad-hoc extra class"
      });
      setIsAddingExtra(false);
      alert("Extra class added successfully!");
    } catch (error) {
      console.error("Failed to add extra class:", error);
    }
  };

  const handleDeleteSlot = async (id: string) => {
    if (confirm("Remove this class from timetable? Past attendance is safe.")) {
      try {
        await api.delete(`/timetable/slots/${id}?preserveHistory=true`);
        fetchData();
      } catch (error) {
        console.error("Failed to delete slot:", error);
      }
    }
  };

  const handleSafeDeleteTimetable = async () => {
    if (!activeSemester) return;
    if (confirm("Are you sure you want to clear your entire timetable? Past attendance records will be safely preserved, but all scheduled classes will be removed.")) {
      try {
        await api.delete(`/timetable/semester/${activeSemester.id}/safe`);
        fetchData();
        alert("Timetable cleared successfully!");
      } catch (error) {
        console.error("Failed to clear timetable:", error);
        alert("Failed to clear timetable.");
      }
    }
  };

  /**
   * Called by the wizard after the user confirms semester/branch/section.
   * Sends the file to the backend OCR endpoint and returns the structured payload.
   */
  const handleOcrProcess = async (
    file: File,
    semesterName: string,
    branch: string,
    section: string
  ): Promise<OcrSetupPayload> => {
    if (!activeSemester) throw new Error("No active semester");
    const formData = new FormData();
    formData.append("image", file);
    formData.append("semesterId", activeSemester.id);
    formData.append("semesterName", semesterName);
    formData.append("branch", branch);
    formData.append("section", section);
    const res = await api.post("/timetable/ocr-import", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return res.data as OcrSetupPayload;
  };

  /**
   * Called by the wizard as the final step — saves the personalized timetable.
   */
  const handleGenerateTimetable = async (selections: {
    programElectiveCode?: string;
    minorElectiveCode?: string;
    labGroup: string;
    rawSlots: any[];
  }) => {
    if (!activeSemester) return;
    const { rawSlots, ...rest } = selections;
    await api.post("/timetable/save-wizard", {
      semesterId: activeSemester.id,
      selections: rest,
      rawSlots,
    });
    setIsWizardOpen(false);
    fetchData();
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!activeSemester) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
        <h2 className="text-2xl font-bold text-white">No Active Semester</h2>
        <p className="text-muted-foreground">Please create and activate a semester first to manage your timetable.</p>
      </div>
    );
  }

  const currentDaySlots = slots.filter(s => s.dayOfWeek === activeTab);

  // Group slots by day for desktop grid view
  const slotsByDay = DAYS.map((_, index) => slots.filter(s => s.dayOfWeek === index));

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full pb-24 md:pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Timetable</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage classes for {activeSemester.name}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {slots.length > 0 && (
            <button
              onClick={handleSafeDeleteTimetable}
              className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-4 py-2 rounded-xl text-sm font-semibold transition-colors mr-2"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Clear Timetable</span>
            </button>
          )}
          <button
            onClick={() => setIsWizardOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-lg shadow-blue-500/20 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>Auto Import</span>
          </button>
          <button
            onClick={() => setIsAddingExtra(!isAddingExtra)}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <CalendarPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Extra Class</span>
          </button>
          <button
            onClick={() => { setIsAdding(true); setDayOfWeek(activeTab); }}
            className="flex items-center gap-2 bg-white text-black hover:bg-gray-200 px-4 py-2 rounded-xl text-sm font-bold shadow-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Slot</span>
          </button>
        </div>
      </div>
      
      {/* Timetable Import Wizard — handles the full OCR + personalization flow */}
      <TimetableWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onOcrProcess={handleOcrProcess}
        onGenerate={handleGenerateTimetable}
      />

      {/* Forms (Extra Class, Add Slot) */}
      {isAddingExtra && (
        <form onSubmit={handleAddExtraClass} className="bg-[#1a1b23] border border-white/10 rounded-2xl p-5 space-y-4 animate-in slide-in-from-top-4 duration-300">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><CalendarPlus className="w-5 h-5 text-indigo-400" /> Schedule Extra Class</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</label>
              <input
                type="date"
                required
                value={extraDate}
                onChange={(e) => setExtraDate(e.target.value)}
                className="w-full bg-[#13151a] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subject</label>
              <select
                required
                value={extraSubjectId}
                onChange={(e) => setExtraSubjectId(e.target.value)}
                className="w-full bg-[#13151a] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow appearance-none"
              >
                <option value="">Select a subject...</option>
                {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setIsAddingExtra(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-white transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-lg text-sm font-bold bg-indigo-500 text-white hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-500/20">Schedule</button>
          </div>
        </form>
      )}

      {isAdding && (
        <form onSubmit={handleAddSlot} className="bg-[#0c0d12] border border-white/10 rounded-2xl p-6 space-y-5 shadow-xl animate-in slide-in-from-top-4 duration-300">
          <h2 className="text-lg font-bold text-white border-b border-white/5 pb-4">{editingSlotId ? "Edit Timetable Slot" : "Add Timetable Slot"}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Day</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full bg-[#13151a] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/20 appearance-none"
              >
                {DAYS.map((day, idx) => <option key={day} value={idx}>{day}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subject</label>
              <select
                required
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full bg-[#13151a] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/20 appearance-none"
              >
                <option value="">Select...</option>
                {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Room (Optional)</label>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="e.g. L-101"
                className="w-full bg-[#13151a] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Start Time</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-[#13151a] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">End Time</label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-[#13151a] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</label>
              <select
                value={slotType}
                onChange={(e) => setSlotType(e.target.value)}
                className="w-full bg-[#13151a] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/20 appearance-none"
              >
                <option value="lecture">Lecture</option>
                <option value="tutorial">Tutorial</option>
                <option value="practical">Practical</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
            <button type="button" onClick={resetForm} className="px-5 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-white transition-colors">Cancel</button>
            <button type="submit" className="px-6 py-2 rounded-xl text-sm font-bold bg-white text-black hover:bg-gray-200 transition-colors shadow-lg">{editingSlotId ? "Save Changes" : "Save Slot"}</button>
          </div>
        </form>
      )}

      {/* Desktop Weekly Grid View (hidden on mobile) */}
      <div className="hidden lg:block bg-[#0c0d12] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        <div className="grid grid-cols-7 border-b border-white/10 bg-[#13151a]">
          {DAYS.map((day) => (
            <div key={day} className="py-4 text-center border-r border-white/5 last:border-0">
              <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{day}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 min-h-[500px]">
          {slotsByDay.map((daySlots, idx) => (
            <div key={idx} className="border-r border-white/5 last:border-0 p-3 space-y-3 bg-[#0c0d12]">
              {daySlots.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <span className="text-xs text-muted-foreground/50 font-medium">No Classes</span>
                </div>
              ) : (
                <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={daySlots.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    {daySlots.map(slot => (
                      <SortableSlot 
                        key={slot.id} 
                        slot={slot} 
                        isDesktop 
                        onEdit={handleEditSlot} 
                        onDelete={handleDeleteSlot} 
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Daily View (hidden on desktop) */}
      <div className="block lg:hidden space-y-4">
        <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2 -mx-4 px-4">
          {DAYS.map((day, idx) => (
            <button
              key={day}
              onClick={() => setActiveTab(idx)}
              className={`whitespace-nowrap px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${
                activeTab === idx 
                  ? "bg-white text-black shadow-white/20" 
                  : "bg-[#0c0d12] border border-white/5 text-muted-foreground hover:bg-white/5 hover:text-white"
              }`}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {currentDaySlots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-[#0c0d12] border border-white/5 rounded-3xl">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-3">
                <CalendarPlus className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Free Day!</p>
            </div>
          ) : (
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={currentDaySlots.map(s => s.id)} strategy={verticalListSortingStrategy}>
                {currentDaySlots.map(slot => (
                  <SortableSlot 
                    key={slot.id} 
                    slot={slot} 
                    onEdit={handleEditSlot} 
                    onDelete={handleDeleteSlot} 
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  );
};
