import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useSilentRefresh } from "./hooks/useSilentRefresh";
import { useTheme } from "./hooks/useTheme";
import { useAuthStore } from "./stores/authStore";
import { useThemeStore } from "./stores/themeStore";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./pages/auth/LoginPage";
import { SignupPage } from "./pages/auth/SignupPage";
import { SubjectsPage } from "./pages/subjects/SubjectsPage";
import { SubjectDetailPage } from "./pages/subjects/SubjectDetailPage";
import { TimetablePage } from "./pages/timetable/TimetablePage";
import { TodayPage } from "./pages/attendance/TodayPage";
import { CalendarPage } from "./pages/attendance/CalendarPage";
import { SemesterHubPage } from "./pages/semester/SemesterHubPage";
import { ClassroomsPage } from "./pages/social/ClassroomsPage";
import { ClassroomFeedPage } from "./pages/social/ClassroomFeedPage";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "./components/common/ErrorBoundary";

// Protected Route Guard Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
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

import { WebSplashScreen } from "./components/common/WebSplashScreen";
import { SettingsPage } from "./pages/settings/SettingsPage";
import { PredictiveAttendancePage } from "./pages/attendance/PredictiveAttendancePage";
import { Toaster } from "sonner";
import { useState } from "react";

const RootRoute: React.FC = () => {
  const { isAuthenticated, isLoading, _hasHydrated } = useAuthStore();
  if (!Capacitor.isNativePlatform() && !_hasHydrated) return null; // Wait for zustand to read Capacitor Preferences
  // If native platform, we can wait too to avoid Lottie crash in LandingPage while resolving auth
  if (!_hasHydrated || isLoading) return null;
  return isAuthenticated ? <Navigate to="/today" replace /> : <LandingPage />;
};

import { NotificationService } from "./services/NotificationService";
import { OTAUpdateModal } from "./components/common/OTAUpdateModal";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";

import { NotFoundPage } from "./pages/NotFoundPage";

import { HardwareBackButtonHandler } from "./components/common/HardwareBackButtonHandler";

export function App() {
  useSilentRefresh();
  useTheme();
  const theme = useThemeStore((state) => state.theme);
  // Skip WebSplashScreen on native platforms to avoid Lottie issues and use native splash instead
  const [splashFinished, setSplashFinished] = useState(Capacitor.isNativePlatform());

  useEffect(() => {
    const initServices = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          await CapacitorUpdater.notifyAppReady();
        }
        await NotificationService.init();
        await NotificationService.autoScheduleFromTimetable();
      } catch (e) {
        console.error("Failed to init NotificationService", e);
      }
    };
    initServices();
  }, []);

  return (
    <ErrorBoundary>
      {!splashFinished && (
        <WebSplashScreen onComplete={() => setSplashFinished(true)} />
      )}
      <Toaster
        position="top-center"
        theme={theme as any}
        duration={2500}
        visibleToasts={2}
        toastOptions={{
          className: "rounded-xl border border-border shadow-lg mt-4 md:mt-0",
        }}
      />
      <OTAUpdateModal
        localVersion={localStorage.getItem("app_version") || "1.0.0"}
      />
      {splashFinished && (
        <BrowserRouter>
          <HardwareBackButtonHandler />
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
              <Route
                path="/predictive"
                element={<PredictiveAttendancePage />}
              />
              <Route path="/timetable" element={<TimetablePage />} />
              <Route path="/semester" element={<SemesterHubPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/subjects" element={<SubjectsPage />} />
              <Route path="/subjects/manage" element={<SubjectsPage />} />
              <Route path="/subjects/:id" element={<SubjectDetailPage />} />
              <Route path="/classrooms" element={<ClassroomsPage />} />
              <Route path="/classrooms/:id" element={<ClassroomFeedPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            {/* Default Redirect / 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      )}
    </ErrorBoundary>
  );
}

export default App;
