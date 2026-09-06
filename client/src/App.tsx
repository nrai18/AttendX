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
  const { isAuthenticated, isLoading, _hasHydrated } = useAuthStore();

  if (isLoading || !_hasHydrated) {
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


// ... [Keep existing placeholders] ...

import { WebSplashScreen } from "./components/common/WebSplashScreen";
import { SettingsPage } from "./pages/settings/SettingsPage";
import { AssignmentsPage } from "./pages/assignments/AssignmentsPage";
import { ReportView } from "./pages/reports/ReportView";
import { PredictiveAttendancePage } from "./pages/attendance/PredictiveAttendancePage";
import { Toaster } from "sonner";
import { useState } from "react";

import { LandingPage } from "./pages/marketing/LandingPage";
import { PrivacyPage } from "./pages/marketing/PrivacyPage";
import { TermsPage } from "./pages/marketing/TermsPage";

const RootRoute: React.FC = () => {
  const { isAuthenticated, isLoading, _hasHydrated } = useAuthStore();
  if (!Capacitor.isNativePlatform() && !_hasHydrated) return null; // Wait for zustand to read Capacitor Preferences
  // If native platform, we can wait too to avoid Lottie crash in LandingPage while resolving auth
  if (!_hasHydrated || isLoading) return null;
  return isAuthenticated ? <Navigate to="/today" replace /> : <LandingPage />;
};

import { App as CapacitorApp } from "@capacitor/app";
import { NotificationService } from "./services/NotificationService";
import { OTAUpdateModal } from "./components/common/OTAUpdateModal";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";

import { NotFoundPage } from "./pages/NotFoundPage";

import { HardwareBackButtonHandler } from "./components/common/HardwareBackButtonHandler";

import { api } from "./lib/api";

const useSessionPoller = () => {
  const { isAuthenticated } = useAuthStore();
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      // Pinging a lightweight route; if 401, axios interceptor auto-logs out
      api.get("/users/sessions").catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);
};

export function App() {
  useSilentRefresh();
  
  useTheme();
  const theme = useThemeStore((state) => state.theme);
  // We want the Lottie splash screen to play on mobile devices (web and native)
  // Only show it once per day
  const [splashFinished, setSplashFinished] = useState(() => {
    const lastSplashDate = localStorage.getItem("last_splash_date");
    const today = new Date().toDateString();
    return lastSplashDate === today;
  });

  const handleSplashComplete = () => {
    localStorage.setItem("last_splash_date", new Date().toDateString());
    setSplashFinished(true);
  };

  useEffect(() => {
    const initServices = async () => {
      try {
        
        if (Capacitor.isNativePlatform()) {
          await CapacitorUpdater.notifyAppReady();
          try {
            const info = await CapacitorApp.getInfo();
            const nativeVersion = info.version;
            const localVer = localStorage.getItem("app_version") || "0.0.0";
            
            const p1 = nativeVersion.split('.').map(Number);
            const p2 = localVer.split('.').map(Number);
            let isNativeNewer = false;
            for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
              const num1 = p1[i] || 0;
              const num2 = p2[i] || 0;
              if (num1 > num2) { isNativeNewer = true; break; }
              if (num1 < num2) { break; }
            }
            
            if (isNativeNewer) {
              localStorage.setItem("app_version", nativeVersion);
              window.location.reload();
              return;
            }
          } catch(e) {}
        }

        await NotificationService.init();
        await NotificationService.autoScheduleFromTimetable();
        // Silent ping to ML server to wake it up on boot (Render Free Tier)
        const mlUrl = import.meta.env.VITE_ML_API_URL;
        if (mlUrl) {
          fetch(`${mlUrl}/health`).catch(() => {
            // We expect this to fail or timeout if it's asleep, 
            // but the HTTP request alone is enough to wake the Render instance!
          });
          // Also ping the base url just in case /health doesn't exist
          fetch(`${mlUrl}/`).catch(() => {});
        }
      } catch (e) {
        console.error("Failed to init NotificationService", e);
      }
    };
    initServices();
  }, []);

  return (
    <ErrorBoundary>
      {!splashFinished && (
        <WebSplashScreen onComplete={handleSplashComplete} />
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
      {Capacitor.isNativePlatform() && (
        <OTAUpdateModal
          localVersion={localStorage.getItem("app_version") || "2.6.2"}
        />
      )}
      {splashFinished && (
        <BrowserRouter>
          <HardwareBackButtonHandler />
          <Routes>
            {/* Public Landing Page */}
            <Route path="/" element={<RootRoute />} />

            {/* Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />

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
            <Route path="/assignments" element={<AssignmentsPage />} />
              <Route path="/report" element={<ReportView />} />
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



