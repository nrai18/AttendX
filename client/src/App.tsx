import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useSilentRefresh } from "./hooks/useSilentRefresh";
import { useAuthStore } from "./stores/authStore";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./pages/auth/LoginPage";
import { SignupPage } from "./pages/auth/SignupPage";
import { SubjectsPage } from "./pages/subjects/SubjectsPage";
import { SubjectsOverviewPage } from "./pages/subjects/SubjectsOverviewPage";
import { TimetablePage } from "./pages/timetable/TimetablePage";
import { TodayPage } from "./pages/attendance/TodayPage";
import { ClassroomsPage } from "./pages/social/ClassroomsPage";
import { ClassroomFeedPage } from "./pages/social/ClassroomFeedPage";
import { Loader2 } from "lucide-react";

// Protected Route Guard Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const CalendarPlaceholder = () => (
  <div className="p-4 rounded-2xl bg-[#0c0d12] border border-white/10">
    <h2 className="text-lg font-bold text-white mb-1">Dot-Matrix Calendar</h2>
    <p className="text-sm text-muted-foreground">Monthly view with default weekend off marking</p>
  </div>
);

const SettingsPlaceholder = () => (
  <div className="p-4 rounded-2xl bg-[#0c0d12] border border-white/10">
    <h2 className="text-lg font-bold text-white mb-1">Settings & Preferences</h2>
    <p className="text-sm text-muted-foreground">Set 75% criteria, theme, backup, and notification preferences</p>
  </div>
);

export function App() {
  useSilentRefresh();

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* Protected App Routes */}
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/today" element={<TodayPage />} />
          <Route path="/timetable" element={<TimetablePage />} />
          <Route path="/calendar" element={<CalendarPlaceholder />} />
          <Route path="/subjects" element={<SubjectsOverviewPage />} />
          <Route path="/subjects/manage" element={<SubjectsPage />} />
          <Route path="/classrooms" element={<ClassroomsPage />} />
          <Route path="/classrooms/:id" element={<ClassroomFeedPage />} />
          <Route path="/settings" element={<SettingsPlaceholder />} />
        </Route>

        {/* Default Redirect */}
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
