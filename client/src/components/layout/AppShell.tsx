import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useAttendanceStore } from "../../stores/attendanceStore";
import { AttendanceAnimationPopup } from "../common/AttendanceAnimationPopup";
import { CreateSemesterModal } from "../semester/CreateSemesterModal";
import { Plus } from "lucide-react";

interface AppShellProps {
  title?: string;
  onAddClick?: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({ title, onAddClick }) => {
  const [isCreateSemesterOpen, setIsCreateSemesterOpen] = React.useState(false);
  const { fetchStats, hasActiveSemester, isLoading } = useAttendanceStore();

  useEffect(() => {
    fetchStats();
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
          {!isLoading && hasActiveSemester === false && (
            <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white">No Active Semester</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Create an active semester to enable attendance percentage calculations and safe buffer metrics.
                </p>
              </div>
              <button
                onClick={() => setIsCreateSemesterOpen(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Semester</span>
              </button>
            </div>
          )}

          <Outlet />
        </main>
      </div>

      {/* Bottom Navigation for Mobile */}
      <BottomNav />

      {/* 2-Second Popup Animation Overlay */}
      <AttendanceAnimationPopup />

      <CreateSemesterModal 
        isOpen={isCreateSemesterOpen} 
        onClose={() => setIsCreateSemesterOpen(false)} 
        onSuccess={() => fetchStats()} 
      />
    </div>
  );
};
