import React from "react";
import { NavLink, useLocation } from "react-router-dom";
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
  Loader2,
  BarChart3,
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

  const sidebarBg = isReports ? "bg-[#FDF8F5]/80 dark:bg-[#1A090C]/80 border-[#EED3CF]/30 dark:border-[#74313A]/30" : "bg-card border-border";
  const textColor = isReports ? "text-[#111827] dark:text-[#FDF8F5]" : "text-foreground";
  const mutedTextColor = isReports ? "text-[#74313A]/60 dark:text-[#EED3CF]/60" : "text-muted-foreground";

  return (
    <aside className={`hidden md:flex flex-col w-64 h-screen ${sidebarBg} border-r p-4 sticky top-0 transition-colors`}>
      {/* Brand Logo */}
      <div className="flex items-center gap-3 px-4 py-5 mb-2">
        <div className="bg-white rounded overflow-hidden shadow-sm flex items-center justify-center">
          <img src="/attendx_logo_lockup.png" alt="AttendX Logo" className="h-9 w-auto object-contain" />
        </div>
        <div className="flex flex-col">
          <span className={`text-xl font-bold tracking-tight leading-tight ${textColor}`}>AttendX</span>
          <p className={`text-[11px] font-medium whitespace-nowrap leading-tight ${mutedTextColor}`}>IIIT Una Academic</p>
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
              className={({ isActive }) => {
                if (isActive && isReports) {
                  return "flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 bg-[#74313A] text-[#FDF8F5] shadow-md shadow-[#74313A]/20";
                }
                
                return cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20"
                    : isReports
                      ? "text-[#74313A]/60 dark:text-[#EED3CF]/60 hover:text-[#74313A] dark:hover:text-[#EED3CF] hover:bg-[#74313A]/10 dark:hover:bg-[#EED3CF]/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                );
              }}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User Profile Card Footer */}
      <div className={`pt-4 border-t ${isReports ? "border-[#EED3CF]/30 dark:border-[#74313A]/30" : "border-border"}`}>
        <div className={`flex items-center justify-between p-2 rounded-xl border group ${isReports ? "bg-[#74313A]/5 dark:bg-[#EED3CF]/5 border-[#EED3CF]/30 dark:border-[#74313A]/30" : "bg-muted/40 border-border"}`}>
          <NavLink 
            to="/settings?action=edit-profile" 
            className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <div className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs shrink-0 ${isReports ? "bg-[#74313A]/20 text-[#74313A] dark:bg-[#EED3CF]/20 dark:text-[#EED3CF]" : "bg-primary/20 text-primary"}`}>
              {user?.avatarUrl && user?.avatarUrl !== "null" ? (<img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.src = "https://api.dicebear.com/7.x/notionists/svg?seed=" + encodeURIComponent(user?.name || "U"); }} />) : (user?.name?.[0] || "U")}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-xs font-medium truncate transition-colors ${textColor} ${isReports ? "group-hover:text-[#74313A] dark:group-hover:text-[#EED3CF]" : "group-hover:text-primary"}`}>{user?.name}</p>
              <p className={`text-[10px] truncate ${mutedTextColor}`}>{user?.email}</p>
            </div>
          </NavLink>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className={`p-1.5 transition-colors cursor-pointer shrink-0 ml-1 disabled:opacity-50 active:scale-90 ${isReports ? "text-[#74313A]/60 dark:text-[#EED3CF]/60 hover:text-rose-600 dark:hover:text-rose-400" : "text-muted-foreground hover:text-rose-500"}`}
            title="Log Out"
          >
            {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
};
