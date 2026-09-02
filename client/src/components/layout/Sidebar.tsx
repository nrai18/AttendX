import React from "react";
import { NavLink } from "react-router-dom";
import {
  CalendarDays,
  Table,
  Calendar,
  BookOpen,
  Settings,
  LogOut,
  GraduationCap,
  LayoutDashboard,
  Sparkles,
} from "lucide-react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import { cn } from "../../lib/utils";

const navItems = [
  { label: "Today", path: "/today", icon: CalendarDays },
  { label: "Forecast", path: "/predictive", icon: Sparkles },
  { label: "Timetable", path: "/timetable", icon: Table },
  { label: "Calendar", path: "/calendar", icon: Calendar },
  { label: "Subjects", path: "/subjects", icon: BookOpen },
  { label: "Semester Overview", path: "/semester", icon: LayoutDashboard },
  { label: "Settings", path: "/settings", icon: Settings },
];

export const Sidebar: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  
  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (e) {}
    logout();
  };

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen bg-card border-r border-border p-4 sticky top-0 transition-colors">
      {/* Brand Logo */}
      <div className="flex items-center gap-3 px-4 py-5 mb-2">
        <div className="bg-white rounded overflow-hidden shadow-sm flex items-center justify-center">
          <img src="/attendx_logo_lockup.png" alt="AttendX Logo" className="h-9 w-auto object-contain" />
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-bold tracking-tight text-foreground leading-tight">AttendX</span>
          <p className="text-[11px] text-muted-foreground font-medium whitespace-nowrap leading-tight">IIIT Una Academic</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )
              }
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User Profile Card Footer */}
      <div className="pt-4 border-t border-border">
        <div className="flex items-center justify-between p-2 rounded-xl bg-muted/40 border border-border group">
          <NavLink 
            to="/settings?action=edit-profile" 
            className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                user?.name?.[0] || "U"
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">{user?.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
            </div>
          </NavLink>
          <button
            onClick={handleLogout}
            className="p-1.5 text-muted-foreground hover:text-rose-500 transition-colors cursor-pointer shrink-0 ml-1"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
