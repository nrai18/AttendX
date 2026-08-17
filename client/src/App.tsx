import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useTheme } from "./hooks/useTheme";
import { useThemeStore } from "./stores/themeStore";
import { AppShell } from "./components/layout/AppShell";
import { NeonAuthPage } from "./pages/auth/NeonAuthPage";
import { SemesterHubPage } from "./pages/semester/SemesterHubPage";
import { SubjectsPage } from "./pages/subjects/SubjectsPage";
import { SubjectDetailPage } from "./pages/subjects/SubjectDetailPage";
import { TimetablePage } from "./pages/timetable/TimetablePage";
import { TodayPage } from "./pages/attendance/TodayPage";
import { CalendarPage } from "./pages/attendance/CalendarPage";
import { ClassroomsPage } from "./pages/social/ClassroomsPage";
import { ClassroomFeedPage } from "./pages/social/ClassroomFeedPage";
import { LandingPage } from "./pages/marketing/LandingPage";
import { SettingsPage } from "./pages/settings/SettingsPage";
import { PredictiveAttendancePage } from "./pages/attendance/PredictiveAttendancePage";
import { Toaster } from "sonner";
import { LoginPage } from "./pages/auth/LoginPage";
import { SignupPage } from "./pages/auth/SignupPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { PrivacyPage } from "./pages/marketing/PrivacyPage";
import { TermsPage } from "./pages/marketing/TermsPage";
import { SignedIn, SignedOut } from '@neondatabase/neon-js/auth/react/ui';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut><Navigate to="/login" replace /></SignedOut>
    </>
  );
};

const RootRoute: React.FC = () => {
  return (
    <>
      <SignedIn><Navigate to="/today" replace /></SignedIn>
      <SignedOut><LandingPage /></SignedOut>
    </>
  );
};

import { useEffect } from "react";
import { neon } from "./lib/neon";
import { api } from "./lib/api";
import { useAuthStore } from "./stores/authStore";

export function App() {
  useTheme();
  const theme = useThemeStore(state => state.theme);
  const { setUser } = useAuthStore();
  const { data: session, isPending } = neon.auth.useSession();

  useEffect(() => {
    if (session?.user) {
      api.get("/users/me").then(res => {
        setUser({
          ...res.data,
          name: session.user.name || res.data.name,
          email: session.user.email || res.data.email,
          avatarUrl: session.user.image,
        });
      }).catch(err => console.error("Failed to fetch custom user record", err));
    } else if (!isPending) {
      setUser(null);
    }
  }, [session, isPending, setUser]);

  return (
    <>
      <Toaster position="bottom-center" theme={theme as any} toastOptions={{ className: 'rounded-xl border border-border shadow-lg' }} />
      <Routes>
        {/* Public Landing Page */}
        <Route path="/" element={<RootRoute />} />
        
        {/* Legal Pages */}
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />

        {/* Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

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
    </>
  );
}

export default App;
