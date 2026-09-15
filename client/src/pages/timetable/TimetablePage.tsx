import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Loader2, CalendarPlus, Upload, Image as ImageIcon, X, Download, FileSpreadsheet, Edit3, ArrowLeft, CheckSquare, Square, CheckCircle2, Zap, Archive } from "lucide-react";
import { PageSkeleton } from "../../components/common/PageSkeleton";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { RunActionButton } from "../../components/ui/run-action-button";
import { SaveToggle } from "../../components/ui/save-toggle";
import { TimetableWizardModal } from "./TimetableWizardModal";
import { CreateSemesterModal } from "../../components/semester/CreateSemesterModal";
import { SortableSlot } from "./SortableSlot";
import { DeleteSlotModal } from "./DeleteSlotModal";
import { ClearTimetableModal } from "./ClearTimetableModal";
import { ArchiveTimetableModal } from "./ArchiveTimetableModal";
import { SubjectReconciliationModal } from "../../components/subjects/SubjectReconciliationModal";
import { Wand2, Calendar } from "lucide-react";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { normalizeTimeString } from "../../utils/timeUtils";
import { downloadBlob } from "../../lib/download";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { useCacheStore } from "../../stores/cacheStore";
import { useScrollLock } from "../../hooks/useScrollLock";

interface Subject {
  id: string;
  name: string;
  code?: string;
  colorHex?: string;
  faculty?: string;
}

interface TimetableSlot {
  id: string;
  subjectId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string;
  group?: string;
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
  const cachedData = useCacheStore((state) => state.timetable);
  const setCache = useCacheStore((state) => state.setCache);

  const [slots, setSlots] = useState<TimetableSlot[]>(cachedData?.slots || []);
  const [subjects, setSubjects] = useState<Subject[]>(cachedData?.subjects || []);
  const [activeSemester, setActiveSemester] = useState<Semester | null>(cachedData?.activeSemester || null);
  const [isLoading, setIsLoading] = useState(!cachedData);
  const [activeTab, setActiveTab] = useState<number>(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);


