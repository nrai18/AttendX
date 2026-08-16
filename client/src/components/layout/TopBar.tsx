import React from "react";
import { useAuthStore } from "../../stores/authStore";
import { Plus, SlidersHorizontal, LogOut, Sun, Moon } from "lucide-react";
import { Button } from "../ui/button";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { useThemeStore } from "../../stores/themeStore";
import { NotificationCenter } from "./NotificationCenter";

interface TopBarProps {
  title?: string;
  onAddClick?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  onAddClick,
}) => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { overallPercentage } = useAttendanceStore();
  const targetPercentage = user?.targetAttendance ?? 75;
  const { theme, toggleTheme } = useThemeStore();

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] transition-colors">
      <div className="flex items-center justify-between max-w-5xl mx-auto">
        {/* Title / User Greeting */}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {title || user?.name || "AttendX"}
          </h1>
        </div>

        {/* Right Side Controls */}
        <div className="flex items-center gap-2">
          {/* In-App Notification Center */}
          <NotificationCenter />
          {/* Attendance Percentage Badge (e.g. 87.10 | 75) */}
          <div className="flex items-center gap-1.5 bg-muted/60 border border-border rounded-xl px-3 py-1.5 text-xs font-mono font-semibold">
            <span
              className={
                overallPercentage >= targetPercentage
                  ? "text-emerald-500 dark:text-emerald-400 font-bold"
                  : "text-rose-500 dark:text-rose-400 font-bold"
              }
            >
              {(overallPercentage ?? 0).toFixed(2)}%
            </span>
            <span className="text-muted-foreground/40">|</span>
            <span className="text-muted-foreground">{targetPercentage}%</span>
          </div>

          {/* Theme Toggle Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer transition-transform active:scale-95"
            title={`Current: ${theme} theme. Click to toggle.`}
          >
            {theme === "light" ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-400" />
            )}
          </Button>

          {/* Quick Action Button */}
          {onAddClick && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onAddClick}
              className="w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer"
            >
              <Plus className="w-5 h-5" />
            </Button>
          )}

          {/* Logout Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="w-9 h-9 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};

