import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Trash2, AlertTriangle, X } from "lucide-react";
import { SoundFX } from "../../utils/soundEffects";
import { hapticMedium, hapticHeavy, hapticSelection } from "../../utils/haptics";

export interface ConfirmDeleteToastOptions {
  title?: string;
  description?: string;
  itemName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  durationMs?: number;
  icon?: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

interface ToastContentProps extends ConfirmDeleteToastOptions {
  toastId: string | number;
}

const ConfirmDeleteToastContent: React.FC<ToastContentProps> = ({
  toastId,
  title = "Delete Item",
  description = "Are you sure you want to delete this? This action cannot be undone.",
  itemName,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  durationMs = 7000,
  icon,
  onConfirm,
  onCancel,
}) => {
  const [isExiting, setIsExiting] = useState(false);
  const [exitType, setExitType] = useState<"confirm" | "cancel">("cancel");

  const handleCancel = () => {
    hapticSelection();
    setExitType("cancel");
    setIsExiting(true);
    setTimeout(() => {
      toast.dismiss(toastId);
      onCancel?.();
    }, 220);
  };

  const handleConfirm = async () => {
    hapticHeavy();
    setExitType("confirm");
    setIsExiting(true);
    setTimeout(() => {
      toast.dismiss(toastId);
    }, 220);
    try {
      await onConfirm();
    } catch (err) {
      console.error("Confirm delete callback error:", err);
    }
  };

  return (
    <div
      role="alert"
      className="w-full max-w-[390px] rounded-2xl border border-rose-500/35 bg-card/95 backdrop-blur-xl shadow-2xl shadow-rose-950/40 p-3.5 relative overflow-hidden flex flex-col gap-3 font-sans transition-all select-none"
      style={{
        animation: isExiting
          ? exitType === "confirm"
            ? "deleteToastConfirmExit 0.28s cubic-bezier(0.2, 0, 0, 1) forwards"
            : "deleteToastCancelExit 0.22s ease-in forwards"
          : "deleteToastSpringIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards",
        boxShadow: "0 12px 32px -4px rgba(244, 63, 94, 0.28), 0 0 0 1px rgba(244, 63, 94, 0.35)",
      }}
    >
      <style>{`
        @keyframes deleteToastSpringIn {
          0% {
            transform: perspective(600px) translateY(-36px) scale(0.9) rotateX(12deg);
            opacity: 0;
            filter: blur(4px);
          }
          60% {
            transform: perspective(600px) translateY(4px) scale(1.02) rotateX(-2deg);
            opacity: 1;
            filter: blur(0px);
          }
          80% {
            transform: perspective(600px) translateY(-2px) scale(0.99) rotateX(0deg);
          }
          100% {
            transform: perspective(600px) translateY(0) scale(1) rotateX(0deg);
            opacity: 1;
          }
        }
        @keyframes deleteToastConfirmExit {
          0% {
            transform: scale(1) translateY(0);
            opacity: 1;
            filter: blur(0px);
          }
          35% {
            transform: scale(1.04) translateY(-2px);
            opacity: 1;
            box-shadow: 0 0 25px rgba(244, 63, 94, 0.7);
          }
          100% {
            transform: scale(0.84) translateY(-14px);
            opacity: 0;
            filter: blur(6px);
          }
        }
        @keyframes deleteToastCancelExit {
          0% {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
          100% {
            transform: scale(0.92) translateY(-22px);
            opacity: 0;
            filter: blur(3px);
          }
        }
        @keyframes trashIconWiggle {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(-8deg); }
          40% { transform: rotate(8deg); }
          60% { transform: rotate(-4deg); }
          80% { transform: rotate(4deg); }
        }
        @keyframes toastDepleteProgress {
          0% { width: 100%; }
          100% { width: 0%; }
        }
      `}</style>

      {/* Main Content Row */}
      <div className="flex items-start gap-3">
        {/* Animated Badge */}
        <div
          className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-500 flex items-center justify-center flex-shrink-0 shadow-inner"
          style={{ animation: "trashIconWiggle 1.4s ease-in-out 0.2s" }}
        >
          {icon || <Trash2 className="w-5 h-5" />}
        </div>

        {/* Text Details */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-foreground tracking-tight truncate">
              {title}
            </h4>
            <button
              type="button"
              onClick={handleCancel}
              className="text-muted-foreground hover:text-foreground p-1 -mr-1 -mt-1 rounded-lg transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
            {description}
          </p>
          {itemName && (
            <div className="mt-1">
              <span className="text-[11px] font-mono font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/20 truncate max-w-[240px] inline-block shadow-sm">
                {itemName}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
        <button
          type="button"
          onClick={handleCancel}
          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted active:scale-95 transition-all cursor-pointer shadow-sm"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 shadow-md shadow-rose-600/35 hover:shadow-rose-600/50 transition-all cursor-pointer flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{confirmLabel}</span>
        </button>
      </div>

      {/* Animated Depleting Countdown Bar */}
      <div
        className="absolute bottom-0 left-0 h-[2.5px] bg-gradient-to-r from-rose-500 via-rose-400 to-amber-500"
        style={{
          animation: `toastDepleteProgress ${durationMs}ms linear forwards`,
        }}
      />
    </div>
  );
};

/**
 * Triggers a cinematic, micro-physics delete confirmation toast.
 * Replaces generic browser toasts with an interactive spring-animated card,
 * acoustic tactile audio, haptic feedback, and fluid exit dissipation.
 */
export function confirmDeleteToast(options: ConfirmDeleteToastOptions) {
  // Acoustic warning prompt chime and medium haptic vibration
  SoundFX.playPromptAlertSound();
  hapticMedium();

  const durationMs = options.durationMs || 7000;

  return toast.custom(
    (id) => (
      <ConfirmDeleteToastContent
        toastId={id}
        durationMs={durationMs}
        {...options}
      />
    ),
    {
      duration: durationMs,
      position: "top-center",
    }
  );
}
