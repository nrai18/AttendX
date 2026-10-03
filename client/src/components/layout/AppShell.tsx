import React, { useEffect, useLayoutEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { AttendanceAnimationPopup } from "../common/AttendanceAnimationPopup";
import { FloatingChatbot } from "../common/FloatingChatbot";
import { NotificationService } from "../../services/NotificationService";

interface AppShellProps {
  title?: string;
  onAddClick?: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({ title, onAddClick }) => {
  const { fetchStats } = useAttendanceStore();
  const location = useLocation();

  useEffect(() => {
    // Force the correct favicon on route change
    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    link.href = '/attendx_app_icon.png';
  }, [location.pathname]);

  useEffect(() => {
    fetchStats();
    const handleUpdate = () => {
      fetchStats();
      NotificationService.autoScheduleFromTimetable();
    };
    window.addEventListener("attendance-updated", handleUpdate);
    return () => window.removeEventListener("attendance-updated", handleUpdate);
  }, [fetchStats]);

  const isReports = location.pathname.startsWith("/report");
  const isSubjects = location.pathname === "/subjects" || location.pathname.startsWith("/subjects/");
  const isSettings = location.pathname.startsWith("/settings");
  const isSemester = location.pathname.startsWith("/semester");
  const isToday = location.pathname.startsWith("/today");
  const isTimetable = location.pathname.startsWith("/timetable");
  const isPredictive = location.pathname.startsWith("/predictive");
  const isCalendar = location.pathname.startsWith("/calendar");

  useLayoutEffect(() => {
    // Reset all dynamically applied page themes
    document.body.classList.remove("theme-nova-green", "theme-terrascape", "theme-aether", "theme-frovia", "theme-orbital");

    if (isSettings) {
      document.body.classList.add("theme-nova-green");
    } else if (isToday) {
      document.body.classList.add("theme-terrascape");
    } else if (isTimetable) {
      document.body.classList.add("theme-aether");
    } else if (isPredictive) {
      document.body.classList.add("theme-frovia");
    } else if (isCalendar) {
      document.body.classList.add("theme-orbital");
    }

    return () => {
      document.body.classList.remove("theme-nova-green", "theme-terrascape", "theme-aether", "theme-frovia", "theme-orbital");
    };
  }, [location.pathname, isSettings, isToday, isTimetable, isPredictive, isCalendar]);

  return (
    <div className={`min-h-screen ${isSemester ? "theme-peakpath bg-transparent" : isSettings ? "bg-transparent" : isReports ? "bg-[#FDF8F5] dark:bg-[#1A090C]" : "bg-transparent"} text-foreground flex flex-col md:flex-row antialiased ${isSettings || isSemester ? "selection:bg-primary text-primary-foreground" : "selection:bg-[#74313A] selection:text-white"} transition-colors duration-200 `}>
      {/* Sidebar for Desktop */}
      <Sidebar />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6 ${isSubjects ? "bg-subjects-gradient" : ""}`}>
        {/* Top Header */}
        <TopBar title={title} onAddClick={onAddClick} />

        {/* Page Content */}
        <main className="flex-1 w-full overflow-x-hidden max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
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
