import React, { useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Clock,
  EyeOff,
  Lock,
  Pin,
  Square,
  Trash2,
  Trophy,
  User,
} from "lucide-react";
import { ClassroomPoll } from "../../types/classroomPoll";
import { hapticLight, hapticMedium, hapticSelection } from "../../utils/haptics";

interface PollCardProps {
  poll: ClassroomPoll;
  nowMs: number;
  isBusy?: boolean;
  onVote: (poll: ClassroomPoll, nextOptionIds: string[]) => void;
  onStop: (poll: ClassroomPoll) => Promise<void> | void;
  onDelete?: (poll: ClassroomPoll) => Promise<void> | void;
  onViewVotes: (poll: ClassroomPoll) => void;
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

export function formatPollCountdown(closesAt: string | null, nowMs: number): string | null {
  if (!closesAt) return null;
  const diff = new Date(closesAt).getTime() - nowMs;
  if (Number.isNaN(diff) || diff <= 0) return null;
  const totalSec = Math.floor(diff / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export const PollCard: React.FC<PollCardProps> = ({
  poll,
  nowMs,
  isBusy = false,
  onVote,
  onStop,
  onDelete,
  onViewVotes,
}) => {
  const [confirmingStop, setConfirmingStop] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const closesAtMs = poll.closesAt ? new Date(poll.closesAt).getTime() : null;
  const isLocallyExpired = Boolean(
    !poll.stoppedAt && closesAtMs !== null && !Number.isNaN(closesAtMs) && closesAtMs <= nowMs
  );
  const isClosed = poll.isClosed || isLocallyExpired;
  const isActivePin = Boolean(poll.isPinned && !isClosed);
  const resultsHidden = Boolean(poll.hideResultsUntilClosed && !isClosed);
  const countdown = !isClosed ? formatPollCountdown(poll.closesAt, nowMs) : null;
  const isMultiple = poll.mode === "multiple";
  const isVoteLockedForUser = !isClosed && !poll.allowVoteChange && poll.hasVoted;
  const votingDisabled = isClosed || isVoteLockedForUser || isBusy;

  const { maxVotes, winners } = useMemo(() => {
    const counts = poll.options.map((o) => o.voteCount ?? 0);
    const max = counts.length > 0 ? Math.max(...counts) : 0;
    const winOpts =
      isClosed && max > 0 && !resultsHidden
        ? poll.options.filter((o) => (o.voteCount ?? 0) === max)
        : [];
    return { maxVotes: max, winners: winOpts };
  }, [poll.options, isClosed, resultsHidden]);

  const handleOptionPress = (optionId: string) => {
    if (votingDisabled) return;
    const currentlySelected = poll.myOptionIds.includes(optionId);
    let nextOptionIds: string[];

    if (isMultiple) {
      if (currentlySelected) {
        nextOptionIds = poll.myOptionIds.filter((id) => id !== optionId);
      } else {
        nextOptionIds = [...poll.myOptionIds, optionId];
      }
    } else {
      if (currentlySelected) {
        nextOptionIds = poll.allowVoteChange ? [] : [optionId];
      } else {
        nextOptionIds = [optionId];
      }
    }

    hapticSelection();
    onVote(poll, nextOptionIds);
  };

  const handleConfirmStop = async () => {
    try {
      setIsStopping(true);
      hapticMedium();
      await onStop(poll);
      setConfirmingStop(false);
    } finally {
      setIsStopping(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!onDelete) return;
    try {
      setIsDeleting(true);
      hapticMedium();
      await onDelete(poll);
      setConfirmingDelete(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const modeMeta = useMemo(() => {
    const parts: string[] = [];
    if (isClosed) {
      parts.push("Final results");
    } else if (poll.mode === "yes_no") {
      parts.push("Yes / No");
    } else if (poll.mode === "multiple") {
      parts.push("Select multiple");
    } else {
      parts.push("Select one");
    }
    if (!isClosed && resultsHidden) {
      parts.push("Results hidden until closed");
    }
    if (!isClosed && !poll.allowVoteChange) {
      parts.push(poll.hasVoted ? "Vote locked" : "Single submission");
    }
    return parts.join(" · ");
  }, [isClosed, poll.mode, poll.allowVoteChange, poll.hasVoted, resultsHidden]);

  const createdTimeLabel = useMemo(() => {
    const d = new Date(poll.createdAt);
    if (Number.isNaN(d.getTime())) return "";
    const today = new Date();
    const isSameDay =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    return isSameDay
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }, [poll.createdAt]);

  return (
    <article
      className={`p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#08080a] border transition-colors ${
        isActivePin
          ? "border-rose-500/60 dark:border-rose-500/50"
          : "border-neutral-200 dark:border-neutral-800"
      }`}
    >
      {/* Header Meta */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {isClosed ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-neutral-100 dark:bg-[#16181d] text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
              <Lock className="w-3 h-3" />
              {poll.stoppedAt
                ? `Closed · ${poll.stoppedBy?.name || poll.createdBy.name}`
                : "Closed"}
            </span>
          ) : isActivePin ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/70">
              <Pin className="w-3 h-3" />
              <span>Urgent</span>
              {countdown && (
                <>
                  <span>·</span>
                  <span className="tabular-nums">{countdown}</span>
                </>
              )}
            </span>
          ) : countdown ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 tabular-nums">
              <Clock className="w-3 h-3" />
              Closes in {countdown}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
              Open Poll
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
            {createdTimeLabel}
          </span>
          {poll.canDelete && onDelete && !confirmingDelete && (
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setConfirmingDelete(true);
                setConfirmingStop(false);
              }}
              aria-label="Delete poll"
              className="p-1 rounded-lg text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-neutral-100 dark:hover:bg-[#181a20] transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Inline Delete Confirmation */}
      {confirmingDelete && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-rose-700 dark:text-rose-300">
            Delete this poll?
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-slate-50 font-semibold cursor-pointer disabled:opacity-50"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#141519] border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Question */}
      <h3 className="text-sm sm:text-[15px] font-bold text-neutral-900 dark:text-slate-100 leading-snug whitespace-pre-wrap break-words">
        {poll.question}
      </h3>

      {/* Mode Indicator */}
      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
        {resultsHidden && !isClosed ? (
          <EyeOff className="w-3.5 h-3.5 shrink-0" />
        ) : null}
        <span>{modeMeta}</span>
      </div>

      {/* Style A: Stream Bars Options */}
      <div className="mt-4 space-y-3">
        {poll.options.map((opt) => {
          const isSelected = poll.myOptionIds.includes(opt.id);
          const count = opt.voteCount ?? 0;
          const pct = opt.percentage ?? 0;
          const barWidth =
            maxVotes > 0 && count > 0
              ? Math.max(4, Math.round((count / maxVotes) * 100))
              : 0;
          const isWinner = isClosed && !resultsHidden && maxVotes > 0 && count === maxVotes;

          return (
            <button
              key={opt.id}
              type="button"
              disabled={votingDisabled}
              onClick={() => handleOptionPress(opt.id)}
              className={`w-full text-left space-y-1.5 transition-opacity ${
                votingDisabled
                  ? "cursor-default"
                  : "cursor-pointer active:scale-[0.995]"
              }`}
            >
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Radio or Checkbox Indicator */}
                  {isMultiple ? (
                    <span
                      className={`w-5 h-5 rounded-md inline-flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-emerald-600 text-slate-50"
                          : isClosed
                            ? "border-2 border-neutral-300 dark:border-neutral-700 opacity-50"
                            : "border-2 border-neutral-400 dark:border-neutral-500"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </span>
                  ) : (
                    <span
                      className={`w-5 h-5 rounded-full inline-flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-emerald-600 text-slate-50"
                          : isClosed
                            ? "border-2 border-neutral-300 dark:border-neutral-700 opacity-50"
                            : "border-2 border-neutral-400 dark:border-neutral-500"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </span>
                  )}

                  <span
                    className={`text-sm leading-snug break-words ${
                      isWinner || isSelected
                        ? "font-bold text-neutral-900 dark:text-slate-100"
                        : "font-medium text-neutral-800 dark:text-slate-200"
                    }`}
                  >
                    {opt.label}
                  </span>

                  {isWinner && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-600 text-slate-50 text-[10px] font-mono font-bold uppercase shrink-0">
                      <Trophy className="w-2.5 h-2.5" />
                      Top
                    </span>
                  )}
                </div>

                {/* Right-side Voter Avatars + Count */}
                {!resultsHidden && (
                  <div className="flex items-center gap-2 shrink-0">
                    {opt.previewVoters && opt.previewVoters.length > 0 && (
                      <div className="inline-flex items-center -space-x-1.5">
                        {opt.previewVoters.slice(0, 3).map((v) =>
                          v.avatarUrl ? (
                            <img
                              key={v.id}
                              src={v.avatarUrl}
                              alt={v.name}
                              className="w-5 h-5 rounded-full object-cover ring-2 ring-white dark:ring-[#08080a]"
                            />
                          ) : (
                            <span
                              key={v.id}
                              className={`w-5 h-5 rounded-full text-[9px] font-bold text-slate-50 inline-flex items-center justify-center ring-2 ring-white dark:ring-[#08080a] ${getAvatarColor(v.id)}`}
                            >
                              {getInitials(v.name)}
                            </span>
                          )
                        )}
                      </div>
                    )}
                    <span className="text-xs font-mono font-bold tabular-nums text-neutral-900 dark:text-slate-100 min-w-[1.6rem] text-right">
                      {count}
                    </span>
                  </div>
                )}
              </div>

              {/* Stream Progress Bar */}
              {!resultsHidden && (
                <div className="pl-7 flex items-center gap-2.5">
                  <div className="flex-1 h-2 rounded-full bg-neutral-200/80 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ease-out ${
                        isWinner || isSelected
                          ? "bg-emerald-500"
                          : isClosed
                            ? "bg-neutral-400/70 dark:bg-neutral-600"
                            : "bg-neutral-500 dark:bg-neutral-400"
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono tabular-nums text-neutral-500 dark:text-neutral-400 w-9 text-right shrink-0">
                    {pct}%
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Closed Winner Summary */}
      {isClosed && winners.length > 0 && (
        <div className="mt-3.5 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-neutral-800 dark:text-slate-200 truncate">
            Result:{" "}
            <strong className="text-emerald-700 dark:text-emerald-400">
              {winners.map((w) => w.label).join(" / ")}
            </strong>
          </span>
          <span className="font-mono font-bold tabular-nums text-emerald-700 dark:text-emerald-400 shrink-0">
            {winners[0].percentage ?? 0}%
          </span>
        </div>
      )}

      {/* Footer: Author, Turnout, Stop Poll & View Votes */}
      <div className="mt-4 pt-3 border-t border-neutral-200/80 dark:border-neutral-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-500 dark:text-neutral-400 min-w-0">
            <span className="inline-flex items-center gap-1 truncate">
              <User className="w-3 h-3 shrink-0" />
              <strong className="text-neutral-800 dark:text-slate-200 font-semibold truncate">
                {poll.createdBy.name}
              </strong>
            </span>
            <span>·</span>
            <span className="tabular-nums shrink-0">
              {poll.uniqueVotersCount}
              {poll.totalMembers > 0 ? ` of ${poll.totalMembers}` : ""} voted
            </span>
          </div>

          {poll.canStop && !isClosed && (
            <div className="flex items-center gap-1.5 shrink-0">
              {confirmingStop ? (
                <>
                  <button
                    type="button"
                    disabled={isStopping}
                    onClick={handleConfirmStop}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-slate-50 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isStopping ? "Stopping..." : "Confirm Stop"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingStop(false)}
                    className="px-2 py-1 rounded-lg bg-neutral-100 dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold cursor-pointer"
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
                    setConfirmingDelete(false);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-300 dark:border-rose-700/80 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Square className="w-2.5 h-2.5 fill-current" />
                  Stop poll
                </button>
              )}
            </div>
          )}
        </div>

        {/* View Votes Action */}
        <button
          type="button"
          disabled={resultsHidden && !isClosed}
          onClick={() => {
            hapticLight();
            onViewVotes(poll);
          }}
          className={`w-full py-2 px-3 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
            resultsHidden && !isClosed
              ? "bg-neutral-50 dark:bg-[#121318] border-neutral-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed"
              : "bg-neutral-50 dark:bg-[#121318] hover:bg-neutral-100 dark:hover:bg-[#191b22] border-neutral-200 dark:border-neutral-800 text-emerald-700 dark:text-emerald-400 cursor-pointer"
          }`}
        >
          <span>
            {resultsHidden && !isClosed
              ? "Results reveal when closed"
              : isClosed
                ? "View final results & votes"
                : "View votes"}
          </span>
          {!(resultsHidden && !isClosed) && <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>
    </article>
  );
};
