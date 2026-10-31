import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { useNavigate } from "react-router-dom";
import { CSS } from "@dnd-kit/utilities";
import { Trash2, Edit2, GripVertical, CheckCircle2, Circle } from "lucide-react";
import { normalizeTimeString, formatTimeRange, formatTo12Hour } from "../../utils/timeUtils";

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
  isCrumbling?: boolean;
  isFluttering?: boolean;
  isDominoFalling?: boolean;
  dominoIndex?: number;
  isRainDropping?: boolean;
  rainIndex?: number;
  isJustDropped?: boolean;
}

export const SortableSlot: React.FC<SortableSlotProps> = ({
  slot,
  onEdit,
  onDelete,
  isDesktop,
  isSelectMode,
  isSelected,
  onToggleSelect,
  isCrumbling,
  isFluttering,
  isDominoFalling,
  dominoIndex = 0,
  isRainDropping = false,
  rainIndex = 0,
  isJustDropped = false,
}) => {
  const isCrumpling = isCrumbling || isFluttering;
  const navigate = useNavigate();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slot.id, disabled: isSelectMode });

  const style: React.CSSProperties = {
    transform: isDominoFalling || isRainDropping || isJustDropped ? undefined : CSS.Transform.toString(transform),
    transition: isDominoFalling || isCrumpling || isRainDropping || isJustDropped ? undefined : transition,
    zIndex: isDragging ? 25 : isJustDropped ? 20 : isCrumpling ? 50 : 1,
    opacity: isDragging ? 0.75 : 1,
    ...(isCrumpling
      ? {
          animation: "origamiPaperCrumbleSlot 4.0s cubic-bezier(0.4, 0, 0.2, 1) forwards",
          pointerEvents: "none",
        }
      : {}),
    ...(isDominoFalling
      ? {
          transformOrigin: "top center",
          animation: `dominoCascadeFall 1.1s cubic-bezier(0.25, 1, 0.5, 1) ${0.15 + dominoIndex * 0.142}s forwards`,
          pointerEvents: "none",
        }
      : {}),
    ...(isRainDropping
      ? {
          animation: `rainDropSlot 0.65s cubic-bezier(0.22, 1, 0.36, 1) ${Math.min(rainIndex * 0.04, 1.15)}s backwards`,
        }
      : {}),
    ...(isJustDropped
      ? {
          animation: "slotDropSnap 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards",
        }
      : {}),
  };

  const normalizedStart = normalizeTimeString(slot.startTime, "09:00");
  const normalizedEnd = normalizeTimeString(slot.endTime, "10:00");
  const displayTimeRange = formatTimeRange(normalizedStart, normalizedEnd, "09:00 - 10:00");
  const niceTimeFormat = `${formatTo12Hour(normalizedStart)} - ${formatTo12Hour(normalizedEnd)}`;

  return (
    <>
      <style>{`
        @keyframes origamiPaperCrumbleSlot {
          0% { transform: perspective(900px) scale(1) rotateX(0deg) rotateY(0deg) rotateZ(0deg) translateY(0); opacity: 1; filter: blur(0px); border-radius: 12px; }
          15% { transform: perspective(900px) scale(0.96) rotateX(24deg) rotateY(-18deg) rotateZ(6deg) translateY(-8px); opacity: 0.98; box-shadow: 0 16px 30px rgba(0,0,0,0.3); }
          35% { transform: perspective(900px) scale(0.82) rotateX(-36deg) rotateY(42deg) rotateZ(-16deg) translateY(-14px); opacity: 0.92; filter: contrast(1.15); border-radius: 18px; }
          55% { transform: perspective(900px) scale(0.65) rotateX(65deg) rotateY(-60deg) rotateZ(35deg) translateY(-8px); opacity: 0.82; border-radius: 35%; }
          75% { transform: perspective(900px) scale(0.42) rotateX(-85deg) rotateY(120deg) rotateZ(-70deg) translateY(15px); opacity: 0.65; border-radius: 50%; filter: blur(0.5px); }
          90% { transform: perspective(900px) scale(0.24) rotateX(160deg) rotateY(240deg) rotateZ(180deg) translateY(65px); opacity: 0.35; border-radius: 50%; filter: blur(2px); }
          100% { transform: perspective(900px) scale(0) rotateX(220deg) rotateY(360deg) rotateZ(270deg) translateY(120px); opacity: 0; filter: blur(6px); visibility: hidden; }
        }
        @keyframes dominoCascadeFall {
          0% { transform: perspective(800px) rotateX(0deg) translateY(0) scale(1); opacity: 1; }
          50% { transform: perspective(800px) rotateX(70deg) translateY(25px) scale(0.92); opacity: 0.8; }
          100% { transform: perspective(800px) rotateX(90deg) translateY(55px) scale(0.7); opacity: 0; }
        }
        @keyframes rainDropSlot {
          0% {
            opacity: 0;
            transform: perspective(800px) translateY(-85px) scaleY(1.2) scaleX(0.88);
            filter: blur(4px);
          }
          55% {
            opacity: 0.95;
            transform: perspective(800px) translateY(6px) scaleY(0.92) scaleX(1.05);
            filter: blur(0px);
          }
          75% {
            transform: perspective(800px) translateY(-3px) scaleY(1.03) scaleX(0.98);
          }
          100% {
            opacity: 1;
            transform: perspective(800px) translateY(0px) scale(1);
            filter: blur(0px);
          }
        }
        @keyframes slotDropSnap {
          0% {
            transform: scale(1.06) translateY(-8px);
            box-shadow: 0 14px 28px -4px rgba(59, 130, 246, 0.35), 0 0 0 2px rgba(59, 130, 246, 0.6);
          }
          45% {
            transform: scale(0.97) translateY(2px);
            box-shadow: 0 4px 12px -2px rgba(59, 130, 246, 0.25), 0 0 0 1.5px rgba(59, 130, 246, 0.4);
          }
          75% {
            transform: scale(1.01) translateY(-1px);
          }
          100% {
            transform: scale(1) translateY(0);
            box-shadow: none;
          }
        }
      `}</style>
      {isDesktop ? (
        <div 
          id={`slot-card-${slot.id}`}
          ref={setNodeRef}
          style={style}
          onClick={() => {
            if (isSelectMode && onToggleSelect) {
              onToggleSelect(slot.id);
            } else if (!isSelectMode) {
              onEdit(slot);
            }
          }}
        className={`relative group p-3 rounded-xl border transition-all duration-200 cursor-pointer animate-in fade-in zoom-in-[0.98] ${
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
            <span className="text-[10px] font-bold text-foreground/90 font-mono tracking-tight">{slot.startTime}</span>
            {!isSelectMode && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity -mt-1 -mr-1">
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
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
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
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
          <h3 className="text-sm font-bold text-foreground leading-tight mb-1 truncate" title={slot.subject?.name}>{slot.subject?.name}</h3>
          <div className="flex items-center justify-between text-[10px] uppercase font-bold text-muted-foreground mt-1">
            <span 
              className="px-1.5 py-0.5 rounded-lg border tracking-wider"
              style={{
                backgroundColor: slot.subject?.colorHex ? `${slot.subject.colorHex}15` : "var(--muted)",
                borderColor: slot.subject?.colorHex ? `${slot.subject.colorHex}30` : "transparent",
                color: slot.subject?.colorHex || "var(--foreground)"
              }}
            >
              {slot.slotType}
            </span>
            <span className="truncate max-w-[80px] text-blue-500/80">Room: {slot.room || "TBA"}</span>
          </div>
        </div>
      </div>
      ) : (
      /* Mobile layout */
      <div 
        id={`slot-card-${slot.id}`}
        ref={setNodeRef}
        style={style}
        onClick={() => {
          if (isSelectMode && onToggleSelect) {
            onToggleSelect(slot.id);
          } else if (!isSelectMode) {
            onEdit(slot);
          }
        }}
      className={`flex items-center justify-between p-4 rounded-2xl border transition-all shadow-sm animate-in fade-in zoom-in-[0.98] duration-200 ${
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

        <div className="w-1.5 h-12 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: slot.subject?.colorHex || "#8b5cf6" }} />
        
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-foreground truncate">{slot.subject?.name || "Unknown Subject"}</h3>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            <span className="bg-muted px-2 py-0.5 rounded-lg text-foreground/90 font-semibold font-mono shadow-sm">{displayTimeRange}</span>
            <span 
              className="px-1.5 py-0.5 rounded-lg border tracking-wider"
              style={{
                backgroundColor: slot.subject?.colorHex ? `${slot.subject.colorHex}15` : "var(--muted)",
                borderColor: slot.subject?.colorHex ? `${slot.subject.colorHex}30` : "transparent",
                color: slot.subject?.colorHex || "var(--foreground)"
              }}
            >
              {slot.slotType}
            </span>
            <span className="truncate max-w-[100px] text-blue-500/80">• Room: {slot.room || "TBA"}</span>
          </div>
        </div>
      </div>

      {!isSelectMode && (
        <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
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
            onPointerDown={(e) => e.stopPropagation()}
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
    )}
  </>
  );
};
