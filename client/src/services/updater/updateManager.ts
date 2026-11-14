import { GitHubUpdater } from "./githubUpdater";
import { nativeUpdater } from "./nativeUpdater";
import { UpdateStorage } from "./updateStorage";
import { NativeUpdateInfo, UpdatePhase } from "./updateTypes";
import { CapacitorUpdater } from "@capgo/capacitor-updater";

export class UpdateManager {
  private static activeNativeUpdate: NativeUpdateInfo | null = null;
  private static phase: UpdatePhase = "idle";
  private static verifiedFilePath: string | null = null;

  static async checkForUpdates(force = false): Promise<{
    channel: "native-apk" | "capgo-ota" | "none";
    nativeInfo?: NativeUpdateInfo;
  }> {
    // 1. Prioritize Native APK Check
    const nativeInfo = await GitHubUpdater.checkForNativeUpdate(force);

    if (nativeInfo) {
      this.activeNativeUpdate = nativeInfo;
      const isSnoozed = await UpdateStorage.isSnoozed(nativeInfo.tag);

      // Check if this APK was already downloaded and verified
      const existingFile = await UpdateStorage.getVerifiedApk(nativeInfo.tag);
      if (existingFile) {
        this.verifiedFilePath = existingFile;
        this.phase = "verified";
      } else {
        this.phase = isSnoozed && !force ? "idle" : "available";
      }

      return { channel: "native-apk", nativeInfo };
    }

    // 2. Fallback to Capgo OTA Check if Native Binary is Current
    if (nativeUpdater.isAvailable()) {
      try {
        await CapacitorUpdater.notifyAppReady();
      } catch (_) {}
    }

    return { channel: "none" };
  }

  static getActiveNativeUpdate(): NativeUpdateInfo | null {
    return this.activeNativeUpdate;
  }

  static getPhase(): UpdatePhase {
    return this.phase;
  }

  static setPhase(p: UpdatePhase) {
    this.phase = p;
  }

  static getVerifiedFilePath(): string | null {
    return this.verifiedFilePath;
  }

  static setVerifiedFilePath(path: string | null) {
    this.verifiedFilePath = path;
  }
}
