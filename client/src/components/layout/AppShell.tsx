import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { AttendanceAnimationPopup } from "../common/AttendanceAnimationPopup";
import { FloatingChatbot } from "../common/FloatingChatbot";

interface AppShellProps {
  title?: string;
  onAddClick?: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({ title, onAddClick }) => {
  const { fetchStats } = useAttendanceStore();

  useEffect(() => {
    fetchStats();
    const handleUpdate = () => {
      fetchStats();
    };
    window.addEventListener("attendance-updated", handleUpdate);
    return () => window.removeEventListener("attendance-updated", handleUpdate);
  }, [fetchStats]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row antialiased selection:bg-primary selection:text-white transition-colors duration-200">
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

      {/* 2-Second Popup Animation Overlay */}
      <AttendanceAnimationPopup />

      {/* Floating AI Ordinance & Policy Chatbot */}
      <FloatingChatbot />
    </div>
  );
};
