import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2, Edit2, GripVertical } from "lucide-react";

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

interface SortableSlotProps {
  slot: TimetableSlot;
  onEdit: (slot: TimetableSlot) => void;
  onDelete: (id: string) => void;
  isDesktop?: boolean;
}

export const SortableSlot: React.FC<SortableSlotProps> = ({ slot, onEdit, onDelete, isDesktop }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slot.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  if (isDesktop) {
    return (
      <div 
        ref={setNodeRef}
        style={style}
        className="relative group p-3 rounded-xl border border-white/5 hover:border-white/20 transition-all duration-300"
        {...attributes}
        {...listeners}
      >
        {/* Color Accent */}
        <div 
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl opacity-70 group-hover:opacity-100 transition-opacity" 
          style={{ backgroundColor: slot.subject?.colorHex || "#8b5cf6" }} 
        />
        <div className="pl-2">
          <div className="flex justify-between items-start mb-1">
            <span className="text-xs font-bold text-white/90">{slot.startTime}</span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity -mt-1 -mr-1">
              <button
                onPointerDown={(e) => { e.stopPropagation(); onEdit(slot); }}
                className="text-muted-foreground hover:text-blue-400 p-1"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onPointerDown={(e) => { e.stopPropagation(); onDelete(slot.id); }}
                className="text-muted-foreground hover:text-red-400 p-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <h3 className="text-sm font-bold text-white leading-tight mb-1 truncate" title={slot.subject?.name}>{slot.subject?.name}</h3>
          <div className="flex items-center justify-between text-[10px] uppercase font-bold text-muted-foreground">
            <span className="bg-white/5 px-1.5 py-0.5 rounded">{slot.slotType}</span>
            {slot.room && <span className="truncate max-w-[60px]">{slot.room}</span>}
          </div>
        </div>
      </div>
    );
  }

  // Mobile layout
  return (
    <div 
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-4 bg-[#0c0d12] border border-white/5 rounded-2xl group hover:border-white/10 transition-colors shadow-sm"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div 
          {...attributes}
          {...listeners}
          className="p-1 -ml-2 text-muted-foreground/50 hover:text-white cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="w-5 h-5" />
        </div>
        <div className="w-1.5 h-14 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: slot.subject?.colorHex || "#8b5cf6" }} />
        <div className="flex-1 min-w-0 ml-2">
          <h3 className="text-base font-bold text-white truncate">{slot.subject?.name || "Unknown Subject"}</h3>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            <span className="bg-white/5 px-2 py-0.5 rounded-md text-white/90 shadow-sm">{slot.startTime} - {slot.endTime}</span>
            <span>• {slot.slotType}</span>
            {slot.room && <span className="truncate max-w-[80px]">• {slot.room}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 ml-3">
        <button
          onClick={() => onEdit(slot)}
          className="p-3 text-muted-foreground hover:text-blue-400 bg-white/5 rounded-xl transition-colors"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(slot.id)}
          className="p-3 text-muted-foreground hover:text-red-400 bg-white/5 rounded-xl transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