  // Selection & Delete Modal State
  
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isDesktop, setIsDesktop] = React.useState(window.innerWidth >= 1024);
  React.useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [slotsPendingDelete, setSlotsPendingDelete] = useState<TimetableSlot[]>([]);

  // Attendance stats for header badge
  const { overallPercentage, targetPercentage, fetchStats } = useAttendanceStore();

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
  useScrollLock(isOcrModalOpen);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonImportRef = useRef<HTMLInputElement>(null);

  // Wizard & Semester State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardPayload, setWizardPayload] = useState<any>(null);
  const [uploadStartDate, setUploadStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isCreateSemesterOpen, setIsCreateSemesterOpen] = useState(false);

  // Clear All Timetable Modal State & Toast
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isReconciliationOpen, setIsReconciliationOpen] = useState(false);
  const [newSubjectIds, setNewSubjectIds] = useState<string[]>([]);
  const [existingSubjectIds, setExistingSubjectIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      if (!cachedData) setIsLoading(true);
      
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

      const rawSlotsList = Array.isArray(slotsRes.data) ? slotsRes.data : [];
      const normalizedSlots = rawSlotsList.map((slot: any) => ({
        ...slot,
        startTime: normalizeTimeString(slot.startTime, "09:00"),
        endTime: normalizeTimeString(slot.endTime, "10:00")
      }));

      setSlots(normalizedSlots);
      
      setCache('timetable', {
        activeSemester: semester,
        subjects: activeSubjects,
        slots: normalizedSlots
      });
      
      fetchStats();
    } catch (error) {
      console.error("Failed to fetch timetable data:", error);
      const cache = useCacheStore.getState().timetable;
      if (cache && cache.activeSemester) {
        setActiveSemester(cache.activeSemester);
        setSubjects(cache.subjects || []);
        setSlots(cache.slots || []);
      } else {
        const attendanceState = useAttendanceStore.getState();
        if (attendanceState.hasActiveSemester && attendanceState.activeSemesterId) {
          // We at least know there is an active semester from the global store
          setActiveSemester({ id: attendanceState.activeSemesterId, name: "Active Semester", startDate: new Date().toISOString(), endDate: new Date().toISOString() } as any);
          setSubjects(attendanceState.subjects as any);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Clear selection when changing day tab
  useEffect(() => {
    setSelectedSlotIds([]);
  }, [activeTab]);

  useEffect(() => {
    if (activeSemester?.id) {
      fetchData();
    }
  }, [activeSemester?.id]);

  useEffect(() => {
    const handleUpdate = () => {
      if (activeSemester?.id) {
        fetchData();
      }
    };
    window.addEventListener("attendance-updated", handleUpdate);
    return () => window.removeEventListener("attendance-updated", handleUpdate);
  }, [activeSemester?.id]);

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
    setStartTime(normalizeTimeString(slot.startTime, "09:00"));
    setEndTime(normalizeTimeString(slot.endTime, "10:00"));
    setRoom(slot.room || "");
    setSlotType(slot.slotType);
    setDayOfWeek(slot.dayOfWeek);
    setEditingSlotId(slot.id);
    setIsAdding(true);
  };

  const handleAddSlot = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!subjectId || !activeSemester) {
      toast.error("Please select a subject and ensure you have an active semester.");
      return;
    }
    try {
      const payload = {
        semesterId: activeSemester.id,
        subjectId,
        dayOfWeek,
        startTime: normalizeTimeString(startTime, "09:00"),
        endTime: normalizeTimeString(endTime, "10:00"),
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
      window.dispatchEvent(new Event("attendance-updated"));
    } catch (error) {
      console.error("Failed to save slot:", error);
    }
  };

  const handleExportTimetable = async () => {
    if (!activeSemester) return;
    try {
      const res = await api.get(`/timetable/export/${activeSemester.id}`);
      const jsonStr = JSON.stringify(res.data, null, 2);
      await downloadBlob(new Blob([jsonStr], { type: "application/json" }), `schedule_${activeSemester.name.replace(/\s+/g, "_")}.json`);
    } catch (error) {
      console.error("Export timetable failed:", error);
      toast.error("Failed to export timetable.");
    }
  };

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeSemester || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const payload = JSON.parse(event.target?.result as string);
        toast("Import Timetable", {
          description: "Importing this timetable will replace scheduled classes in your active semester. Attendance records are safely preserved. Proceed?",
          action: {
            label: "Import",
            onClick: async () => {
              try {
                await api.post(`/timetable/import/${activeSemester.id}`, payload);
                fetchData();
                window.dispatchEvent(new Event("attendance-updated"));
                toast.success("Timetable imported successfully!");
              } catch (err: any) {
                console.error("Failed to import JSON:", err);
                toast.error("Failed to import timetable: Invalid file format.");
              }
            }
          },
          cancel: { label: "Cancel", onClick: () => {} }
        });
      } catch (err: any) {
        console.error("Failed to parse JSON:", err);
        toast.error("Invalid file format.");
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

  const handleToggleSelectSlot = (slotId: string) => {
    setSelectedSlotIds((prev) =>
      prev.includes(slotId) ? prev.filter((id) => id !== slotId) : [...prev, slotId]
    );
  };

  const currentDaySlots = slots.filter((s) => s.dayOfWeek === activeTab);

  const handleSelectAllCurrentDay = () => {
    const currentDayIds = currentDaySlots.map((s) => s.id);
    if (selectedSlotIds.length === currentDayIds.length) {
      setSelectedSlotIds([]);
    } else {
      setSelectedSlotIds(currentDayIds);
    }
  };

  // Open delete dialog for a single slot
  const handleInitiateDeleteSingle = (slot: TimetableSlot) => {
    setSlotsPendingDelete([slot]);
    setIsDeleteModalOpen(true);
  };

  // Open delete dialog for multiple selected slots
  const handleInitiateDeleteSelected = () => {
    const selectedSlots = slots.filter((s) => selectedSlotIds.includes(s.id));
    if (selectedSlots.length === 0) return;
    setSlotsPendingDelete(selectedSlots);
    setIsDeleteModalOpen(true);
  };

  const handleMergeSlots = async () => {
    const selectedSlots = slots.filter((s) => selectedSlotIds.includes(s.id));
    if (selectedSlots.length !== 2) {
      toast.error("Please select exactly 2 slots to merge.");
      return;
    }
    const [s1, s2] = selectedSlots;
    if (s1.subjectId !== s2.subjectId || s1.dayOfWeek !== s2.dayOfWeek) {
      toast.error("Slots must be of the same subject on the same day.");
      return;
    }
    
    // Sort by start time
    const sorted = [s1, s2].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const [first, second] = sorted;
    
    try {
      await api.patch(`/timetable/slots/${first.id}`, { endTime: second.endTime });
      await api.delete(`/timetable/slots/${second.id}`);
      toast.success("Slots merged successfully!");
      setSelectedSlotIds([]);
      setIsSelectMode(false);
      fetchData();
    } catch (error) {
      toast.error("Failed to merge slots.");
    }
  };

  // Execute deletion with chosen scope and preservation option
  const handleConfirmDelete = async ({
    scope,
    preserveHistory,
  }: {
    scope: "this_day_only" | "all_occurrences";
    preserveHistory: boolean;
  }) => {
    if (!activeSemester || slotsPendingDelete.length === 0) return;

    try {
      if (scope === "this_day_only") {
        // Delete only the specific slots on this day
        const slotIds = slotsPendingDelete.map((s) => s.id);
        if (slotIds.length === 1) {
          await api.delete(`/timetable/slots/${slotIds[0]}?preserveHistory=${preserveHistory}`);
        } else {
          await api.post("/timetable/slots/delete-batch", {
            slotIds,
            preserveHistory,
          });
        }
      } else {
        // Delete all weekly occurrences of the selected subjects
        const distinctSubjectIds = Array.from(new Set(slotsPendingDelete.map((s) => s.subjectId)));
        for (const subjId of distinctSubjectIds) {
          await api.delete(
            `/timetable/semester/${activeSemester.id}/subject/${subjId}/slots?preserveHistory=${preserveHistory}`
          );
        }
      }

      setSelectedSlotIds([]);
      setIsSelectMode(false);
      await fetchData();
      window.dispatchEvent(new Event("attendance-updated"));
    } catch (error) {
      console.error("Failed to delete slot(s):", error);
      toast.error("Failed to delete the selected lecture(s). Please try again.");
    }
  };

  const handleSafeDeleteTimetable = () => {
    setIsClearModalOpen(true);
  };

  const handleConfirmClearAll = async () => {
    try {
      const targetSemId = activeSemester?.id || "active";
      await api.delete(`/timetable/semester/${targetSemId}/safe`);
      setSlots([]);
      setSelectedSlotIds([]);
      setIsSelectMode(false);
      await fetchData();
      window.dispatchEvent(new Event("attendance-updated"));
      setToastMessage("Timetable schedule cleared successfully!");
      setTimeout(() => setToastMessage(null), 4000);
    } catch (error) {
      console.error("Failed to clear timetable:", error);
      toast.error("Failed to clear timetable. Please try again.");
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
        toast.error("Timetable imported successfully!");
        setIsOcrModalOpen(false);
        fetchData();
        window.dispatchEvent(new Event("attendance-updated"));
      }
    } catch (error) {
      console.error("OCR Import failed:", error);
      toast.error("Failed to import timetable. Please try again.");
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
        rawSlots: slotsToSave,
        startDate: uploadStartDate
      });
      setIsWizardOpen(false);
      setWizardPayload(null);
      fetchData();
      window.dispatchEvent(new Event("attendance-updated"));
    } catch (error) {
      console.error("Failed to generate timetable:", error);
      toast.error("Failed to generate timetable.");
    }
  };

  if (isLoading) {
    return <PageSkeleton type="list" />;
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

  // Group slots by day for desktop grid view
  const slotsByDay = DAYS.map((_, index) => slots.filter(s => s.dayOfWeek === index));

  return (
    <div className="theme-aether p-4 md:p-8 space-y-6 w-full mx-auto pb-24 md:pb-8 min-h-screen">

      
            {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-8 border-b border-[rgba(255,255,255,0.1)] mb-8 gap-6">
        <div className="flex items-center gap-4">
          <h1 className="text-4xl font-medium tracking-tight uppercase" style={{ color: "var(--aether-text)" }}>
            TIMETABLE
          </h1>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              if (isSelectMode) setSelectedSlotIds([]);
              setIsSelectMode(!isSelectMode);
            }}
            title={isSelectMode ? "Cancel selection" : "Select multiple lectures to delete or manage"}
            className="flex items-center gap-1.5 bg-muted hover:bg-muted/80 text-foreground border border-border px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            {isSelectMode ? <X className="w-3.5 h-3.5 text-muted-foreground" /> : <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />}
            <span>{isSelectMode ? "Cancel" : "Edit / Select"}</span>
          </button>
          
          {isSelectMode && selectedSlotIds.length > 0 && (
            <>
              <button 
                onClick={handleInitiateDeleteSelected}
                className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete ({selectedSlotIds.length})</span>
              </button>
              
              {selectedSlotIds.length === 2 && (
                <button 
                  onClick={handleMergeSlots}
                  className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Merge Slots</span>
                </button>
              )}
            </>
          )}
          
          {!isSelectMode && (
            <>
              <button
                onClick={() => setIsArchiveModalOpen(true)}
                title="View Archived Timetables"
                className="flex items-center gap-1.5 bg-secondary/30 hover:bg-secondary/50 text-secondary-foreground border border-border px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                <img src="/src/assets/archive.svg" alt="Archive" className="w-3.5 h-3.5 dark:invert opacity-70" />
                <span className="hidden sm:inline">Archived</span>
              </button>

              <button
                onClick={() => setIsReconciliationOpen(true)}
                title="Manually map duplicate subjects"
                className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Merge</span>
              </button>

              <button
                onClick={() => setIsClearModalOpen(true)}
                title="Clear Timetable Schedule"
                className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear All</span>
              </button>
              
              <button
                onClick={() => setIsOcrModalOpen(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>OCR Import</span>
              </button>
              
              <button
                onClick={() => {
                  resetForm();
                  setIsAdding(true);
                  setDayOfWeek(activeTab);
                  setTimeout(() => document.getElementById('add-slot-form')?.scrollIntoView({ behavior: 'smooth' }), 100);
                }}
                className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Slot</span>
              </button>
            </>
          )}
        </div>
      </div>
      
      <div className="flex justify-between items-center mb-8 aether-mono text-xs font-semibold" style={{ color: "var(--aether-text-muted)" }}>
        <span>{activeSemester?.name || "No Active Semester"}</span>
      </div>

{/* OCR Modal */}
      {isOcrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
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
              
              
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    Effective Start Date
                  </label>
                  <p className="text-xs text-muted-foreground">Select the exact date this new timetable becomes active. Your existing timetable will be archived to end the day before.</p>
                  <input
                    type="date"
                    value={uploadStartDate}
                    onChange={(e) => setUploadStartDate(e.target.value)}
                    className="flex h-11 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background transition-all hover:bg-background shadow-sm"
                  />
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
              
              <div className="w-full">
                <RunActionButton 
                  action={handleOcrUpload}
                  disabled={!selectedImage || isUploading}
                  idleLabel="Extract Schedule"
                  doneLabel="Wizard Ready"
                  idleIcon={<Upload className="h-5 w-5 fill-current text-primary-foreground opacity-90" />}
                  steps={[
                    { id: 1, label: 'Uploading Timetable', icon: Upload },
                    { id: 2, label: 'Scanning Layout', icon: ImageIcon },
                    { id: 3, label: 'Extracting Slots', icon: FileSpreadsheet },
                    { id: 4, label: 'Classifying Subjects', icon: Zap },
                    { id: 5, label: 'Preparing Wizard', icon: CheckCircle2 }
                  ]}
                  widths={{ idle: 220, running: 340, done: 220 }}
                />
              </div>
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

      {/* Delete Slot Confirmation Modal */}
      <DeleteSlotModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSlotsPendingDelete([]);
        }}
        slotsToDelete={slotsPendingDelete}
        dayName={DAYS[activeTab]}
        onConfirmDelete={handleConfirmDelete}
      />

      {/* Archive Modal */}
        <ArchiveTimetableModal
          isOpen={isArchiveModalOpen}
          onClose={() => setIsArchiveModalOpen(false)}
          semesterId={activeSemester?.id}
        />

        {/* Clear All Timetable Slots Modal */}
      <ClearTimetableModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={handleConfirmClearAll}
        semesterName={activeSemester?.name || "Active Semester"}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-bottom-4 duration-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Forms (Add Slot) */}
      {isAdding && (
        <form id="add-slot-form" onSubmit={handleAddSlot} className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-xl animate-in slide-in-from-top-4 duration-300">
          <h2 className="text-lg font-bold text-foreground border-b border-border pb-4">{editingSlotId ? "Edit Timetable Slot" : "Add Timetable Slot"}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Day</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              >
                {DAYS.map((day, idx) => <option key={day} value={idx} className="bg-white text-black dark:bg-[#0a0a0a] dark:text-white">{day}</option>)}
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
                <option value="" className="bg-white text-black dark:bg-[#0a0a0a] dark:text-white">Select...</option>
                {subjects.map(sub => <option key={sub.id} value={sub.id} className="bg-white text-black dark:bg-[#0a0a0a] dark:text-white">{sub.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Room (Optional)</label>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                
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
                <option value="lecture" className="bg-white text-black dark:bg-[#0a0a0a] dark:text-white">Lecture</option>
                <option value="tutorial" className="bg-white text-black dark:bg-[#0a0a0a] dark:text-white">Tutorial</option>
                <option value="practical" className="bg-white text-black dark:bg-[#0a0a0a] dark:text-white">Practical</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={resetForm} className="px-5 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
            <SaveToggle
              onClick={() => handleAddSlot()}
              idleText={editingSlotId ? "Save Changes" : "Save Slot"}
              savedText="Saved!"
              size="sm"
            />
          </div>
        </form>
      )}

      {/* Desktop Weekly Grid View (hidden on mobile) */}
      <div className="hidden lg:block bg-card border border-border rounded-3xl overflow-hidden shadow-xl">
        <div className="grid grid-cols-7 border-b border-border bg-transparent">
          {DAYS.map((day, idx) => (
            <div key={day} className="pt-6 pb-2 border-r border-border last:border-0 relative flex flex-col items-end pr-4">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider aether-mono relative z-10">
                {day}
              </span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 min-h-[500px]">
          {slotsByDay.map((daySlots, idx) => (
            <div key={idx} className="border-r border-border last:border-0 p-3 space-y-3 bg-transparent">
              {daySlots.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <span className="text-xs font-semibold" style={{ color: "var(--aether-text-muted)" }}>No Classes</span>
                </div>
              ) : (
                <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={daySlots.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    {daySlots.map(slot => (
                      <SortableSlot 
                        key={slot.id} 
                        slot={slot} 
                        isDesktop 
                        isSelectMode={isSelectMode}
                        isSelected={selectedSlotIds.includes(slot.id)}
                        onToggleSelect={handleToggleSelectSlot}
                        onEdit={handleEditSlot} 
                        onDelete={handleInitiateDeleteSingle} 
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
        {/* Day Tabs */}
        <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2 -mx-4 px-4 border-b border-[#27272A] mb-4">
          {DAYS.map((day, idx) => (
            <button
              key={day}
              onClick={() => setActiveTab(idx)}
              className={`whitespace-nowrap px-5 py-3 text-xs font-bold transition-all aether-mono ${
                activeTab === idx 
                  ? "bg-card text-foreground border-t border-l border-r border-border" 
                  : "bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {day}
            </button>
          ))}
        </div>

        {/* Slots List for Selected Day */}
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
                    isSelectMode={isSelectMode}
                    isSelected={selectedSlotIds.includes(slot.id)}
                    onToggleSelect={handleToggleSelectSlot}
                    onEdit={handleEditSlot} 
                    onDelete={handleInitiateDeleteSingle} 
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {activeSemester && (
        <SubjectReconciliationModal
          isOpen={isReconciliationOpen}
          onClose={() => setIsReconciliationOpen(false)}
          semesterId={activeSemester.id}
          newSubjectIds={newSubjectIds}
          existingSubjectIds={existingSubjectIds}
          onComplete={() => {
            setIsReconciliationOpen(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
};
