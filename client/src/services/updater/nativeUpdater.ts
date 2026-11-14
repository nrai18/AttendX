import { registerPlugin, PluginListenerHandle } from "@capacitor/core";
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
  installApk(options: { filePath: string }): Promise<{
    success: boolean;
    installerLaunched: boolean;
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
      typeof (window as any).Capacitor !== "undefined" &&
      (window as any).Capacitor.isNativePlatform()
    );
  }

  static async getAppInfo() {
    if (!this.isAvailable()) {
      return {
        packageName: "com.attendx.app",
        versionName: "4.3.0",
        versionCode: 17,
        canRequestPackageInstalls: true,
      };
    }
    return ApkUpdater.getAppInfo();
  }

  static async checkInstallPermission() {
    if (!this.isAvailable()) return { granted: true };
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
    let handle: PluginListenerHandle | null = null;
    if (this.isAvailable() && onProgress) {
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
    if (!this.isAvailable())
      return {
        valid: true,
        packageName: "com.attendx.app",
        versionName: "4.3.0",
        versionCode: 18,
        currentVersionCode: 17,
      };
    return ApkUpdater.validateApk({ filePath });
  }

  static async installApk(filePath: string) {
    if (!this.isAvailable()) return { success: true, installerLaunched: true };
    return ApkUpdater.installApk({ filePath });
  }
}

export const nativeUpdater = NativeUpdaterBridge;
