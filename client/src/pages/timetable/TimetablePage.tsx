import React, { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, CalendarPlus } from "lucide-react";
import { api } from "../../lib/api";

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

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const TimetablePage = () => {
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<number>(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);

  // Form State
  const [isAdding, setIsAdding] = useState(false);
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

  const fetchData = async () => {
    try {
      setIsLoading(true);
      // We assume semesterId is either handled by backend if not provided, or we should fetch the active semester first.
      // For now, let's fetch subjects and just fetch all slots for user. Wait, the backend expects semesterId.
      // We will hit /subjects which gives us subjects with their slots, or we need an endpoint.
      // Let's assume we can hit /subjects and extract slots, or hit /timetable/:semesterId.
      // Since semesterId might not be easily available without a call, let's just fetch subjects and extract slots for now.
      const res = await api.get("/subjects");
      setSubjects(res.data);
      
      const allSlots: TimetableSlot[] = [];
      res.data.forEach((sub: any) => {
        if (sub.timetableSlots) {
          sub.timetableSlots.forEach((slot: any) => {
            allSlots.push({ ...slot, subject: sub });
          });
        }
      });
      setSlots(allSlots.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    } catch (error) {
      console.error("Failed to fetch timetable:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId) return alert("Please select a subject");
    try {
      // Find semesterId from selected subject
      const subject = subjects.find(s => s.id === subjectId);
      const semesterId = (subject as any).semesterId;
      await api.post("/timetable/slots", {
        semesterId,
        subjectId,
        dayOfWeek,
        startTime,
        endTime,
        room,
        slotType
      });
      setIsAdding(false);
      fetchData();
    } catch (error) {
      console.error("Failed to add slot:", error);
    }
  };

  const handleAddExtraClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraSubjectId) return alert("Please select a subject");
    try {
      const subject = subjects.find(s => s.id === extraSubjectId);
      const semesterId = (subject as any).semesterId;
      await api.post("/timetable/extra-class", {
        semesterId,
        subjectId: extraSubjectId,
        date: extraDate,
        startTime: "17:30", // default or can be added to form
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

  const currentDaySlots = slots.filter(s => s.dayOfWeek === activeTab);

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
          <h1 className="text-2xl font-bold text-white">Weekly Timetable</h1>
          <p className="text-sm text-muted-foreground">Manage your regular classes and extra sessions.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsAddingExtra(!isAddingExtra)}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <CalendarPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Extra Class</span>
          </button>
          <button
            onClick={() => { setIsAdding(true); setDayOfWeek(activeTab); }}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Slot</span>
          </button>
        </div>
      </div>

      {isAddingExtra && (
        <form onSubmit={handleAddExtraClass} className="bg-[#1a1b23] border border-white/10 rounded-2xl p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><CalendarPlus className="w-5 h-5 text-blue-400" /> Schedule Extra Class</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</label>
              <input
                type="date"
                required
                value={extraDate}
                onChange={(e) => setExtraDate(e.target.value)}
                className="w-full bg-[#13151a] border border-white/5 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subject</label>
              <select
                required
                value={extraSubjectId}
                onChange={(e) => setExtraSubjectId(e.target.value)}
                className="w-full bg-[#13151a] border border-white/5 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                <option value="">Select a subject...</option>
                {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setIsAddingExtra(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-white transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors">Schedule Class</button>
          </div>
        </form>
      )}

      {isAdding && (
        <form onSubmit={handleAddSlot} className="bg-[#0c0d12] border border-primary/20 rounded-2xl p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white">Add Timetable Slot</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Day</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full bg-[#13151a] border border-white/5 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                {DAYS.map((day, idx) => <option key={day} value={idx}>{day}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subject</label>
              <select
                required
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full bg-[#13151a] border border-white/5 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                <option value="">Select...</option>
                {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Room (Optional)</label>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="e.g. L-101"
                className="w-full bg-[#13151a] border border-white/5 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Start Time</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-[#13151a] border border-white/5 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">End Time</label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-[#13151a] border border-white/5 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</label>
              <select
                value={slotType}
                onChange={(e) => setSlotType(e.target.value)}
                className="w-full bg-[#13151a] border border-white/5 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                <option value="lecture">Lecture</option>
                <option value="tutorial">Tutorial</option>
                <option value="practical">Practical</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-white transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">Save Slot</button>
          </div>
        </form>
      )}

      {/* Days Tabs */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2">
        {DAYS.map((day, idx) => (
          <button
            key={day}
            onClick={() => setActiveTab(idx)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === idx 
                ? "bg-white text-black" 
                : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white"
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {/* Slots List */}
      <div className="space-y-3 mt-4">
        {currentDaySlots.length === 0 ? (
          <div className="text-center py-12 bg-[#0c0d12] border border-white/5 rounded-2xl">
            <p className="text-muted-foreground">No classes scheduled for {DAYS[activeTab]}.</p>
          </div>
        ) : (
          currentDaySlots.map(slot => (
            <div key={slot.id} className="flex items-center justify-between p-4 bg-[#0c0d12] border border-white/5 rounded-2xl group hover:border-white/10 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-1.5 h-12 rounded-full" style={{ backgroundColor: slot.subject?.colorHex || "#8b5cf6" }} />
                <div>
                  <h3 className="text-base font-semibold text-white">{slot.subject?.name || "Unknown Subject"}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-medium">
                    <span className="bg-white/5 px-2 py-0.5 rounded text-white/80">{slot.startTime} - {slot.endTime}</span>
                    <span className="uppercase tracking-wide">{slot.slotType}</span>
                    {slot.room && <span>• {slot.room}</span>}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDeleteSlot(slot.id)}
                className="p-2 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove Slot"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
