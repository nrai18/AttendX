import React from "react";
import { useLocation } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import { Plus, LogOut, Sun, Moon, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { useThemeStore } from "../../stores/themeStore";

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
  const location = useLocation();
  const isReports = location.pathname.startsWith("/report");
  
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await api.post("/auth/logout");
    } catch (e) {}
    logout();
  };
  
  const { overallPercentage, hasActiveSemester } = useAttendanceStore();
  const targetPercentage = user?.targetAttendance ?? 75;
  const { theme, toggleTheme } = useThemeStore();

  // Route-specific styling
  const headerBg = isReports ? "bg-[#FDF8F5]/80 dark:bg-[#1A090C]/80 border-[#EED3CF]/30 dark:border-[#74313A]/30" : "bg-background/80 border-border";
  const textColor = isReports ? "text-[#111827] dark:text-[#FDF8F5]" : "text-foreground";
  const mutedTextColor = isReports ? "text-[#74313A]/60 dark:text-[#EED3CF]/60" : "text-muted-foreground";
  const hoverBg = isReports ? "hover:bg-[#74313A]/5 dark:hover:bg-[#EED3CF]/5" : "hover:bg-muted/80";
  const hoverText = isReports ? "hover:text-[#74313A] dark:hover:text-[#EED3CF]" : "hover:text-foreground";

  // Badge styling
  const badgeBg = isReports 
    ? "bg-[#74313A]/5 dark:bg-[#EED3CF]/5 border-[#74313A]/10 dark:border-[#EED3CF]/10" 
    : "bg-muted/60 border-border";
  
  const badgeGoodText = isReports 
    ? "text-[#74313A] dark:text-[#EED3CF]" 
    : "text-emerald-500 dark:text-emerald-400";
    
  const badgeBadText = isReports
    ? "text-rose-600 dark:text-rose-400"
    : "text-rose-500 dark:text-rose-400";

  return (
    <header className={`sticky top-0 z-40 backdrop-blur-md border-b px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] transition-colors ${headerBg}`}>
      <div className="flex items-center justify-between max-w-5xl mx-auto">
        {/* Title / User Greeting */}
        <div>
          <h1 className={`text-xl font-bold tracking-tight ${textColor}`}>
            {title || user?.name || "AttendX"}
          </h1>
        </div>

        {/* Right Side Controls */}
        <div className="flex items-center gap-2">
          {/* Attendance Percentage Badge */}
          {hasActiveSemester && (
            <div className={`flex items-center gap-1.5 border rounded-xl px-3 py-1.5 text-xs font-mono font-semibold ${badgeBg}`}>
              <span className={`font-bold ${overallPercentage >= targetPercentage ? badgeGoodText : badgeBadText}`}>
                {(overallPercentage ?? 0).toFixed(2)}%
              </span>
              <span className={isReports ? "text-[#74313A]/20 dark:text-[#EED3CF]/20" : "text-muted-foreground/40"}>|</span>
              <span className={isReports ? "text-[#74313A]/50 dark:text-[#EED3CF]/50" : "text-muted-foreground"}>{targetPercentage}%</span>
            </div>
          )}

          {/* Theme Toggle Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className={`w-9 h-9 rounded-xl ${mutedTextColor} ${hoverText} ${hoverBg} cursor-pointer transition-colors active:scale-95`}
            title={`Current: ${theme} theme. Click to toggle.`}
          >
            {theme === "light" ? (
              <Sun className={isReports ? "w-4 h-4" : "w-4 h-4 text-amber-500"} />
            ) : (
              <Moon className={isReports ? "w-4 h-4" : "w-4 h-4 text-indigo-400"} />
            )}
          </Button>

          {/* Quick Action Button */}
          {onAddClick && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onAddClick}
              className={`w-9 h-9 rounded-xl ${mutedTextColor} ${hoverText} ${hoverBg} cursor-pointer`}
            >
              <Plus className="w-5 h-5" />
            </Button>
          )}

          {/* Logout Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className={`w-9 h-9 rounded-xl ${mutedTextColor} hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer active:scale-90 transition-transform disabled:opacity-50`}
            title="Log Out"
          >
            {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
};
