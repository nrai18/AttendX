import React from "react";

interface Props {
  type?: "today" | "list" | "calendar" | "grid";
}

export const PageSkeleton: React.FC<Props> = ({ type = "today" }) => {
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto w-full pb-24 md:pb-8 animate-pulse">
      
      {/* Top Banner Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <div className="h-20 bg-muted/60 rounded-2xl border border-border/40"></div>
        <div className="h-20 bg-muted/60 rounded-2xl border border-border/40 hidden md:block"></div>
      </div>

      {/* Header Skeleton */}
      <div className="flex items-center justify-between mb-4">
        <div className="h-8 bg-muted/60 rounded-lg w-48"></div>
        <div className="h-8 bg-muted/60 rounded-lg w-24"></div>
      </div>

      {/* Cards Skeleton */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-muted/40 rounded-2xl border border-border/30"></div>
        ))}
      </div>
    </div>
  );
};

