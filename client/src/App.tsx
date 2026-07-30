import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useSilentRefresh } from "./hooks/useSilentRefresh";
import { useAuthStore } from "./stores/authStore";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./pages/auth/LoginPage";
import { SignupPage } from "./pages/auth/SignupPage";
import { SemesterHubPage } from "./pages/semester/SemesterHubPage";
import { SubjectsPage } from "./pages/subjects/SubjectsPage";
import { SubjectsOverviewPage } from "./pages/subjects/SubjectsOverviewPage";
import { SubjectDetailPage } from "./pages/subjects/SubjectDetailPage";
import { TimetablePage } from "./pages/timetable/TimetablePage";
import { TodayPage } from "./pages/attendance/TodayPage";
import { CalendarPage } from "./pages/attendance/CalendarPage";
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

import { LandingPage } from "./pages/marketing/LandingPage";

// ... [Keep existing placeholders] ...



const SettingsPlaceholder = () => (
  <div className="p-4 rounded-2xl bg-[#0c0d12] border border-white/10">
    <h2 className="text-lg font-bold text-white mb-1">Settings & Preferences</h2>
    <p className="text-sm text-muted-foreground">Set 75% criteria, theme, backup, and notification preferences</p>
  </div>
);

const RootRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return null;
  return isAuthenticated ? <Navigate to="/today" replace /> : <LandingPage />;
};

export function App() {
  useSilentRefresh();

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Landing Page */}
        <Route path="/" element={<RootRoute />} />

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
          <Route path="/semester" element={<SemesterHubPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/subjects" element={<SubjectsOverviewPage />} />
          <Route path="/subjects/manage" element={<SubjectsPage />} />
          <Route path="/subjects/:id" element={<SubjectDetailPage />} />
          <Route path="/classrooms" element={<ClassroomsPage />} />
          <Route path="/classrooms/:id" element={<ClassroomFeedPage />} />
          <Route path="/settings" element={<SettingsPlaceholder />} />
        </Route>

        {/* Default Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
