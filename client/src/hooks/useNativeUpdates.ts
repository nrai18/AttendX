import { useState, useEffect, useCallback } from "react";
import {
  NativeUpdateInfo,
  UpdatePhase,
  DownloadProgressInfo,
} from "../services/updater/updateTypes";
import { UpdateManager } from "../services/updater/updateManager";
import { UpdateStorage } from "../services/updater/updateStorage";
import { nativeUpdater } from "../services/updater/nativeUpdater";

export function useNativeUpdates() {
  const [updateInfo, setUpdateInfo] = useState<NativeUpdateInfo | null>(null);
  const [phase, setPhase] = useState<UpdatePhase>("idle");
  const [progress, setProgress] = useState<DownloadProgressInfo | null>(null);
  const [verifiedPath, setVerifiedPath] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const checkUpdates = useCallback(async (manual = false) => {
    setPhase("checking");
    try {
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
        setPhase("up-to-date");
      }
    } catch (e: any) {
      setPhase("error");
      setErrorMessage(e?.message || "Failed to check for updates");
    }
  }, []);

  useEffect(() => {
    checkUpdates(false);
  }, [checkUpdates]);

  const startDownload = async () => {
    if (!updateInfo) return;
    setPhase("downloading");
    setErrorMessage(null);

    try {
      const res = await nativeUpdater.downloadApk(
        updateInfo.apkUrl,
        updateInfo.expectedSha256,
        `AttendX-${updateInfo.tag}.apk`,
        (prog) => setProgress(prog),
      );

      // Validate APK integrity & versionCode before installation
      const validation = await nativeUpdater.validateApk(res.filePath);
      if (!validation.valid) {
        throw new Error("Downloaded package validation failed");
      }

      await UpdateStorage.saveVerifiedApk(updateInfo.tag, res.filePath);
      setVerifiedPath(res.filePath);
      UpdateManager.setVerifiedFilePath(res.filePath);
      setPhase("verified");
    } catch (err: any) {
      setPhase("error");
      setErrorMessage(
        err?.message || "Download failed. Please check network connection.",
      );
    }
  };

  const triggerInstall = async () => {
    if (!verifiedPath) return;
    try {
      setPhase("installing");
      await nativeUpdater.installApk(verifiedPath);
    } catch (err: any) {
      setPhase("error");
      setErrorMessage(err?.message || "Failed to launch installer");
    }
  };

  const snooze = async (hours = 24) => {
    if (updateInfo) {
      await UpdateStorage.setSnooze(updateInfo.tag, hours);
    }
    setIsSheetOpen(false);
  };

  return {
    updateInfo,
    phase,
    progress,
    verifiedPath,
    errorMessage,
    isSheetOpen,
    setIsSheetOpen,
    checkUpdates,
    startDownload,
    triggerInstall,
    snooze,
  };
}
