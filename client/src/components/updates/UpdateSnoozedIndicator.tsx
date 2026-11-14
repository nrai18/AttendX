import React from "react";

interface Props {
  tag?: string;
  onClick: () => void;
}

export const UpdateSnoozedIndicator: React.FC<Props> = ({ tag, onClick }) => {
  if (!tag) return null;

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 font-mono text-[11px] font-bold hover:bg-blue-500/25 transition-all cursor-pointer shadow-sm shadow-blue-500/20"
      title="System update pending. Tap to view notes."
    >
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
      <span>Build {tag}</span>
    </button>
  );
};
