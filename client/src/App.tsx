import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useSilentRefresh } from "./hooks/useSilentRefresh";
import { useBackgroundSync } from "./hooks/useBackgroundSync";
import { useTheme } from "./hooks/useTheme";
import { useAuthStore, isUserAuthenticated } from "./stores/authStore";
import { useThemeStore } from "./stores/themeStore";
import { useCacheStore } from "./stores/cacheStore";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./pages/auth/LoginPage";
import { SignupPage } from "./pages/auth/SignupPage";
import { NotificationService } from "./services/NotificationService";
import { NativeVoiceService } from "./services/NativeVoiceService";
import { WidgetBridgeService } from "./services/WidgetBridgeService";
import { useAttendanceStore } from "./stores/attendanceStore";
import { useOfflineStore } from "./stores/offlineStore";
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
import { NativeUpdateSheet } from "./components/updates/NativeUpdateSheet";
import { useNativeUpdates } from "./hooks/useNativeUpdates";
import { isVersionNewer } from "./services/updater/githubUpdater";
import { nativeUpdater } from "./services/updater/nativeUpdater";
import { OfflineLabPage } from "./pages/dev/OfflineLabPage";
import { useAppLockStore } from "./stores/appLockStore";
import { PasscodeLockOverlay } from "./components/security/PasscodeLockOverlay";

