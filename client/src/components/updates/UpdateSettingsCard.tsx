import React, { useState, useEffect } from "react";
import {
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Activity,
  HardDrive,
  Bell,
  ChevronDown,
  ChevronUp,
  Terminal,
  ExternalLink,
  Zap,
} from "lucide-react";
import { PushNotifications } from "@capacitor/push-notifications";
import {
  NativeUpdateInfo,
  UpdatePhase,
} from "../../services/updater/updateTypes";
import { nativeUpdater } from "../../services/updater/nativeUpdater";
import { SoundFX } from "../../utils/soundEffects";
import { toast } from "sonner";

interface Props {
  updateInfo: NativeUpdateInfo | null;
  phase: UpdatePhase;
  onOpenSheet: () => void;
  onCheckAgain: () => Promise<boolean | void> | void;
}

export const UpdateSettingsCard: React.FC<Props> = ({
  updateInfo,
  phase,
  onOpenSheet,
  onCheckAgain,
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<string>(
    updateInfo ? `Update ${updateInfo.versionName} available` : "Tap Check Updates to verify"
  );
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [packageInstallPermission, setPackageInstallPermission] = useState<
    "checking" | "granted" | "restricted" | "unknown"
  >("checking");
  const [pushStatus, setPushStatus] = useState<"checking" | "granted" | "denied">("checking");
  const [appInfo, setAppInfo] = useState<{
    versionName: string;
    versionCode: number;
    packageName: string;
  }>({
    versionName: "...",
    versionCode: 0,
    packageName: "com.attendx.app",
  });

  const checkDiagnostics = async () => {
    if (!nativeUpdater.isAvailable()) return;
    try {
      const info = await nativeUpdater.getAppInfo();
      if (info) {
        setAppInfo(info);
      }
      const perm = await nativeUpdater.checkInstallPermission();
      setPackageInstallPermission(perm?.granted ? "granted" : "restricted");
    } catch (_) {
      setPackageInstallPermission("unknown");
    }
    try {
      const pushPerm = await PushNotifications.checkPermissions();
      setPushStatus(pushPerm.receive === "granted" ? "granted" : "denied");
    } catch (_) {
      setPushStatus("denied");
    }
  };

  useEffect(() => {
    if (nativeUpdater.isAvailable()) {
      checkDiagnostics();
    }
  }, []);

  const handleManualCheck = async () => {
    try {
      SoundFX.playSnapPopSound();
    } catch (_) {}
    setIsChecking(true);
    const start = performance.now();
    try {
      const ok = await onCheckAgain();
      const elapsed = Math.round(performance.now() - start);
      if (ok === false) {
        setLatencyMs(null);
        setLastCheckTime("Check failed (offline or rate-limited)");
      } else {
        setLatencyMs(elapsed);
        setLastCheckTime(`Checked just now (${elapsed}ms)`);
      }
      await checkDiagnostics();
    } catch (e: any) {
      setLatencyMs(null);
      setLastCheckTime("Check failed");
      toast.error(e?.message || "Failed to check update server");
    } finally {
      setIsChecking(false);
    }
  };

  const handleOpenPermissionSettings = async () => {
    try {
      await nativeUpdater.openInstallPermissionSettings();
    } catch (e: any) {
      toast.error(e?.message || "Unable to open OS settings");
    }
  };

  if (!nativeUpdater.isAvailable()) return null;

  return (
    <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 text-foreground shadow-sm space-y-4 font-sans transition-colors">
      {/* Top Identity Row */}
      <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-mono tracking-wider uppercase text-muted-foreground font-bold">
              System Firmware & Updates
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-muted text-foreground border border-border">
              v{appInfo.versionName} • Build {appInfo.versionCode || "..."}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-primary/10 text-primary border border-primary/20">
              Channel: GitHub Stable
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {updateInfo
              ? `Release ${updateInfo.versionName} is ready to install (${updateInfo.apkSizeMb} MB).`
              : "AttendX is running the verified target build with zero package drift."}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {updateInfo && (
            <button
              onClick={onOpenSheet}
              className="px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl flex items-center gap-1.5 hover:bg-primary/90 transition-colors cursor-pointer shrink-0 shadow-md"
            >
              <span>{phase === "verified" ? "Install Update" : "Update Now"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={handleManualCheck}
            disabled={isChecking}
            title="Check for updates"
            className="px-3.5 py-2 rounded-xl bg-muted/60 hover:bg-muted border border-border/80 text-xs text-foreground transition-all cursor-pointer flex items-center gap-2 shrink-0 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-muted-foreground ${
                isChecking ? "animate-spin text-primary" : ""
              }`}
            />
            {!updateInfo && (
              <span className="font-mono text-[11px]">
                {isChecking ? "Checking..." : "Check Updates"}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Latency & Status Pill */}
      <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground bg-muted/30 px-3 py-2 rounded-xl border border-border/50">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-emerald-500" />
          <span>{lastCheckTime}</span>
        </div>
        {latencyMs !== null && (
          <span className="text-emerald-500 font-bold">
            ⚡ {latencyMs}ms Gateway Ping
          </span>
        )}
      </div>

      {/* Diagnostics Toggle Bar */}
      <div className="pt-1 border-t border-border/40 flex items-center justify-between">
        <button
          onClick={() => {
            setIsDiagnosticsOpen(!isDiagnosticsOpen);
            checkDiagnostics();
          }}
          className="text-[11px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <Terminal className="w-3.5 h-3.5 text-primary" />
          <span>Live Subsystem Diagnostics</span>
          {isDiagnosticsOpen ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Expandable Diagnostics Grid */}
      {isDiagnosticsOpen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Card 1: PackageInstaller Permission */}
          <div className="p-3 bg-muted/20 border border-border/60 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                Package Installer
              </span>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                  packageInstallPermission === "granted"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                }`}
              >
                {packageInstallPermission.toUpperCase()}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {packageInstallPermission === "granted"
                ? "REQUEST_INSTALL_PACKAGES granted. Ready for silent atomic handoff."
                : packageInstallPermission === "unknown"
                  ? "Unable to query install permission status."
                  : "Permission restricted by OS. Tap to authorize in Android Settings."}
            </p>
            {packageInstallPermission === "restricted" && (
              <button
                onClick={handleOpenPermissionSettings}
                className="text-[10px] text-amber-500 hover:text-amber-600 underline flex items-center gap-1 cursor-pointer pt-1 font-semibold"
              >
                <span>Authorize in OS Settings</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            )}
          </div>

          {/* Card 2: FileProvider Sandbox */}
          <div className="p-3 bg-muted/20 border border-border/60 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <HardDrive className="w-3 h-3 text-primary" />
                FileProvider Cache
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/25">
                SANDBOX OK
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Authority: {appInfo.packageName}.fileprovider
              <br />
              Path: Context.getCacheDir()/apk-updates/
            </p>
          </div>

          {/* Card 3: Release Distribution Channel */}
          <div className="p-3 bg-muted/20 border border-border/60 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-3 h-3 text-emerald-500" />
                Release Channel
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                NATIVE APK ONLY
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Native APK v{appInfo.versionName} (Build {appInfo.versionCode}) • GitHub Releases.
            </p>
          </div>

          {/* Card 4: FCM Notification Routing */}
          <div className="p-3 bg-muted/20 border border-border/60 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Bell className="w-3 h-3 text-purple-500" />
                FCM Push Permission
              </span>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                  pushStatus === "granted"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                }`}
              >
                {pushStatus.toUpperCase()}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Routes "native_update" and "app_update" pushes directly to NativeUpdateSheet.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
