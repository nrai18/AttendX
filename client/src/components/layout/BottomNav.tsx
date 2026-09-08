import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { CalendarDays, Table, BookOpen, Settings, BarChart3, Calendar } from "lucide-react";
import { cn } from "../../lib/utils";

const navItems = [
  { label: "Today", path: "/today", icon: CalendarDays },
  { label: "Timetable", path: "/timetable", icon: Table },
  { label: "Calendar", path: "/calendar", icon: Calendar },
  { label: "Subjects", path: "/subjects", icon: BookOpen },
  { label: "Settings", path: "/settings", icon: Settings },
];

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const isReports = location.pathname.startsWith("/report");

  const navBg = isReports ? "bg-[#FDF8F5]/90 dark:bg-[#1A090C]/90 border-[#EED3CF]/30 dark:border-[#74313A]/30" : "bg-card/90 border-border";

  return (
    <nav className={`fixed bottom-0 left-0 right-0 z-50 ${navBg} backdrop-blur-lg border-t pb-[env(safe-area-inset-bottom)] md:hidden transition-colors`}>
      <div className="flex items-center justify-around h-16 px-2 max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => {
                if (isActive && isReports) {
                  return "flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors text-[#74313A] dark:text-[#EED3CF]";
                }
                return cn(
                  "flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : isReports
                      ? "text-[#74313A]/50 dark:text-[#EED3CF]/50 hover:text-[#74313A] dark:hover:text-[#EED3CF]"
                      : "text-muted-foreground hover:text-foreground"
                );
              }}
            >
              {({ isActive }) => (
                <>
                  <div
                    className={cn(
                      "p-1.5 rounded-full transition-all duration-200",
                      isActive && isReports ? "bg-[#74313A]/15 dark:bg-[#EED3CF]/15 scale-110" : isActive ? "bg-primary/15 scale-110" : ""
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="mt-0.5">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
