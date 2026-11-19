import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Clock,
  Loader2,
  Lock,
  Search,
  Square,
  Star,
  X,
} from "lucide-react";
import { api } from "../../lib/api";
import { ClassroomPoll, PollVotesDetailResponse } from "../../types/classroomPoll";
import { useScrollLock } from "../../hooks/useScrollLock";
import { useBackHandlerStore } from "../../stores/backHandlerStore";
import { formatPollCountdown } from "./PollCard";
import { hapticLight, hapticMedium } from "../../utils/haptics";

interface PollVotesModalProps {
  isOpen: boolean;
  classroomId: string;
  poll: ClassroomPoll | null;
  nowMs: number;
  onClose: () => void;
  onStopPoll: (poll: ClassroomPoll) => Promise<void> | void;
  onPollSynced?: (updated: ClassroomPoll) => void;
}

const AVATAR_PALETTE = [
  "bg-emerald-600",
  "bg-sky-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-teal-600",
  "bg-blue-600",
];

function getInitials(name: string): string {
  const parts = String(name || "M")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "M";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function formatVoteTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const PollVotesModal: React.FC<PollVotesModalProps> = ({
  isOpen,
  classroomId,
  poll,
  nowMs,
  onClose,
  onStopPoll,
  onPollSynced,
}) => {
  useScrollLock(isOpen);

  const [details, setDetails] = useState<PollVotesDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedOptions, setExpandedOptions] = useState<Record<string, boolean>>({});
  const [confirmingStop, setConfirmingStop] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onPollSyncedRef = useRef(onPollSynced);
  onPollSyncedRef.current = onPollSynced;

  useEffect(() => {
    if (!isOpen) return;
    const unregister = useBackHandlerStore.getState().register(() => {
      onCloseRef.current();
      return true;
    });
    return unregister;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !poll?.id) {
      setDetails(null);
      setSelectedOptionId("all");
      setSearchQuery("");
      setExpandedOptions({});
      setConfirmingStop(false);
      return;
    }

    let cancelled = false;
    const fetchDetails = async (initial: boolean) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (initial) setLoading(false);
        return;
      }
      try {
        if (initial) setLoading(true);
        const res = await api.get<PollVotesDetailResponse>(
          `/classrooms/${classroomId}/polls/${poll.id}/votes`,
          {
            params: { t: Date.now() },
            silent: true,
            skipToast: true,
          }
        );
        if (cancelled || !res.data?.poll) return;
        setDetails(res.data);
        onPollSyncedRef.current?.(res.data.poll);
      } catch {
        // Silent background poll — never surface transient errors as toasts
      } finally {
        if (initial && !cancelled) setLoading(false);
      }
    };

    fetchDetails(true);

    // Silent 2.5s live sync while inspecting voter breakdown
    const interval = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        (typeof navigator === "undefined" || navigator.onLine)
      ) {
        fetchDetails(false);
      }
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isOpen, classroomId, poll?.id]);

  const activePoll = details?.poll || poll;

  const isLocallyExpired = Boolean(
    activePoll &&
      !activePoll.stoppedAt &&
      activePoll.closesAt &&
      new Date(activePoll.closesAt).getTime() <= nowMs
  );
  const isClosed = Boolean(activePoll?.isClosed || isLocallyExpired);
  const countdown = activePoll && !isClosed ? formatPollCountdown(activePoll.closesAt, nowMs) : null;

  const turnoutPct = useMemo(() => {
    if (details?.turnoutPct !== undefined) return details.turnoutPct;
    if (!activePoll || !activePoll.totalMembers) return 0;
    return Math.min(100, Math.round((activePoll.uniqueVotersCount / activePoll.totalMembers) * 100));
  }, [details?.turnoutPct, activePoll]);

  const filteredOptions = useMemo(() => {
    const list = details?.options || [];
    return selectedOptionId === "all"
      ? list
      : list.filter((o) => o.id === selectedOptionId);
  }, [details?.options, selectedOptionId]);

  const handleConfirmStop = async () => {
    if (!activePoll) return;
    try {
      setIsStopping(true);
      hapticMedium();
      await onStopPoll(activePoll);
      setConfirmingStop(false);
      // Immediately re-fetch final breakdown silently
      const res = await api.get<PollVotesDetailResponse>(
        `/classrooms/${classroomId}/polls/${activePoll.id}/votes`,
        { params: { t: Date.now() }, silent: true, skipToast: true }
      );
      if (res.data?.poll) {
        setDetails(res.data);
        onPollSyncedRef.current?.(res.data.poll);
      }
    } catch {
      // Errors for user-initiated stop handled by parent
    } finally {
      setIsStopping(false);
    }
  };

  if (!isOpen || !activePoll || typeof document === "undefined") return null;

  const qLower = searchQuery.trim().toLowerCase();

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[105] flex items-center justify-center px-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] sm:p-4 bg-slate-950/40 dark:bg-black/75 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#0d0e11] border border-neutral-200 dark:border-neutral-800 rounded-3xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
      >
        {/* Top Bar */}
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-base font-bold text-neutral-900 dark:text-slate-100 truncate">
              Poll Details
            </h3>
            {isClosed ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-[#181a20] text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 shrink-0">
                <Lock className="w-3 h-3" />
                Closed
              </span>
            ) : countdown ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 tabular-nums shrink-0">
                <Clock className="w-3 h-3" />
                {countdown}
              </span>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-neutral-100 dark:hover:bg-[#1a1c22] flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto divide-y divide-neutral-200 dark:divide-neutral-800">
          {/* Question & Turnout Summary */}
          <div className="p-5 space-y-3.5">
            <p className="text-sm sm:text-base font-bold text-neutral-900 dark:text-slate-100 leading-snug whitespace-pre-wrap">
              {activePoll.question}
            </p>

            {/* Turnout Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono tabular-nums text-neutral-600 dark:text-neutral-300 font-semibold">
                  {activePoll.uniqueVotersCount}
                  {activePoll.totalMembers > 0 ? ` of ${activePoll.totalMembers}` : ""} members voted
                </span>
                <span className="font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                  {turnoutPct}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-neutral-200/80 dark:bg-neutral-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${turnoutPct}%` }}
                />
              </div>
            </div>

            {/* Author Stop Poll Control */}
            {activePoll.canStop && !isClosed && (
              <div className="flex items-center justify-end gap-2 pt-1">
                {confirmingStop ? (
                  <>
                    <button
                      type="button"
                      disabled={isStopping}
                      onClick={handleConfirmStop}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-slate-50 text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      {isStopping ? "Stopping..." : "Confirm Stop"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingStop(false)}
                      className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setConfirmingStop(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-700/80 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold cursor-pointer"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    Stop poll
                  </button>
                )}
              </div>
            )}

            {/* Option Filter Chips + Search */}
            {!activePoll.resultsHidden && details && (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSelectedOptionId("all")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      selectedOptionId === "all"
                        ? "bg-neutral-900 text-slate-50 border-neutral-900 dark:bg-slate-50 dark:text-neutral-950 dark:border-slate-50"
                        : "bg-neutral-50 dark:bg-[#141519] text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800"
                    }`}
                  >
                    All
                  </button>
                  {details.options.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedOptionId(opt.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer max-w-[180px] truncate ${
                        selectedOptionId === opt.id
                          ? "bg-neutral-900 text-slate-50 border-neutral-900 dark:bg-slate-50 dark:text-neutral-950 dark:border-slate-50"
                          : "bg-neutral-50 dark:bg-[#141519] text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800"
                      }`}
                    >
                      {opt.label} ({opt.voteCount ?? 0})
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name or roll no"
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-neutral-50 dark:bg-[#121318] border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-slate-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 outline-none focus:border-neutral-900 dark:focus:border-slate-300"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Voter Lists per Option */}
          {loading && !details ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-neutral-500 dark:text-neutral-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : activePoll.resultsHidden && !isClosed ? (
            <div className="p-8 text-center text-xs text-neutral-500 dark:text-neutral-400">
              Results reveal when closed.
            </div>
          ) : (
            filteredOptions.map((opt) => {
              const matchedVoters = qLower
                ? opt.voters.filter(
                    (v) =>
                      v.name.toLowerCase().includes(qLower) ||
                      String(v.rollNumber || "").toLowerCase().includes(qLower)
                  )
                : opt.voters;
              const isExpanded = Boolean(expandedOptions[opt.id]);
              const shown = isExpanded ? matchedVoters : matchedVoters.slice(0, 5);
              const hiddenCount = Math.max(0, matchedVoters.length - shown.length);

              return (
                <div key={opt.id} className="p-5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-neutral-900 dark:text-slate-100 break-words">
                        {opt.label}
                      </h4>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
                        {opt.isWinner && (
                          <Star className="w-3 h-3 text-emerald-600 dark:text-emerald-400 fill-current shrink-0" />
                        )}
                        <span>
                          {opt.voteCount ?? 0}{" "}
                          {(opt.voteCount ?? 0) === 1 ? "vote" : "votes"} ·{" "}
                          {opt.percentage ?? 0}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {shown.length === 0 ? (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {qLower ? "No matching voters" : "0 votes"}
                    </p>
                  ) : (
                    <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
                      {shown.map((voter) => (
                        <div
                          key={`${opt.id}-${voter.id}`}
                          className="py-2.5 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {voter.avatarUrl ? (
                              <img
                                src={voter.avatarUrl}
                                alt={voter.name}
                                className="w-8 h-8 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <span
                                className={`w-8 h-8 rounded-full text-xs font-bold text-slate-50 inline-flex items-center justify-center shrink-0 ${getAvatarColor(voter.id)}`}
                              >
                                {getInitials(voter.name)}
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-neutral-900 dark:text-slate-100 truncate">
                                {voter.isCurrentUser ? "You" : voter.name}
                              </p>
                              <p className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                                {formatVoteTime(voter.votedAt)}
                              </p>
                            </div>
                          </div>

                          {voter.rollNumber && (
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-[#16181d] border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 shrink-0">
                              {voter.rollNumber}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedOptions((prev) => ({
                          ...prev,
                          [opt.id]: !prev[opt.id],
                        }))
                      }
                      className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      See all ({hiddenCount} more)
                    </button>
                  )}
                  {isExpanded && matchedVoters.length > 5 && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedOptions((prev) => ({
                          ...prev,
                          [opt.id]: false,
                        }))
                      }
                      className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 hover:underline cursor-pointer"
                    >
                      Show fewer
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
