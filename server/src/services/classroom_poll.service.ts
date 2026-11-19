import { PollMode } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { PushNotificationService } from "./push_notification.service";

export interface FormattedPollVoterPreview {
  id: string;
  name: string;
  avatarUrl: string | null;
  rollNumber: string | null;
}

export interface FormattedPollOption {
  id: string;
  label: string;
  sortOrder: number;
  voteCount: number | null;
  percentage: number | null;
  isSelected: boolean;
  isWinner: boolean;
  previewVoters: FormattedPollVoterPreview[];
}

export interface FormattedClassroomPoll {
  id: string;
  classroomId: string;
  question: string;
  mode: "yes_no" | "single" | "multiple";
  isPinned: boolean;
  isActivePin: boolean;
  closesAt: string | null;
  stoppedAt: string | null;
  isClosed: boolean;
  closeReason: "stopped" | "expired" | null;
  hideResultsUntilClosed: boolean;
  resultsHidden: boolean;
  allowVoteChange: boolean;
  createdAt: string;
  createdById: string;
  createdBy: {
    id: string;
    name: string;
    avatarUrl: string | null;
    rollNumber: string | null;
  };
  stoppedBy: {
    id: string;
    name: string;
  } | null;
  canStop: boolean;
  canDelete: boolean;
  totalMembers: number;
  uniqueVotersCount: number;
  totalVotesCount: number;
  myOptionIds: string[];
  hasVoted: boolean;
  options: FormattedPollOption[];
}

const POLL_INCLUDE = {
  createdBy: {
    select: { id: true, name: true, avatarUrl: true, rollNumber: true },
  },
  stoppedBy: {
    select: { id: true, name: true },
  },
  options: {
    orderBy: { sortOrder: "asc" as const },
  },
  votes: {
    orderBy: { votedAt: "desc" as const },
    select: {
      optionId: true,
      userId: true,
      votedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          rollNumber: true,
        },
      },
    },
  },
};

export class ClassroomPollService {
  private static async getMembershipContext(userId: string, classroomId: string) {
    const member = await prisma.classroomMember.findUnique({
      where: {
        classroomId_userId: { classroomId, userId },
      },
      include: {
        classroom: {
          select: {
            id: true,
            name: true,
            section: true,
            deletedAt: true,
            createdById: true,
            broadcastPermission: true,
            allowedPosterIds: true,
            deniedPosterIds: true,
          },
        },
      },
    });

    if (!member) {
      const err = new Error("Access denied: Not a member of this classroom");
      (err as any).status = 403;
      throw err;
    }

    const isCrOrAdmin =
      member.role === "admin" || member.classroom.createdById === userId;
    const perm = member.classroom.broadcastPermission || "admins";
    const allowedList = member.classroom.allowedPosterIds || [];
    const deniedList = member.classroom.deniedPosterIds || [];

    let canPost = false;
    if (isCrOrAdmin) {
      canPost = true;
    } else if (perm === "everyone") {
      canPost = true;
    } else if (perm === "only_selected") {
      canPost = allowedList.includes(userId);
    } else if (perm === "everyone_except") {
      canPost = !deniedList.includes(userId);
    }

    return { member, classroom: member.classroom, isCrOrAdmin, canPost };
  }

