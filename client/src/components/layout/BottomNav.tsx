import React from "react";
import { NavLink } from "react-router-dom";
import { CalendarDays, Table, Calendar, BookOpen, Settings } from "lucide-react";
import { cn } from "../../lib/utils";

const navItems = [
  { label: "Today", path: "/today", icon: CalendarDays },
  { label: "Timetable", path: "/timetable", icon: Table },
  { label: "Calendar", path: "/calendar", icon: Calendar },
  { label: "Subjects", path: "/subjects", icon: BookOpen },
  { label: "Settings", path: "/settings", icon: Settings },
];

export const BottomNav: React.FC = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0c0d12]/90 backdrop-blur-lg border-t border-white/10 pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex items-center justify-around h-16 px-2 max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={cn(
                      "p-1.5 rounded-full transition-all duration-200",
                      isActive && "bg-primary/15 scale-110"
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
