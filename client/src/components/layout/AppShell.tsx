import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useAttendanceStore } from "../../stores/attendanceStore";

interface AppShellProps {
  title?: string;
  onAddClick?: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({ title, onAddClick }) => {
  const fetchStats = useAttendanceStore((state) => state.fetchStats);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="min-h-screen bg-[#050508] text-foreground flex flex-col md:flex-row antialiased selection:bg-primary selection:text-white">
      {/* Sidebar for Desktop */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-6">
        {/* Top Header */}
        <TopBar title={title} onAddClick={onAddClick} />

        {/* Page Content */}
        <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
          <Outlet />
        </main>
      </div>

      {/* Bottom Navigation for Mobile */}
      <BottomNav />
    </div>
  );
};