  static formatPoll(
    poll: any,
    userId: string,
    isCrOrAdmin: boolean,
    totalMembers: number
  ): FormattedClassroomPoll {
    const nowMs = Date.now();
    const closesAtMs = poll.closesAt ? new Date(poll.closesAt).getTime() : null;
    const isStopped = Boolean(poll.stoppedAt);
    const isExpired = !isStopped && closesAtMs !== null && closesAtMs <= nowMs;
    const isClosed = isStopped || isExpired;
    const closeReason: "stopped" | "expired" | null = isStopped
      ? "stopped"
      : isExpired
        ? "expired"
        : null;
    const isActivePin = Boolean(poll.isPinned && !isClosed);
    const resultsHidden = Boolean(poll.hideResultsUntilClosed && !isClosed);

    const votesByOption = new Map<string, any[]>();
    const uniqueVoters = new Set<string>();
    const myOptionIds: string[] = [];

    for (const v of poll.votes || []) {
      uniqueVoters.add(v.userId);
      if (v.userId === userId) {
        myOptionIds.push(v.optionId);
      }
      const list = votesByOption.get(v.optionId) || [];
      list.push(v);
      votesByOption.set(v.optionId, list);
    }

    const rawCounts = (poll.options || []).map(
      (opt: any) => (votesByOption.get(opt.id) || []).length
    );
    const totalVotesCount = rawCounts.reduce((a: number, b: number) => a + b, 0);
    const maxVotes = rawCounts.length > 0 ? Math.max(...rawCounts) : 0;

    const options: FormattedPollOption[] = (poll.options || []).map(
      (opt: any, idx: number) => {
        const optVotes = votesByOption.get(opt.id) || [];
        const count = rawCounts[idx];
        const percentage =
          totalVotesCount > 0 ? Math.round((count / totalVotesCount) * 100) : 0;
        const isSelected = myOptionIds.includes(opt.id);
        const isWinner = isClosed && maxVotes > 0 && count === maxVotes;

        let previewVoters: FormattedPollVoterPreview[] = [];
        if (!resultsHidden) {
          // Prioritize current user first in the avatar stack if they voted for this option
          const ordered = [...optVotes].sort((a, b) => {
            if (a.userId === userId && b.userId !== userId) return -1;
            if (b.userId === userId && a.userId !== userId) return 1;
            return 0;
          });
          previewVoters = ordered.slice(0, 3).map((v) => ({
            id: v.user.id,
            name: v.user.name,
            avatarUrl: v.user.avatarUrl || null,
            rollNumber: v.user.rollNumber || null,
          }));
        }

        return {
          id: opt.id,
          label: opt.label,
          sortOrder: opt.sortOrder,
          voteCount: resultsHidden ? null : count,
          percentage: resultsHidden ? null : percentage,
          isSelected,
          isWinner,
          previewVoters,
        };
      }
    );

    const canManage = poll.createdById === userId || isCrOrAdmin;

    return {
      id: poll.id,
      classroomId: poll.classroomId,
      question: poll.question,
      mode: poll.mode,
      isPinned: Boolean(poll.isPinned),
      isActivePin,
      closesAt: poll.closesAt ? new Date(poll.closesAt).toISOString() : null,
      stoppedAt: poll.stoppedAt ? new Date(poll.stoppedAt).toISOString() : null,
      isClosed,
      closeReason,
      hideResultsUntilClosed: Boolean(poll.hideResultsUntilClosed),
      resultsHidden,
      allowVoteChange: poll.allowVoteChange !== false,
      createdAt: new Date(poll.createdAt).toISOString(),
      createdById: poll.createdById,
      createdBy: {
        id: poll.createdBy?.id || poll.createdById,
        name: poll.createdBy?.name || "Member",
        avatarUrl: poll.createdBy?.avatarUrl || null,
        rollNumber: poll.createdBy?.rollNumber || null,
      },
      stoppedBy: poll.stoppedBy
        ? { id: poll.stoppedBy.id, name: poll.stoppedBy.name }
        : null,
      canStop: !isClosed && canManage,
      canDelete: canManage,
      totalMembers,
      uniqueVotersCount: uniqueVoters.size,
      totalVotesCount: resultsHidden ? uniqueVoters.size : totalVotesCount,
      myOptionIds,
      hasVoted: myOptionIds.length > 0,
      options,
    };
  }