// Protected Route Guard Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated, user, isLoading, _hasHydrated } = useAuthStore();
  const lockHydrated = useAppLockStore((s) => s._hasHydrated);

  if (isLoading || !_hasHydrated || !lockHydrated) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Cold-start offline safety: allow read-only offline viewing as long as cached credentials/user state exist in native storage, regardless of token expiry
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  const hasCachedUser = Boolean(user && user.id);
  const isAuthorized = isAuthenticated || (isOffline && hasCachedUser) || isUserAuthenticated();

  if (!isAuthorized) {
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
import { PromoVideoPage } from "./pages/promo/PromoVideoPage";

const RootRoute: React.FC = () => {
  const { isAuthenticated, user, isLoading, _hasHydrated } = useAuthStore();
  if (!Capacitor.isNativePlatform() && !_hasHydrated) return null; // Wait for zustand to read Capacitor Preferences
  // If native platform, we can wait too to avoid Lottie crash in LandingPage while resolving auth
  if (!_hasHydrated || isLoading) return null;

  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  const hasCachedUser = Boolean(user && user.id);
  const isAuthorized = isAuthenticated || (isOffline && hasCachedUser) || isUserAuthenticated();

  return isAuthorized ? <Navigate to="/today" replace /> : <LandingPage />;
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
    const {
      updateInfo,
      phase,
      progress,
      errorMessage,
      isSheetOpen,
      startDownload,
      cancelDownload,
      triggerInstall,
      snooze,
      dismiss,
    } = useNativeUpdates();

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
      if (Capacitor.isNativePlatform()) {
        try { await CapacitorUpdater.notifyAppReady(); } catch (e) {}
      }
      try { await useConfigStore.getState().fetchConfig(); } catch (e) {}
      try {
        if (Capacitor.isNativePlatform()) {
          try {
            const info = await CapacitorApp.getInfo();
            const nativeVersion = info.version;
            const localVer = localStorage.getItem("app_version") || "0.0.0";
            if (localVer !== nativeVersion) {
              localStorage.setItem("app_version", nativeVersion);
            }
            const currentBundle = await CapacitorUpdater.current().catch(() => null);
            const activeBundleId = (currentBundle as any)?.bundle?.id;
            const isStaleCustomBundle = Boolean(activeBundleId && activeBundleId !== "builtin");
            if (isVersionNewer(nativeVersion, localVer) || isStaleCustomBundle) {
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
          await NotificationService.scheduleAllProactiveNotifications();
        } catch (e) {
          console.error("Failed to schedule proactive notifications on launch", e);
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
      NotificationService.scheduleAllProactiveNotifications().catch(console.error);
    }
  }, [isAuthenticated, hydrated]);

  // Global listeners to automatically re-schedule notifications when timetable, events, subjects, or semester update
  useEffect(() => {
    const handleReSchedule = () => {
      NotificationService.scheduleAllProactiveNotifications(true).catch(() => {});
    };
    window.addEventListener("timetable-updated", handleReSchedule);
    window.addEventListener("events-updated", handleReSchedule);
    window.addEventListener("semester-transitioned", handleReSchedule);
    window.addEventListener("semester-updated", handleReSchedule);
    window.addEventListener("subject-updated", handleReSchedule);
    return () => {
      window.removeEventListener("timetable-updated", handleReSchedule);
      window.removeEventListener("events-updated", handleReSchedule);
      window.removeEventListener("semester-transitioned", handleReSchedule);
      window.removeEventListener("semester-updated", handleReSchedule);
      window.removeEventListener("subject-updated", handleReSchedule);
    };
  }, []);

  // Global listener to sync Android Home Screen Widgets whenever attendance, timetable, or semester updates
  useEffect(() => {
    const syncWidgets = () => {
      const state = useAttendanceStore.getState();
      const cache = useCacheStore.getState();
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const todayCache = cache.today?.[todayStr];
      const weeklySlots = cache.timetable?.slots || [];

      let agenda = todayCache?.agenda || [];
      if (agenda.length === 0) {
        const jsDay = today.getDay();
        const dbDay = jsDay === 0 ? 6 : jsDay - 1;
        const todaySlots = weeklySlots
          .filter((s: any) => s.dayOfWeek === dbDay && !s.validUntil)
          .sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || ''));

        if (todaySlots.length > 0) {
          agenda = todaySlots.map((s: any, idx: number) => ({
            id: s.id || `slot_${idx}`,
            subjectId: s.subjectId,
            subject: s.subject || state.subjects.find(sub => sub.id === s.subjectId || sub.subjectId === s.subjectId) || { id: s.subjectId, name: s.subjectName || "Scheduled Class" },
            startTime: s.startTime,
            endTime: s.endTime,
            room: s.room,
            type: "slot",
            status: null,
          }));
        }
      }

      WidgetBridgeService.syncFromAppState({
        agenda,
        overallPercentage: state.overallPercentage,
        subjects: state.subjects,
        todayStatus: todayCache?.todayStatus,
        weeklySlots,
      });
    };

    let isReconcilingWidgets = false;
    let needsAnotherReconcile = false;

    const reconcileAndSync = async () => {
      if (isReconcilingWidgets) {
        needsAnotherReconcile = true;
        return;
      }
      isReconcilingWidgets = true;
      try {
        do {
          needsAnotherReconcile = false;
          try {
            if (typeof navigator !== "undefined" && navigator.onLine) {
              const hasQueuedExtra = useOfflineStore
                .getState()
                .queue.some((q) => q.url?.includes("/timetable/extra-class"));
              if (hasQueuedExtra) {
                await useOfflineStore.getState().flushQueue();
              }
            }
          } catch (e) {
            console.warn("Failed to flush pre-widget queue", e);
          }
          try {
            const mutations = await WidgetBridgeService.reconcilePendingWidgetMutations();
            if (mutations && mutations.length > 0) {
              window.dispatchEvent(new Event("attendance-updated"));
            }
          } catch (e) {
            console.warn("Failed to reconcile widget mutations", e);
          }
          try {
            await WidgetBridgeService.reconcileBufferedAnnouncements();
          } catch (e) {
            console.warn("Failed to reconcile buffered announcements", e);
          }
          syncWidgets();
        } while (needsAnotherReconcile);
      } finally {
        isReconcilingWidgets = false;
      }
    };

    reconcileAndSync();

    let appStateHandle: any = null;
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          reconcileAndSync();
        }
      }).then(h => { appStateHandle = h; });
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        reconcileAndSync();
      }
    };

    window.addEventListener("attendance-updated", syncWidgets);
    window.addEventListener("timetable-updated", syncWidgets);
    window.addEventListener("semester-updated", syncWidgets);
    window.addEventListener("events-updated", syncWidgets);
    window.addEventListener("focus", reconcileAndSync);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("attendance-updated", syncWidgets);
      window.removeEventListener("timetable-updated", syncWidgets);
      window.removeEventListener("semester-updated", syncWidgets);
      window.removeEventListener("events-updated", syncWidgets);
      window.removeEventListener("focus", reconcileAndSync);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (appStateHandle) appStateHandle.remove();
    };
  }, []);

  // Passcode Vault background/foreground lock lifecycle
  useEffect(() => {
    let lockStateHandle: any = null;
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener("appStateChange", ({ isActive }) => {
        const lockState = useAppLockStore.getState();
        if (isActive) {
          lockState.evaluateForegroundResume();
        } else {
          lockState.recordBackground();
        }
      }).then((h) => {
        lockStateHandle = h;
      });
    }
    const onVisibility = () => {
      const lockState = useAppLockStore.getState();
      if (document.visibilityState === "hidden") {
        lockState.recordBackground();
      } else if (document.visibilityState === "visible") {
        lockState.evaluateForegroundResume();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (lockStateHandle) lockStateHandle.remove();
    };
  }, []);

  return (
    <ErrorBoundary>
      <DynamicIslandHUD />
      <PasscodeLockOverlay />
      <ShockwaveCelebrationOverlay />
      {!splashFinished && <WebSplashScreen onComplete={handleSplashComplete} />}
      <Toaster
        position="top-center"
        theme={theme as any}
        duration={2500}
        visibleToasts={2}
        toastOptions={{
          className: "rounded-xl border border-border shadow-lg mt-4 md:mt-0",
        }}
      />
      {nativeUpdater.isAvailable() && (
        <NativeUpdateSheet
          isOpen={isSheetOpen}
          onClose={dismiss}
          updateInfo={updateInfo}
          phase={phase}
          progress={progress}
          errorMessage={errorMessage}
          onStartDownload={startDownload}
          onCancelDownload={cancelDownload}
          onInstall={triggerInstall}
          onSnooze={snooze}
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
            <Route path="/promo" element={<PromoVideoPage />} />

            {/* Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/forgot-password"
              element={<LoginPage initialForgotPassword={true} />}
            />
            <Route
              path="/reset-password"
              element={<LoginPage initialForgotPassword={true} />}
            />
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
              <Route path="/offline-lab" element={<OfflineLabPage />} />
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





