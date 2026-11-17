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
      className="relative group flex items-center gap-2 px-3 py-1 rounded-full bg-card/90 dark:bg-black/90 text-foreground dark:text-white border border-emerald-500/40 font-mono text-[11px] font-bold shadow-xs hover:border-emerald-500 transition-all active:scale-95 cursor-pointer shrink-0"
      title="System update available. Tap to inspect release notes."
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span className="tracking-wide">Build {tag}</span>
    </button>
  );
};
