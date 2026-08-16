import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Trash2,
  Edit2,
  GripVertical,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { normalizeTimeString, formatTimeRange } from "../../utils/timeUtils";

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
  onDelete: (slot: TimetableSlot) => void;
  isDesktop?: boolean;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (slotId: string) => void;
}

export const SortableSlot: React.FC<SortableSlotProps> = ({
  slot,
  onEdit,
  onDelete,
  isDesktop,
  isSelectMode,
  isSelected,
  onToggleSelect,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slot.id, disabled: isSelectMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  const normalizedStart = normalizeTimeString(slot.startTime, "09:00");
  const normalizedEnd = normalizeTimeString(slot.endTime, "10:00");
  const displayTimeRange = formatTimeRange(
    normalizedStart,
    normalizedEnd,
    "09:00 - 10:00",
  );

  if (isDesktop) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        onClick={() => {
          if (isSelectMode && onToggleSelect) {
            onToggleSelect(slot.id);
          }
        }}
        className={`relative group p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
          isSelected
            ? "border-primary bg-primary/10 shadow-sm"
            : "border-border bg-card/90 hover:border-primary/50 hover:shadow-md"
        }`}
        {...(!isSelectMode ? attributes : {})}
        {...(!isSelectMode ? listeners : {})}
      >
        {/* Selection Indicator or Color Accent */}
        {isSelectMode ? (
          <div className="absolute right-2.5 top-2.5 z-10">
            {isSelected ? (
              <CheckCircle2 className="w-4 h-4 text-primary fill-primary/20" />
            ) : (
              <Circle className="w-4 h-4 text-muted-foreground/40" />
            )}
          </div>
        ) : null}

        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl opacity-100 transition-opacity"
          style={{ backgroundColor: slot.subject?.colorHex || "#8b5cf6" }}
        />
        <div className="pl-2 pr-4">
          <div className="flex justify-between items-start mb-1">
            <span className="text-xs font-bold text-foreground/90 font-mono">
              {normalizedStart}
            </span>
            {!isSelectMode && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity -mt-1 -mr-1">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onEdit(slot);
                  }}
                  className="text-muted-foreground hover:text-blue-500 p-1 cursor-pointer"
                  title="Edit slot"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onDelete(slot);
                  }}
                  className="text-muted-foreground hover:text-rose-500 p-1 cursor-pointer"
                  title="Delete slot"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          <h3
            className="text-sm font-bold text-foreground leading-tight mb-1 truncate"
            title={slot.subject?.name}
          >
            {slot.subject?.name}
          </h3>
          <div className="flex items-center justify-between text-[10px] uppercase font-bold text-muted-foreground">
            <span className="bg-muted px-1.5 py-0.5 rounded text-foreground/80">
              {slot.slotType}
            </span>
            {slot.room && (
              <span className="truncate max-w-[60px]">{slot.room}</span>
            )}
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
      onClick={() => {
        if (isSelectMode && onToggleSelect) {
          onToggleSelect(slot.id);
        }
      }}
      className={`flex items-center justify-between p-4 rounded-2xl border transition-all shadow-sm ${
        isSelected
          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
          : "bg-card border-border hover:border-border/80"
      }`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {isSelectMode ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.(slot.id);
            }}
            className="text-muted-foreground cursor-pointer flex-shrink-0"
          >
            {isSelected ? (
              <CheckCircle2 className="w-5 h-5 text-primary fill-primary/20" />
            ) : (
              <Circle className="w-5 h-5 text-muted-foreground/50" />
            )}
          </button>
        ) : (
          <div
            {...attributes}
            {...listeners}
            className="p-1 -ml-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
          >
            <GripVertical className="w-5 h-5" />
          </div>
        )}

        <div
          className="w-1.5 h-12 rounded-full flex-shrink-0 shadow-sm"
          style={{ backgroundColor: slot.subject?.colorHex || "#8b5cf6" }}
        />

        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-foreground truncate">
            {slot.subject?.name || "Unknown Subject"}
          </h3>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            <span className="bg-muted px-2 py-0.5 rounded-md text-foreground/90 font-semibold font-mono shadow-sm">
              {displayTimeRange}
            </span>
            <span>• {slot.slotType}</span>
            {slot.room && (
              <span className="truncate max-w-[80px]">• {slot.room}</span>
            )}
          </div>
        </div>
      </div>

      {!isSelectMode && (
        <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(slot);
            }}
            className="p-2.5 text-muted-foreground hover:text-blue-500 bg-muted hover:bg-muted/80 rounded-xl transition-colors cursor-pointer"
            title="Edit slot"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(slot);
            }}
            className="p-2.5 text-muted-foreground hover:text-rose-500 bg-muted hover:bg-muted/80 rounded-xl transition-colors cursor-pointer"
            title="Delete slot"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
