import { useState, useEffect, useCallback } from "react";
import {
  NativeUpdateInfo,
  UpdatePhase,
  DownloadProgressInfo,
} from "../services/updater/updateTypes";
import { UpdateManager } from "../services/updater/updateManager";
import { UpdateStorage } from "../services/updater/updateStorage";
import { nativeUpdater } from "../services/updater/nativeUpdater";
import { verifyNativeUpdaterEligibility } from "../services/updater/deviceUpdateGate";
import { App as CapacitorApp } from "@capacitor/app";

export function useNativeUpdates() {
  const [updateInfo, setUpdateInfo] = useState<NativeUpdateInfo | null>(null);
  const [phase, setPhase] = useState<UpdatePhase>("idle");
  const [progress, setProgress] = useState<DownloadProgressInfo | null>(null);
  const [verifiedPath, setVerifiedPath] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [hasCheckedInitial, setHasCheckedInitial] = useState(() => !nativeUpdater.isAvailable());

  const checkUpdates = useCallback(async (manual = false) => {
    if (!nativeUpdater.isAvailable()) {
      setPhase("idle");
      setUpdateInfo(null);
      setIsSheetOpen(false);
      setHasCheckedInitial(true);
      return;
    }
    setPhase("checking");
    try {
      const gate = await verifyNativeUpdaterEligibility(manual);
      if (!gate.eligible) {
        setPhase("idle");
        setUpdateInfo(null);
        setIsSheetOpen(false);
        return;
      }
      const res = await UpdateManager.checkForUpdates(manual);
      if (res.channel === "native-apk" && res.nativeInfo) {
        setUpdateInfo(res.nativeInfo);
        const currentPhase = UpdateManager.getPhase();
        setPhase(currentPhase);
        setVerifiedPath(UpdateManager.getVerifiedFilePath());
        if (
          currentPhase === "available" ||
          currentPhase === "verified" ||
          manual
        ) {
          setIsSheetOpen(true);
        }
      } else {
        setPhase(res.status === "up-to-date" ? "up-to-date" : "error");
      }
    } catch (e: any) {
      setPhase("error");
      setErrorMessage(e?.message || "Failed to check for updates");
    } finally {
      setHasCheckedInitial(true);
    }
  }, []);

  useEffect(() => {
    checkUpdates(false);
  }, [checkUpdates]);

  // Recover from "installing" state and check for updates on foreground resume (respects 10m GitHub cache + 24h snooze)
  useEffect(() => {
    if (!nativeUpdater.isAvailable()) return;
    const handle = CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        const mgrPhase = UpdateManager.getPhase();
        if (mgrPhase === "downloading" || mgrPhase === "installing") {
          setPhase((prev) => (prev === "installing" ? "verified" : prev));
          return;
        }
        checkUpdates(false);
      }
    });
    return () => {
      handle.then((h) => h.remove()).catch(() => {});
    };
  }, [checkUpdates]);

  useEffect(() => {
    const handleOpenSheet = async () => {
      if (!nativeUpdater.isAvailable()) return;
      const latestInfo = UpdateManager.getActiveNativeUpdate() || updateInfo;
      if (latestInfo) {
        const currentPhase = UpdateManager.getPhase();
        setUpdateInfo(latestInfo);
        setVerifiedPath(UpdateManager.getVerifiedFilePath());
        setPhase(currentPhase === "idle" ? "available" : currentPhase);
        setIsSheetOpen(true);
        return;
      }
      const gate = await verifyNativeUpdaterEligibility(false);
      if (!gate.eligible) return;
      checkUpdates(true);
    };
    window.addEventListener("open-update-sheet", handleOpenSheet);
    return () => window.removeEventListener("open-update-sheet", handleOpenSheet);
  }, [updateInfo, checkUpdates]);

  const startDownload = async () => {
    if (!updateInfo || !nativeUpdater.isAvailable()) return;

    setPhase("downloading");
    UpdateManager.setPhase("downloading");
    setErrorMessage(null);
    setProgress(null);

    try {
      const res = await nativeUpdater.downloadApk(
        updateInfo.apkUrl,
        updateInfo.expectedSha256,
        `AttendX-${updateInfo.tag}.apk`,
        (prog) => setProgress(prog),
      );

      let validation;
      try {
        validation = await nativeUpdater.validateApk(res.filePath);
      } catch (valErr) {
        await nativeUpdater.deleteFile(res.filePath);
        throw valErr;
      }
      if (!validation.valid) {
        await nativeUpdater.deleteFile(res.filePath);
        throw new Error("Downloaded package validation failed");
      }

      await UpdateStorage.saveVerifiedApk(updateInfo.tag, res.filePath);
      setVerifiedPath(res.filePath);
      UpdateManager.setVerifiedFilePath(res.filePath);
      UpdateManager.setPhase("verified");
      setPhase("verified");
      window.dispatchEvent(new CustomEvent("native-update-available"));
    } catch (err: any) {
      const msg = err?.message || "Download failed. Please check network connection.";
      if (msg.toLowerCase().includes("cancelled")) {
        UpdateManager.setPhase("available");
        setPhase("available");
        setErrorMessage(null);
      } else {
        UpdateManager.setPhase("error");
        setPhase("error");
        setErrorMessage(msg);
      }
    }
  };

  const cancelDownload = async () => {
    await nativeUpdater.cancelDownload();
    setProgress(null);
    setErrorMessage(null);
    UpdateManager.setPhase("available");
    setPhase("available");
  };

  const triggerInstall = async () => {
    if (!verifiedPath) return;
    setErrorMessage(null);
    try {
      setPhase("installing");
      const res = await nativeUpdater.installApk(verifiedPath);
      if (res?.permissionRequired) {
        setPhase("verified");
        setErrorMessage("Please enable 'Install unknown apps' in Android Settings, then tap Install Update Now again.");
      } else if (!res?.installerLaunched) {
        setPhase("verified");
        setErrorMessage("Could not launch Android PackageInstaller.");
      }
    } catch (err: any) {
      const msg = err?.message || "Failed to launch installer";
      if (msg.toLowerCase().includes("does not exist")) {
        await UpdateStorage.clearVerifiedApk();
        setVerifiedPath(null);
        UpdateManager.setVerifiedFilePath(null);
        UpdateManager.setPhase("available");
        setPhase("available");
        setErrorMessage("Cached APK was cleared by Android. Please download it again.");
      } else {
        setPhase("verified");
        setErrorMessage(msg);
      }
    }
  };

  const snooze = async (hours = 24) => {
    if (phase === "downloading") {
      await nativeUpdater.cancelDownload();
    }
    if (updateInfo) {
      await UpdateStorage.setSnooze(updateInfo.tag, hours);
      UpdateManager.dismiss();
    }
    setIsSheetOpen(false);
  };

  const dismiss = async () => {
    if (phase === "downloading") {
      await nativeUpdater.cancelDownload();
      setProgress(null);
      UpdateManager.setPhase("available");
      setPhase("available");
    }
    UpdateManager.dismiss();
    setIsSheetOpen(false);
  };

  return {
    updateInfo,
    phase,
    progress,
    verifiedPath,
    errorMessage,
    isSheetOpen,
    hasCheckedInitial,
    setIsSheetOpen,
    checkUpdates,
    startDownload,
    cancelDownload,
    triggerInstall,
    snooze,
    dismiss,
  };
}
