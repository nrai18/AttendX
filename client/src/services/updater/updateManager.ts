import { GitHubUpdater } from "./githubUpdater";
import { nativeUpdater } from "./nativeUpdater";
import { UpdateStorage } from "./updateStorage";
import { NativeUpdateInfo, UpdatePhase } from "./updateTypes";
import { verifyNativeUpdaterEligibility } from "./deviceUpdateGate";

export class UpdateManager {
  private static activeNativeUpdate: NativeUpdateInfo | null = null;
  private static phase: UpdatePhase = "idle";
  private static verifiedFilePath: string | null = null;
  private static isDismissed: boolean = false;

  static async checkForUpdates(force = false): Promise<{
    channel: "native-apk" | "none";
    status: "update-available" | "up-to-date" | "ineligible" | "rate-limited" | "network-error";
    nativeInfo?: NativeUpdateInfo;
  }> {
    // 0. Eligibility Gate: Verify native Android runtime + Linked Devices session
    const gate = await verifyNativeUpdaterEligibility(true);
    if (!gate.eligible) {
      this.activeNativeUpdate = null;
      this.isDismissed = true;
      return { channel: "none", status: "ineligible" };
    }

    // 1. Prioritize Native APK Check
    const { info: nativeInfo, status } = await GitHubUpdater.checkForNativeUpdateWithStatus(force);

    if (nativeInfo) {
      this.activeNativeUpdate = nativeInfo;
      const isSnoozed = await UpdateStorage.isSnoozed(nativeInfo.tag);
      let isSessionDismissed = false;
      try {
        isSessionDismissed = sessionStorage.getItem(`dismissed_update_${nativeInfo.tag}`) === "true";
      } catch (_) {}

      // Verify cached APK still exists on disk and passes validation (cacheDir may be evicted by Android)
      let validExistingFile: string | null = null;
      const existingFile = await UpdateStorage.getVerifiedApk(nativeInfo.tag);
      if (existingFile) {
        const exists = await nativeUpdater.fileExists(existingFile);
        if (exists) {
          try {
            const val = await nativeUpdater.validateApk(existingFile);
            if (val.valid) validExistingFile = existingFile;
          } catch {}
        }
        if (!validExistingFile) {
          await UpdateStorage.clearVerifiedApk();
          await nativeUpdater.deleteFile(existingFile);
        }
      }

      if (validExistingFile) {
        this.verifiedFilePath = validExistingFile;
        this.phase = "verified";
      } else {
        this.verifiedFilePath = null;
        this.phase = (isSnoozed || isSessionDismissed) && !force ? "idle" : "available";
      }

      if ((isSnoozed || isSessionDismissed) && !force) {
        this.isDismissed = true;
      } else {
        this.isDismissed = false;
      }

      window.dispatchEvent(
        new CustomEvent("native-update-available", { detail: { nativeInfo } })
      );

      return { channel: "native-apk", status: "update-available", nativeInfo };
    } else if (status === "up-to-date") {
      this.activeNativeUpdate = null;
      this.verifiedFilePath = null;
      this.phase = "up-to-date";
      this.isDismissed = true;
      // Clean up previously downloaded update APKs after successful upgrade
      await UpdateStorage.clearVerifiedApk();
      await nativeUpdater.clearCachedApks();
    } else {
      return { channel: "none", status: status === "rate-limited" ? "rate-limited" : "network-error" };
    }

    return { channel: "none", status: "up-to-date" };
  }

  static getActiveNativeUpdate(): NativeUpdateInfo | null {
    return this.activeNativeUpdate;
  }

  static setActiveNativeUpdate(info: NativeUpdateInfo | null) {
    this.activeNativeUpdate = info;
    if (info) {
      this.isDismissed = false;
    }
  }

  static isVisible(): boolean {
    return Boolean(
      nativeUpdater.isAvailable() &&
      this.activeNativeUpdate &&
      !this.isDismissed
    );
  }

  static dismiss(tag?: string) {
    this.isDismissed = true;
    const activeTag = tag || this.activeNativeUpdate?.tag;
    if (activeTag) {
      try {
        sessionStorage.setItem(`dismissed_update_${activeTag}`, "true");
      } catch (_) {}
    }
    window.dispatchEvent(new CustomEvent("native-update-dismissed"));
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
