import React from "react";
import { useAuthStore } from "../../stores/authStore";
import { Plus, SlidersHorizontal, LogOut } from "lucide-react";
import { Button } from "../ui/button";

interface TopBarProps {
  title?: string;
  overallPercentage?: number;
  targetPercentage?: number;
  onAddClick?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  overallPercentage = 87.1,
  targetPercentage = 75,
  onAddClick,
}) => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <header className="sticky top-0 z-40 bg-[#050508]/80 backdrop-blur-md border-b border-white/5 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
      <div className="flex items-center justify-between max-w-5xl mx-auto">
        {/* Title / User Greeting */}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            {title || user?.name || "AttendX"}
          </h1>
        </div>

        {/* Right Side Controls */}
        <div className="flex items-center gap-2">
          {/* Attendance Percentage Badge (e.g. 87.10 | 75) */}
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono font-semibold">
            <span
              className={
                overallPercentage >= targetPercentage
                  ? "text-emerald-400"
                  : "text-rose-400"
              }
            >
              {overallPercentage.toFixed(2)}
            </span>
            <span className="text-white/30">|</span>
            <span className="text-white/70">{targetPercentage}</span>
          </div>

          {/* Quick Action Button */}
          {onAddClick && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onAddClick}
              className="w-9 h-9 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
            >
              <Plus className="w-5 h-5" />
            </Button>
          )}

          {/* Logout Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="w-9 h-9 rounded-xl text-white/40 hover:text-rose-400 hover:bg-rose-500/10"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};
