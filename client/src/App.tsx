import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useSilentRefresh } from "./hooks/useSilentRefresh";
import { useBackgroundSync } from "./hooks/useBackgroundSync";
import { useTheme } from "./hooks/useTheme";
import { useAuthStore } from "./stores/authStore";
import { useThemeStore } from "./stores/themeStore";
import { useCacheStore } from "./stores/cacheStore";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./pages/auth/LoginPage";
import { SignupPage } from "./pages/auth/SignupPage";
import { NotificationService } from "./services/NotificationService";
import { NativeVoiceService } from "./services/NativeVoiceService";
import { SubjectsPage } from "./pages/subjects/SubjectsPage";
import { SubjectDetailPage } from "./pages/subjects/SubjectDetailPage";
import { TimetablePage } from "./pages/timetable/TimetablePage";
import { TodayPage } from "./pages/attendance/TodayPage";
import { CalendarPage } from "./pages/attendance/CalendarPage";
import { SemesterHubPage } from "./pages/semester/SemesterHubPage";
import { ClassroomsPage } from "./pages/social/ClassroomsPage";
import { ClassroomFeedPage } from "./pages/social/ClassroomFeedPage";
import { FaqPage } from "./pages/settings/FaqPage";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { DynamicIslandHUD } from "./components/ui/dynamic-island-hud";
import { ShockwaveCelebrationOverlay } from "./components/ui/shockwave-celebration";

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
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

import { WebSplashScreen } from "./components/common/WebSplashScreen";
import { SettingsPage } from "./pages/settings/SettingsPage";
import { AssignmentsPage } from "./pages/assignments/AssignmentsPage";
import { ReportView } from "./pages/reports/ReportView";
import { PredictiveAttendancePage } from "./pages/attendance/PredictiveAttendancePage";
import { Toaster } from "sonner";
import { useState, useEffect } from "react";

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

const DEFAULT_APK_DOWNLOAD_URL = "https://github.com/nrai18/AttendX/releases/latest/download/AttendX.apk";

const getApkDownloadUrl = () =>
  useConfigStore.getState().appDownloadLink ||
  import.meta.env.VITE_APP_DOWNLOAD_LINK ||
  DEFAULT_APK_DOWNLOAD_URL;

const DownloadRedirect: React.FC = () => {
  const downloadUrl = useConfigStore((state) => state.appDownloadLink) || import.meta.env.VITE_APP_DOWNLOAD_LINK || DEFAULT_APK_DOWNLOAD_URL;
  useEffect(() => {
    document.title = "Download AttendX Android App | IIIT Una Attendance Companion";
    window.location.replace(downloadUrl);
  }, [downloadUrl]);
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-3 p-6 text-center">
      <Loader2 className="w-7 h-7 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Starting your AttendX APK download...</p>
      <a
        href={downloadUrl}
        className="text-xs font-semibold text-primary underline underline-offset-4"
      >
        Click here if the download does not start automatically
      </a>
    </div>
  );
};

const DeepLinkHandler: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const routeIncomingUrl = (rawUrl?: string | null) => {
      if (!rawUrl) return;
      try {
        const parsed = new URL(rawUrl);
        const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
        if (pathname === "/download") {
          window.open(getApkDownloadUrl(), "_system");
          return;
        }
        if (pathname !== "/") {
          navigate(`${pathname}${parsed.search}${parsed.hash}`, { replace: true });
        }
      } catch (e) {
        console.error("Failed to parse deep link URL:", rawUrl, e);
      }
    };

    CapacitorApp.getLaunchUrl()
      .then((launchUrl) => {
        if (launchUrl?.url) {
          routeIncomingUrl(launchUrl.url);
        }
      })
      .catch(() => {});

    const listenerPromise = CapacitorApp.addListener("appUrlOpen", (event) => {
      routeIncomingUrl(event.url);
    });

    return () => {
      listenerPromise.then((handle) => handle.remove()).catch(() => {});
    };
  }, [navigate]);

  return null;
};

import { App as CapacitorApp } from "@capacitor/app";
import { OTAUpdateModal } from "./components/common/OTAUpdateModal";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { Capacitor } from "@capacitor/core";

import { NotFoundPage } from "./pages/NotFoundPage";
import { HardwareBackButtonHandler } from "./components/common/HardwareBackButtonHandler";
import { api } from "./lib/api";
import { useConfigStore } from "./stores/configStore";

