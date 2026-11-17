import { Capacitor, registerPlugin, PluginListenerHandle } from "@capacitor/core";
import { DownloadProgressInfo } from "./updateTypes";

interface ApkUpdaterPluginInterface {
  getAppInfo(): Promise<{
    packageName: string;
    versionName: string;
    versionCode: number;
    canRequestPackageInstalls: boolean;
  }>;
  checkInstallPermission(): Promise<{ granted: boolean }>;
  openInstallPermissionSettings(): Promise<void>;
  downloadApk(options: {
    url: string;
    sha256?: string;
    filename?: string;
  }): Promise<{ filePath: string; sha256: string; fileSize: number }>;
  cancelDownload(): Promise<void>;
  validateApk(options: { filePath: string }): Promise<{
    valid: boolean;
    packageName: string;
    versionName: string;
    versionCode: number;
    currentVersionCode: number;
  }>;
  fileExists(options: { filePath: string }): Promise<{ exists: boolean }>;
  deleteFile(options: { filePath: string }): Promise<{ deleted: boolean }>;
  clearCachedApks(): Promise<{ cleared: boolean }>;
  installApk(options: { filePath: string }): Promise<{
    success: boolean;
    installerLaunched: boolean;
    permissionRequired?: boolean;
  }>;
  addListener(
    eventName: "downloadProgress",
    listenerFunc: (info: DownloadProgressInfo) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "downloadCancelled",
    listenerFunc: () => void,
  ): Promise<PluginListenerHandle>;
}

const ApkUpdater = registerPlugin<ApkUpdaterPluginInterface>("ApkUpdater");

export class NativeUpdaterBridge {
  static isAvailable(): boolean {
    return (
      typeof window !== "undefined" &&
      Capacitor.isNativePlatform() &&
      Capacitor.getPlatform() === "android" &&
      Capacitor.isPluginAvailable("ApkUpdater")
    );
  }

  static async getAppInfo() {
    if (!this.isAvailable()) {
      return null;
    }
    return ApkUpdater.getAppInfo();
  }

  static async checkInstallPermission() {
    if (!this.isAvailable()) return { granted: false };
    return ApkUpdater.checkInstallPermission();
  }

  static async openInstallPermissionSettings() {
    if (!this.isAvailable()) return;
    return ApkUpdater.openInstallPermissionSettings();
  }

  static async downloadApk(
    url: string,
    sha256?: string,
    filename = "AttendX-update.apk",
    onProgress?: (info: DownloadProgressInfo) => void,
  ) {
    if (!this.isAvailable()) {
      throw new Error("Native APK download is only supported on Android devices.");
    }
    let handle: PluginListenerHandle | null = null;
    if (onProgress) {
      handle = await ApkUpdater.addListener("downloadProgress", onProgress);
    }
    try {
      const res = await ApkUpdater.downloadApk({ url, sha256, filename });
      return res;
    } finally {
      if (handle) await handle.remove();
    }
  }

  static async cancelDownload() {
    if (!this.isAvailable()) return;
    return ApkUpdater.cancelDownload();
  }

  static async validateApk(filePath: string) {
    if (!this.isAvailable()) {
      return {
        valid: false,
        packageName: "",
        versionName: "",
        versionCode: 0,
        currentVersionCode: 0,
      };
    }
    return ApkUpdater.validateApk({ filePath });
  }

  static async fileExists(filePath: string): Promise<boolean> {
    if (!this.isAvailable() || !filePath) return false;
    try {
      const res = await ApkUpdater.fileExists({ filePath });
      return Boolean(res?.exists);
    } catch {
      return false;
    }
  }

  static async deleteFile(filePath: string): Promise<boolean> {
    if (!this.isAvailable() || !filePath) return false;
    try {
      const res = await ApkUpdater.deleteFile({ filePath });
      return Boolean(res?.deleted);
    } catch {
      return false;
    }
  }

  static async clearCachedApks(): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await ApkUpdater.clearCachedApks();
    } catch {}
  }

  static async installApk(filePath: string) {
    if (!this.isAvailable()) return { success: false, installerLaunched: false };
    return ApkUpdater.installApk({ filePath });
  }
}

export const nativeUpdater = NativeUpdaterBridge;