  static async listPollsForClassroom(
    userId: string,
    classroomId: string,
    isCrOrAdmin: boolean,
    totalMembers: number
  ): Promise<FormattedClassroomPoll[]> {
    const rawPolls = await prisma.classroomPoll.findMany({
      where: { classroomId },
      include: POLL_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 40,
    });

    return rawPolls
      .map((p) => this.formatPoll(p, userId, isCrOrAdmin, totalMembers))
      .sort((a, b) => {
        if (a.isActivePin !== b.isActivePin) return a.isActivePin ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }

  static async createPoll(
    userId: string,
    classroomId: string,
    data: {
      question: string;
      mode?: "yes_no" | "single" | "multiple";
      options?: string[];
      closesAt?: string | null;
      durationMinutes?: number | null;
      isPinned?: boolean;
      hideResultsUntilClosed?: boolean;
      allowVoteChange?: boolean;
    }
  ): Promise<FormattedClassroomPoll> {
    const { classroom, isCrOrAdmin, canPost } = await this.getMembershipContext(
      userId,
      classroomId
    );

    if (classroom.deletedAt) {
      const err = new Error("This classroom has been disbanded");
      (err as any).status = 400;
      throw err;
    }

    if (!canPost) {
      const err = new Error(
        "Posting is restricted to classroom admins and approved members"
      );
      (err as any).status = 403;
      throw err;
    }

    const question = String(data.question || "").trim();
    if (!question) {
      const err = new Error("Poll question is required");
      (err as any).status = 400;
      throw err;
    }
    if (question.length > 500) {
      const err = new Error("Poll question must be 500 characters or fewer");
      (err as any).status = 400;
      throw err;
    }

    const validModes: PollMode[] = ["yes_no", "single", "multiple"];
    const mode: PollMode = validModes.includes(data.mode as PollMode)
      ? (data.mode as PollMode)
      : "single";

    let rawOptions = Array.isArray(data.options)
      ? data.options
          .map((o) => String(o || "").trim())
          .filter(Boolean)
          .slice(0, 8)
      : [];

    if (mode === "yes_no") {
      if (rawOptions.length < 2) {
        rawOptions = ["Yes", "No"];
      } else {
        rawOptions = rawOptions.slice(0, 2);
      }
    }

    if (rawOptions.length < 2) {
      const err = new Error("At least 2 options are required");
      (err as any).status = 400;
      throw err;
    }

    for (const label of rawOptions) {
      if (label.length > 120) {
        const err = new Error("Each option must be 120 characters or fewer");
        (err as any).status = 400;
        throw err;
      }
    }

    let closesAt: Date | null = null;
    if (data.closesAt) {
      const parsed = new Date(data.closesAt);
      if (isNaN(parsed.getTime())) {
        const err = new Error("Invalid poll deadline");
        (err as any).status = 400;
        throw err;
      }
      if (parsed.getTime() <= Date.now() + 30_000) {
        const err = new Error("Poll deadline must be in the future");
        (err as any).status = 400;
        throw err;
      }
      closesAt = parsed;
    } else if (
      typeof data.durationMinutes === "number" &&
      Number.isFinite(data.durationMinutes) &&
      data.durationMinutes > 0
    ) {
      const clampedMins = Math.min(Math.max(Math.round(data.durationMinutes), 1), 60 * 24 * 30);
      closesAt = new Date(Date.now() + clampedMins * 60 * 1000);
    }

    const [created, totalMembers] = await Promise.all([
      prisma.classroomPoll.create({
        data: {
          classroomId,
          createdById: userId,
          question,
          mode,
          isPinned: Boolean(data.isPinned),
          closesAt,
          hideResultsUntilClosed: Boolean(data.hideResultsUntilClosed),
          allowVoteChange: data.allowVoteChange !== false,
          options: {
            create: rawOptions.map((label, idx) => ({
              label,
              sortOrder: idx,
            })),
          },
        },
        include: POLL_INCLUDE,
      }),
      prisma.classroomMember.count({ where: { classroomId } }),
    ]);

    const className = classroom.section
      ? `${classroom.name} (Sec ${classroom.section})`
      : classroom.name;
    const prefix = created.isPinned ? "[URGENT POLL] " : "New Poll: ";
    const notifTitle = `📊 ${prefix}${className}`;
    const notifBody =
      question.length > 140 ? `${question.slice(0, 137)}...` : question;

    PushNotificationService.sendToClassroomMembers(
      classroomId,
      userId,
      notifTitle,
      notifBody,
      {
        type: "classroom_poll_created",
        classroomId,
        pollId: created.id,
        isPinned: String(created.isPinned),
        url: `/classrooms/${classroomId}`,
        route: `/classrooms/${classroomId}`,
      }
    ).catch((err) =>
      console.error("[ClassroomPollService] Failed to send poll creation push:", err)
    );

    return this.formatPoll(created, userId, isCrOrAdmin, totalMembers);
  }

  static async castVote(
    userId: string,
    classroomId: string,
    pollId: string,
    rawOptionIds: string[]
  ): Promise<FormattedClassroomPoll> {
    const { classroom, isCrOrAdmin } = await this.getMembershipContext(
      userId,
      classroomId
    );

    if (classroom.deletedAt) {
      const err = new Error("This classroom has been disbanded");
      (err as any).status = 400;
      throw err;
    }

    const poll = await prisma.classroomPoll.findFirst({
      where: { id: pollId, classroomId },
      include: {
        options: { select: { id: true } },
      },
    });

    if (!poll) {
      const err = new Error("Poll not found");
      (err as any).status = 404;
      throw err;
    }

    const isClosed =
      Boolean(poll.stoppedAt) ||
      (poll.closesAt !== null && poll.closesAt.getTime() <= Date.now());
    if (isClosed) {
      const err = new Error("Poll is closed — no further votes accepted");
      (err as any).status = 409;
      throw err;
    }

    const validOptionSet = new Set(poll.options.map((o) => o.id));
    const uniqueSelected = Array.from(
      new Set(
        (Array.isArray(rawOptionIds) ? rawOptionIds : []).filter(
          (id): id is string => typeof id === "string" && validOptionSet.has(id)
        )
      )
    );

    if (poll.mode !== "multiple" && uniqueSelected.length > 1) {
      const err = new Error("Only one option can be selected for this poll");
      (err as any).status = 400;
      throw err;
    }

    if (!poll.allowVoteChange) {
      const existingCount = await prisma.classroomPollVote.count({
        where: { pollId: poll.id, userId },
      });
      if (existingCount > 0) {
        const err = new Error("Your vote is locked for this poll");
        (err as any).status = 403;
        throw err;
      }
      if (uniqueSelected.length === 0) {
        const err = new Error("Select at least one option");
        (err as any).status = 400;
        throw err;
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.classroomPollVote.deleteMany({
        where: { pollId: poll.id, userId },
      });
      if (uniqueSelected.length > 0) {
        await tx.classroomPollVote.createMany({
          data: uniqueSelected.map((optionId) => ({
            pollId: poll.id,
            optionId,
            userId,
          })),
        });
      }
    });

    const [freshPoll, totalMembers] = await Promise.all([
      prisma.classroomPoll.findUnique({
        where: { id: poll.id },
        include: POLL_INCLUDE,
      }),
      prisma.classroomMember.count({ where: { classroomId } }),
    ]);

    return this.formatPoll(freshPoll, userId, isCrOrAdmin, totalMembers);
  }

  static async stopPoll(
    userId: string,
    classroomId: string,
    pollId: string
  ): Promise<FormattedClassroomPoll> {
    const { classroom, isCrOrAdmin } = await this.getMembershipContext(
      userId,
      classroomId
    );

    const poll = await prisma.classroomPoll.findFirst({
      where: { id: pollId, classroomId },
      include: POLL_INCLUDE,
    });

    if (!poll) {
      const err = new Error("Poll not found");
      (err as any).status = 404;
      throw err;
    }

    if (poll.createdById !== userId && !isCrOrAdmin) {
      const err = new Error(
        "Only the poll author or classroom admin can stop this poll"
      );
      (err as any).status = 403;
      throw err;
    }

    const totalMembers = await prisma.classroomMember.count({
      where: { classroomId },
    });

    const alreadyClosed =
      Boolean(poll.stoppedAt) ||
      (poll.closesAt !== null && poll.closesAt.getTime() <= Date.now());

    if (alreadyClosed) {
      return this.formatPoll(poll, userId, isCrOrAdmin, totalMembers);
    }

    const updated = await prisma.classroomPoll.update({
      where: { id: poll.id },
      data: {
        stoppedAt: new Date(),
        stoppedById: userId,
        isPinned: false,
      },
      include: POLL_INCLUDE,
    });

    const formatted = this.formatPoll(updated, userId, isCrOrAdmin, totalMembers);
    const winners = formatted.options.filter((o) => o.isWinner);
    const winnerSummary =
      winners.length > 0
        ? `Top result: ${winners.map((w) => w.label).join(" / ")} (${winners[0].percentage ?? 0}%)`
        : "Final results are now available.";

    const className = classroom.section
      ? `${classroom.name} (Sec ${classroom.section})`
      : classroom.name;

    PushNotificationService.sendToClassroomMembers(
      classroomId,
      userId,
      `📊 Poll Closed: ${className}`,
      `${winnerSummary} — ${formatted.question.slice(0, 90)}`,
      {
        type: "classroom_poll_closed",
        classroomId,
        pollId: updated.id,
        url: `/classrooms/${classroomId}`,
        route: `/classrooms/${classroomId}`,
      }
    ).catch((err) =>
      console.error("[ClassroomPollService] Failed to send poll close push:", err)
    );

    return formatted;
  }

  static async getPollVotes(
    userId: string,
    classroomId: string,
    pollId: string
  ) {
    const { isCrOrAdmin } = await this.getMembershipContext(userId, classroomId);

    const [poll, totalMembers] = await Promise.all([
      prisma.classroomPoll.findFirst({
        where: { id: pollId, classroomId },
        include: {
          createdBy: {
            select: { id: true, name: true, avatarUrl: true, rollNumber: true },
          },
          stoppedBy: {
            select: { id: true, name: true },
          },
          options: {
            orderBy: { sortOrder: "asc" },
          },
          votes: {
            orderBy: { votedAt: "desc" },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                  rollNumber: true,
                  department: true,
                  batch: true,
                },
              },
            },
          },
        },
      }),
      prisma.classroomMember.count({ where: { classroomId } }),
    ]);

