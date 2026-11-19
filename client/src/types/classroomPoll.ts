export type PollMode = "yes_no" | "single" | "multiple";

export interface PollVoterPreview {
  id: string;
  name: string;
  avatarUrl: string | null;
  rollNumber: string | null;
}

export interface ClassroomPollOption {
  id: string;
  label: string;
  sortOrder: number;
  voteCount: number | null;
  percentage: number | null;
  isSelected: boolean;
  isWinner: boolean;
  previewVoters: PollVoterPreview[];
}

export interface ClassroomPoll {
  id: string;
  classroomId: string;
  question: string;
  mode: PollMode;
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
  options: ClassroomPollOption[];
}

export interface PollVoterDetail {
  id: string;
  name: string;
  avatarUrl: string | null;
  rollNumber: string | null;
  department: string | null;
  batch: string | null;
  votedAt: string;
  isCurrentUser: boolean;
}

export interface PollVotesDetailResponse {
  poll: ClassroomPoll;
  turnoutPct: number;
  options: Array<{
    id: string;
    label: string;
    voteCount: number | null;
    percentage: number | null;
    isWinner: boolean;
    voters: PollVoterDetail[];
  }>;
}