export function App() {
  useSilentRefresh();
  useBackgroundSync();
  useTheme();
  const theme = useThemeStore((state) => state.theme);
  // We want the Lottie splash screen to play on mobile devices (web and native)
  // Only show it once per day, and bypass it for direct public deep-links (/privacy, /terms, /download)
  const [splashFinished, setSplashFinished] = useState(() => {
    const path = window.location.pathname.replace(/\/+$/, "");
    if (path === "/privacy" || path === "/terms" || path === "/download" || path === "/forgot-password" || path === "/reset-password") {
      return true;
    }
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
      try { await useConfigStore.getState().fetchConfig(); } catch (e) {}
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
              try {
                await CapacitorUpdater.reset();
              } catch (e) {
                console.error("CapacitorUpdater reset failed:", e);
                window.location.reload();
              }
              return;
            }
          } catch(e) {}
        }

        try {
          await NotificationService.init();
        } catch (e) {
          console.error("Failed to init NotificationService", e);
        }

        try {
          await NativeVoiceService.requestPermissions();
        } catch (e) {
          console.error("Failed to request voice permissions on launch", e);
        }

        try {
          await NotificationService.autoScheduleFromTimetable();
        } catch (e) {
          console.error("Failed to auto-schedule timetable notifications", e);
        }

        try {
          await NotificationService.scheduleAssignmentReminders();
        } catch (e) {
          console.error("Failed to schedule assignment reminders", e);
        }

        try {
          const reminderFreq = useCacheStore.getState().reminderFrequency || { type: 'Daily' };
          NotificationService.scheduleAcademicUpdates(reminderFreq).catch(console.error);
        } catch (e) {
          console.error("Failed to schedule academic updates", e);
        }

        // Instant Copilot Warmup ping to ensure 0-latency chat on start (silent)
        api.post("/ai/chat", { text: "ping", warmup: true }, { silent: true, skipToast: true }).catch(() => {
          // Silent catch if offline or server waking up
        });

        // Silent ping to ML server to wake it up on boot (Render Free Tier)
        const mlUrl = useConfigStore.getState().mlApiUrl || import.meta.env.VITE_ML_API_URL || 'https://attendx-ml-server.onrender.com';
        if (mlUrl) {
          fetch(`${mlUrl}/health`).catch(() => {
            // We expect this to fail or timeout if it's asleep, 
            // but the HTTP request alone is enough to wake the Render instance!
          });
          // Also ping the base url just in case /health doesn't exist
          fetch(`${mlUrl}/`).catch(() => {});
        }
      } catch (e) {
        console.error("Unexpected error in initServices", e);
      }
    };
    initServices();
  }, []);

  const { isAuthenticated, _hasHydrated: hydrated } = useAuthStore();
  useEffect(() => {
    if (isAuthenticated && hydrated) {
      NotificationService.syncFcmToken();
      NotificationService.autoScheduleFromTimetable().catch(console.error);
      NotificationService.scheduleAssignmentReminders().catch(console.error);
      const reminderFreq = useCacheStore.getState().reminderFrequency || { type: 'Daily' };
      NotificationService.scheduleAcademicUpdates(reminderFreq).catch(console.error);
    }
  }, [isAuthenticated, hydrated]);

  return (
    <ErrorBoundary>
      <DynamicIslandHUD />
      <ShockwaveCelebrationOverlay />
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
          localVersion={localStorage.getItem("app_version") || "4.3.0"}
        />
      )}
      {splashFinished && (
        <BrowserRouter>
          <DeepLinkHandler />
          <HardwareBackButtonHandler />
          <Routes>
            {/* Public Landing Page */}
            <Route path="/" element={<RootRoute />} />
            <Route path="/download" element={<DownloadRedirect />} />

            {/* Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<LoginPage initialForgotPassword={true} />} />
            <Route path="/reset-password" element={<LoginPage initialForgotPassword={true} />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/404" element={<NotFoundPage />} />

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
              <Route path="/semester/:tab" element={<SemesterHubPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/subjects" element={<SubjectsPage />} />
              <Route path="/subjects/manage" element={<SubjectsPage />} />
              <Route path="/subjects/:id" element={<SubjectDetailPage />} />
              <Route path="/classrooms" element={<ClassroomsPage />} />
              <Route path="/classrooms/:id" element={<ClassroomFeedPage />} />
              <Route path="/settings/faq" element={<FaqPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/:section" element={<SettingsPage />} />
              <Route path="/assignments" element={<AssignmentsPage />} />
              <Route path="/report" element={<ReportView />} />
              <Route path="/reports" element={<ReportView />} />
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





