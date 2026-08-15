import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Loader2, CalendarPlus, Upload, Image as ImageIcon, X, Download, FileSpreadsheet } from "lucide-react";
import { api } from "../../lib/api";
import { TimetableWizardModal } from "./TimetableWizardModal";
import { CreateSemesterModal } from "../../components/semester/CreateSemesterModal";
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

  // OCR Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonImportRef = useRef<HTMLInputElement>(null);

  // Wizard State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardPayload, setWizardPayload] = useState<any>(null);
  const [isCreateSemesterOpen, setIsCreateSemesterOpen] = useState(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      const semRes = await api.get("/semesters/active");
      const semester = semRes.data;
      
      if (!semester) {
        setIsLoading(false);
        return;
      }
      
      setActiveSemester(semester);

      const [subjRes, slotsRes] = await Promise.all([
        api.get("/subjects"),
        api.get(`/timetable/${semester.id}`)
      ]);
      
      const rawSubjects = Array.isArray(subjRes.data) ? subjRes.data : (subjRes.data?.subjects || []);
      const activeSubjects = rawSubjects.filter((s: any) => s.semesterId === semester.id);
      
      setSubjects(activeSubjects);
      setSlots(Array.isArray(slotsRes.data) ? slotsRes.data : []);

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

  const handleExportTimetable = async () => {
    if (!activeSemester) return;
    try {
      const res = await api.get(`/timetable/export/${activeSemester.id}`);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `schedule_${activeSemester.name.replace(/\s+/g, "_")}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (error) {
      console.error("Export timetable failed:", error);
      alert("Failed to export timetable.");
    }
  };

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeSemester || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const payload = JSON.parse(event.target?.result as string);
        if (confirm("Importing this timetable will replace scheduled classes in your active semester. Attendance records are safely preserved. Proceed?")) {
          await api.post(`/timetable/import/${activeSemester.id}`, payload);
          fetchData();
          alert("Timetable imported successfully!");
        }
      } catch (err: any) {
        console.error("Failed to parse or import JSON:", err);
        alert("Failed to import timetable: Invalid file format.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
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
        setSlots((prev) => prev.filter((slot) => slot.id !== id));
        fetchData();
        window.dispatchEvent(new Event("attendance-updated"));
      } catch (error) {
        console.error("Failed to delete slot:", error);
      }
    }
  };

  const handleSafeDeleteTimetable = async () => {
    if (confirm("Are you sure you want to clear your entire timetable? Past attendance records will be safely preserved, but all scheduled classes will be removed.")) {
      try {
        const targetSemId = activeSemester?.id || "active";
        await api.delete(`/timetable/semester/${targetSemId}/safe`);
        setSlots([]);
        await fetchData();
        window.dispatchEvent(new Event("attendance-updated"));
        alert("Timetable cleared successfully!");
      } catch (error) {
        console.error("Failed to clear timetable:", error);
        alert("Failed to clear timetable.");
      }
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      if (file.type.includes("pdf") || file.name.endsWith(".pdf")) {
        setImagePreview("pdf_file");
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleOcrUpload = async () => {
    if (!selectedImage || !activeSemester) return;
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", selectedImage);
    formData.append("image", selectedImage);
    formData.append("semesterId", activeSemester.id);
    
    try {
      const res = await api.post("/timetable/ocr-import", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      if (res.data.status === "needs_setup") {
        setWizardPayload(res.data);
        setIsOcrModalOpen(false);
        setIsWizardOpen(true);
      } else {
        alert("Timetable imported successfully!");
        setIsOcrModalOpen(false);
        fetchData();
      }
    } catch (error) {
      console.error("OCR Import failed:", error);
      alert("Failed to import timetable. Please try again.");
    } finally {
      setIsUploading(false);
      setSelectedImage(null);
      setImagePreview(null);
    }
  };

  const handleGenerateTimetable = async (selections: any) => {
    if (!activeSemester || !wizardPayload) return;
    try {
      const slotsToSave = selections.rawSlots || wizardPayload.rawSlots || [];
      await api.post("/timetable/save-wizard", {
        semesterId: activeSemester.id,
        selections,
        rawSlots: slotsToSave
      });
      setIsWizardOpen(false);
      setWizardPayload(null);
      fetchData();
    } catch (error) {
      console.error("Failed to generate timetable:", error);
      alert("Failed to generate timetable.");
    }
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
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 my-12">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-2">
          <CalendarPlus className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">No Active Semester</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Please create and activate a semester first to start managing your subjects, timetable, and attendance.
        </p>
        <button
          onClick={() => setIsCreateSemesterOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all mt-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create Active Semester</span>
        </button>

        <CreateSemesterModal
          isOpen={isCreateSemesterOpen}
          onClose={() => setIsCreateSemesterOpen(false)}
          onSuccess={fetchData}
        />
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
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Timetable</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage weekly academic schedule for {activeSemester.name}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSafeDeleteTimetable}
            title="Clear Timetable Schedule"
            className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear Timetable</span>
          </button>
          <button
            onClick={() => setIsOcrModalOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>OCR Auto-Import</span>
          </button>
          <button
            onClick={() => { setIsAdding(true); setDayOfWeek(activeTab); }}
            className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Slot</span>
          </button>
        </div>
      </div>
      
      {/* OCR Modal */}
      {isOcrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-blue-500" />
                Upload Timetable (PDF / Image)
              </h2>
              <button onClick={() => { setIsOcrModalOpen(false); setSelectedImage(null); setImagePreview(null); }} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="text-sm text-muted-foreground text-center">
                Upload your timetable PDF or Image file. We will extract all branch and semester schedules automatically!
              </div>
              
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  imagePreview ? 'border-blue-500/50 bg-blue-500/5' : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }`}
              >
                <input 
                  type="file" 
                  accept="image/*,.pdf,application/pdf" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                />
                
                {imagePreview === "pdf_file" ? (
                  <div className="space-y-3 flex flex-col items-center">
                    <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center font-bold text-xs uppercase tracking-wider">
                      PDF
                    </div>
                    <div className="text-sm font-bold text-foreground truncate max-w-[220px]">
                      {selectedImage?.name}
                    </div>
                    <p className="text-xs font-medium text-blue-500">Click to select a different PDF or Image</p>
                  </div>
                ) : imagePreview ? (
                  <div className="space-y-4">
                    <img src={imagePreview} alt="Preview" className="max-h-48 mx-auto rounded-lg object-contain" />
                    <p className="text-sm font-medium text-blue-500">Click to change file</p>
                  </div>
                ) : (
                  <div className="space-y-3 flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <Upload className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Click to browse timetable file</p>
                      <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG, JPEG up to 15MB</p>
                    </div>
                  </div>
                )}
              </div>
              
              <button 
                onClick={handleOcrUpload}
                disabled={!selectedImage || isUploading}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition-colors flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Extracting Master Schedule...
                  </>
                ) : (
                  "Extract Schedule"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timetable Setup Wizard Modal */}
      <TimetableWizardModal 
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onGenerate={handleGenerateTimetable}
        setupPayload={wizardPayload}
      />

      {/* Forms (Add Slot) */}

      {isAdding && (
        <form onSubmit={handleAddSlot} className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-xl animate-in slide-in-from-top-4 duration-300">
          <h2 className="text-lg font-bold text-foreground border-b border-border pb-4">{editingSlotId ? "Edit Timetable Slot" : "Add Timetable Slot"}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Day</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
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
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
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
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Start Time</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">End Time</label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</label>
              <select
                value={slotType}
                onChange={(e) => setSlotType(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              >
                <option value="lecture">Lecture</option>
                <option value="tutorial">Tutorial</option>
                <option value="practical">Practical</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={resetForm} className="px-5 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" className="px-6 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md shadow-primary/20">{editingSlotId ? "Save Changes" : "Save Slot"}</button>
          </div>
        </form>
      )}

      {/* Desktop Weekly Grid View (hidden on mobile) */}
      <div className="hidden lg:block bg-card border border-border rounded-3xl overflow-hidden shadow-xl">
        <div className="grid grid-cols-7 border-b border-border bg-muted/50">
          {DAYS.map((day) => (
            <div key={day} className="py-3 text-center border-r border-border last:border-0">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{day}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 min-h-[500px]">
          {slotsByDay.map((daySlots, idx) => (
            <div key={idx} className="border-r border-border last:border-0 p-3 space-y-3 bg-card">
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
              className={`whitespace-nowrap px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                activeTab === idx 
                  ? "bg-primary text-primary-foreground shadow-primary/20" 
                  : "bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {currentDaySlots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-card border border-border rounded-3xl shadow-sm">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
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
