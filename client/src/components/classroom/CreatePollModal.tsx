import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Pin, Plus, Send, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { ClassroomPoll, PollMode } from "../../types/classroomPoll";
import { useScrollLock } from "../../hooks/useScrollLock";
import { useBackHandlerStore } from "../../stores/backHandlerStore";
import { hapticLight, hapticSuccess } from "../../utils/haptics";

interface CreatePollModalProps {
  isOpen: boolean;
  classroomId: string;
  onClose: () => void;
  onCreated: (poll: ClassroomPoll) => void;
}

type DeadlinePreset = "15m" | "1h" | "3h" | "tonight" | "24h" | "custom" | "none";

const DEADLINE_OPTIONS: Array<{ id: DeadlinePreset; label: string }> = [
  { id: "15m", label: "15m" },
  { id: "1h", label: "1h" },
  { id: "3h", label: "3h" },
  { id: "tonight", label: "Tonight 11 PM" },
  { id: "24h", label: "24h" },
  { id: "custom", label: "Custom" },
  { id: "none", label: "None" },
];

function computeClosesAt(preset: DeadlinePreset, customLocal: string): string | null {
  const now = Date.now();
  if (preset === "none") return null;
  if (preset === "15m") return new Date(now + 15 * 60 * 1000).toISOString();
  if (preset === "1h") return new Date(now + 60 * 60 * 1000).toISOString();
  if (preset === "3h") return new Date(now + 3 * 60 * 60 * 1000).toISOString();
  if (preset === "24h") return new Date(now + 24 * 60 * 60 * 1000).toISOString();
  if (preset === "tonight") {
    const d = new Date();
    d.setHours(23, 0, 0, 0);
    if (d.getTime() <= now + 5 * 60 * 1000) {
      d.setDate(d.getDate() + 1);
    }
    return d.toISOString();
  }
  if (preset === "custom" && customLocal) {
    const parsed = new Date(customLocal);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return null;
}

function getDefaultCustomLocal(): string {
  const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const CreatePollModal: React.FC<CreatePollModalProps> = ({
  isOpen,
  classroomId,
  onClose,
  onCreated,
}) => {
  useScrollLock(isOpen);

  const [mode, setMode] = useState<PollMode>("yes_no");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["Yes", "No"]);
  const [deadlinePreset, setDeadlinePreset] = useState<DeadlinePreset>("1h");
  const [customDeadline, setCustomDeadline] = useState<string>(getDefaultCustomLocal);
  const [isPinned, setIsPinned] = useState(true);
  const [hideResultsUntilClosed, setHideResultsUntilClosed] = useState(false);
  const [allowVoteChange, setAllowVoteChange] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const unregister = useBackHandlerStore.getState().register(() => {
      onCloseRef.current();
      return true;
    });
    return unregister;
  }, [isOpen]);

  const handleModeChange = (nextMode: PollMode) => {
    hapticLight();
    setMode(nextMode);
    if (nextMode === "yes_no") {
      setOptions((prev) => {
        const a = prev[0]?.trim() || "Yes";
        const b = prev[1]?.trim() || "No";
        return [a, b];
      });
    } else if (options.length === 2 && options[0] === "Yes" && options[1] === "No") {
      setOptions(["", ""]);
    }
  };

  const handleAddOption = () => {
    if (options.length >= 8) return;
    hapticLight();
    setOptions((prev) => [...prev, ""]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    hapticLight();
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setMode("yes_no");
    setQuestion("");
    setOptions(["Yes", "No"]);
    setDeadlinePreset("1h");
    setCustomDeadline(getDefaultCustomLocal());
    setIsPinned(true);
    setHideResultsUntilClosed(false);
    setAllowVoteChange(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQ = question.trim();
    const cleanedOptions = options.map((o) => o.trim()).filter(Boolean);

    if (!trimmedQ) {
      toast.error("Question is required");
      return;
    }
    if (cleanedOptions.length < 2) {
      toast.error("Add at least 2 options");
      return;
    }

    const closesAt = computeClosesAt(deadlinePreset, customDeadline);
    if (deadlinePreset === "custom") {
      if (!closesAt || new Date(closesAt).getTime() <= Date.now() + 30_000) {
        toast.error("Pick a future deadline");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const res = await api.post<ClassroomPoll>(`/classrooms/${classroomId}/polls`, {
        question: trimmedQ,
        mode,
        options: cleanedOptions,
        closesAt,
        isPinned,
        hideResultsUntilClosed,
        allowVoteChange,
      });
      hapticSuccess();
      onCreated(res.data);
      resetForm();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to publish poll");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || typeof document === "undefined") return null;

  const validOptionCount = options.filter((o) => o.trim().length > 0).length;

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[105] flex items-center justify-center px-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] sm:p-4 bg-slate-950/40 dark:bg-black/75 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#0d0e11] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 sm:p-6 w-full max-w-lg max-h-[88vh] overflow-y-auto shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-neutral-900 dark:text-slate-100">
            New Poll
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-neutral-100 dark:hover:bg-[#1a1c22] flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Answer Mode */}
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: "yes_no", label: "Yes / No" },
                { id: "single", label: "Single" },
                { id: "multiple", label: "Multiple" },
              ] as const
            ).map((item) => {
              const active = mode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleModeChange(item.id)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    active
                      ? "bg-neutral-900 text-slate-50 border-neutral-900 dark:bg-slate-50 dark:text-neutral-950 dark:border-slate-50"
                      : "bg-neutral-50 dark:bg-[#121318] text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Question */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
              Question
            </label>
            <textarea
              rows={2}
              maxLength={500}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question"
              className="w-full bg-neutral-50 dark:bg-[#050507] border border-neutral-300 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-neutral-900 dark:text-slate-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 text-sm focus:border-neutral-900 dark:focus:border-slate-300 outline-none resize-none"
              required
            />
          </div>

          {/* Options */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Options
              </label>
              {mode !== "yes_no" && options.length < 8 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              )}
            </div>

            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={120}
                    value={opt}
                    onChange={(e) =>
                      setOptions((prev) =>
                        prev.map((v, i) => (i === idx ? e.target.value : v))
                      )
                    }
                    placeholder={`Option ${idx + 1}`}
                    className="flex-1 bg-neutral-50 dark:bg-[#050507] border border-neutral-300 dark:border-neutral-800 rounded-xl px-3.5 py-2 text-neutral-900 dark:text-slate-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 text-sm focus:border-neutral-900 dark:focus:border-slate-300 outline-none"
                    required
                  />
                  {mode !== "yes_no" && options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="p-2 rounded-xl text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-neutral-100 dark:hover:bg-[#1a1c22] transition-colors cursor-pointer"
                      aria-label={`Remove option ${idx + 1}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Deadline Presets */}
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Deadline
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DEADLINE_OPTIONS.map((item) => {
                const active = deadlinePreset === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setDeadlinePreset(item.id);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      active
                        ? "bg-neutral-900 text-slate-50 border-neutral-900 dark:bg-slate-50 dark:text-neutral-950 dark:border-slate-50"
                        : "bg-neutral-50 dark:bg-[#121318] text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            {deadlinePreset === "custom" && (
              <input
                type="datetime-local"
                value={customDeadline}
                onChange={(e) => setCustomDeadline(e.target.value)}
                className="w-full mt-1.5 bg-neutral-50 dark:bg-[#050507] border border-neutral-300 dark:border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-900 dark:text-slate-100 dark:[color-scheme:dark] outline-none focus:border-neutral-900 dark:focus:border-slate-300"
                required
              />
            )}
          </div>

          {/* Compact Option Switches */}
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden bg-neutral-50 dark:bg-[#121318]">
            <label className="flex items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-900 dark:text-slate-100">
                <Pin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                Pin urgently until closed
              </span>
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 cursor-pointer shrink-0"
              />
            </label>

            <label className="flex items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer">
              <div>
                <div className="text-xs font-semibold text-neutral-900 dark:text-slate-100">
                  Hide results until closed
                </div>
                {hideResultsUntilClosed && (
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Counts and voters reveal after close
                  </div>
                )}
              </div>
              <input
                type="checkbox"
                checked={hideResultsUntilClosed}
                onChange={(e) => setHideResultsUntilClosed(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 cursor-pointer shrink-0"
              />
            </label>

            <label className="flex items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer">
              <div>
                <div className="text-xs font-semibold text-neutral-900 dark:text-slate-100">
                  Allow changing vote
                </div>
                {!allowVoteChange && (
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Votes lock immediately on submit
                  </div>
                )}
              </div>
              <input
                type="checkbox"
                checked={allowVoteChange}
                onChange={(e) => setAllowVoteChange(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 cursor-pointer shrink-0"
              />
            </label>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold rounded-xl text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-slate-100 hover:bg-neutral-100 dark:hover:bg-[#1a1c22] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !question.trim() || validOptionCount < 2}
              className="px-5 py-2.5 bg-neutral-900 text-slate-50 hover:bg-neutral-800 dark:bg-slate-50 dark:text-neutral-950 dark:hover:bg-neutral-200 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Publish Poll
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