    if (!poll) {
      const err = new Error("Poll not found");
      (err as any).status = 404;
      throw err;
    }

    const formatted = this.formatPoll(poll, userId, isCrOrAdmin, totalMembers);
    const votesByOption = new Map<string, any[]>();
    for (const v of poll.votes) {
      const list = votesByOption.get(v.optionId) || [];
      list.push(v);
      votesByOption.set(v.optionId, list);
    }

    const turnoutPct =
      totalMembers > 0
        ? Math.min(100, Math.round((formatted.uniqueVotersCount / totalMembers) * 100))
        : 0;

    return {
      poll: formatted,
      turnoutPct,
      options: formatted.options.map((opt) => {
        if (formatted.resultsHidden) {
          return {
            id: opt.id,
            label: opt.label,
            voteCount: null,
            percentage: null,
            isWinner: false,
            voters: [],
          };
        }
        const rawVoters = votesByOption.get(opt.id) || [];
        const sortedVoters = [...rawVoters].sort((a, b) => {
          if (a.userId === userId && b.userId !== userId) return -1;
          if (b.userId === userId && a.userId !== userId) return 1;
          return new Date(b.votedAt).getTime() - new Date(a.votedAt).getTime();
        });
        return {
          id: opt.id,
          label: opt.label,
          voteCount: opt.voteCount,
          percentage: opt.percentage,
          isWinner: opt.isWinner,
          voters: sortedVoters.map((v) => ({
            id: v.user.id,
            name: v.user.name,
            avatarUrl: v.user.avatarUrl || null,
            rollNumber: v.user.rollNumber || null,
            department: v.user.department || null,
            batch: v.user.batch || null,
            votedAt: new Date(v.votedAt).toISOString(),
            isCurrentUser: v.userId === userId,
          })),
        };
      }),
    };
  }

  static async deletePoll(userId: string, classroomId: string, pollId: string) {
    const { isCrOrAdmin } = await this.getMembershipContext(userId, classroomId);
    const poll = await prisma.classroomPoll.findFirst({
      where: { id: pollId, classroomId },
      select: { id: true, createdById: true },
    });
    if (!poll) {
      const err = new Error("Poll not found");
      (err as any).status = 404;
      throw err;
    }
    if (poll.createdById !== userId && !isCrOrAdmin) {
      const err = new Error("Only the poll author or classroom admin can delete this poll");
      (err as any).status = 403;
      throw err;
    }
    await prisma.classroomPoll.delete({ where: { id: poll.id } });
    return { success: true, pollId: poll.id };
  }
}
