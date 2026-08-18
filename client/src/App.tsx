import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useSilentRefresh } from "./hooks/useSilentRefresh";
import { useTheme } from "./hooks/useTheme";
import { useAuthStore } from "./stores/authStore";
import { useThemeStore } from "./stores/themeStore";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./pages/auth/LoginPage";
import { SignupPage } from "./pages/auth/SignupPage";
import { SemesterHubPage } from "./pages/semester/SemesterHubPage";
import { SubjectsPage } from "./pages/subjects/SubjectsPage";
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
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
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



import { SettingsPage } from "./pages/settings/SettingsPage";
import { PredictiveAttendancePage } from "./pages/attendance/PredictiveAttendancePage";
import { Toaster } from "sonner";

const RootRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return null;
  return isAuthenticated ? <Navigate to="/today" replace /> : <LandingPage />;
};

export function App() {
  useSilentRefresh();
  useTheme();
  const theme = useThemeStore(state => state.theme);

  return (
    <>
      <Toaster position="bottom-center" theme={theme as any} toastOptions={{ className: 'rounded-xl border border-border shadow-lg' }} />
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
            <Route path="/predictive" element={<PredictiveAttendancePage />} />
            <Route path="/timetable" element={<TimetablePage />} />
            <Route path="/semester" element={<SemesterHubPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/subjects" element={<SubjectsPage />} />
            <Route path="/subjects/manage" element={<SubjectsPage />} />
            <Route path="/subjects/:id" element={<SubjectDetailPage />} />
            <Route path="/classrooms" element={<ClassroomsPage />} />
            <Route path="/classrooms/:id" element={<ClassroomFeedPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* Default Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
