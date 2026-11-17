import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capgo/capacitor-speech-recognition";
import { NotificationService } from "./NotificationService";
import { NativeVoiceService } from "./NativeVoiceService";
import {
  checkDndPermission,
  checkExactAlarmPermission,
  checkNativeMicrophonePermission,
  checkNativeNotificationPermission,
  openNativeAppSettings,
  openNativeNotificationSettings,
  requestDndPermission,
  requestExactAlarmPermission,
} from "../lib/ringer";

export type AppPermissionKey =
  | "notifications"
  | "microphone"
  | "exactAlarms"
  | "dndAccess";

export interface AppPermissionSnapshot {
  notifications: boolean;
  microphone: boolean;
  exactAlarms: boolean;
  dndAccess: boolean;
}

const DEFAULT_SNAPSHOT: AppPermissionSnapshot = {
  notifications: true,
  microphone: true,
  exactAlarms: true,
  dndAccess: false,
};

let latestSnapshot: AppPermissionSnapshot = { ...DEFAULT_SNAPSHOT };
const listeners = new Set<(snap: AppPermissionSnapshot) => void>();

function notifySnapshot(next: AppPermissionSnapshot) {
  latestSnapshot = next;
  listeners.forEach((cb) => {
    try {
      cb(next);
    } catch {}
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("attendx-permissions-changed", { detail: next }),
    );
  }
}

export class PermissionService {
  static getCachedSnapshot(): AppPermissionSnapshot {
    return latestSnapshot;
  }

  static subscribe(cb: (snap: AppPermissionSnapshot) => void): () => void {
    listeners.add(cb);
    cb(latestSnapshot);
    return () => {
      listeners.delete(cb);
    };
  }

  static async checkMicrophone(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const nativeGranted = await checkNativeMicrophonePermission();
        if (nativeGranted) return true;
        const speechStatus = await SpeechRecognition.checkPermissions();
        return speechStatus?.speechRecognition === "granted";
      } catch {
        return false;
      }
    }

    if (
      typeof navigator !== "undefined" &&
      navigator.permissions &&
      typeof navigator.permissions.query === "function"
    ) {
      try {
        const status = await navigator.permissions.query({
          name: "microphone" as PermissionName,
        });
        // On web, only mark locked when explicitly denied; "prompt" unlocks on click
        return status.state !== "denied";
      } catch {
        return true;
      }
    }
    return true;
  }

  static async checkNotifications(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        const nativeEnabled = await checkNativeNotificationPermission();
        const capStatus = await NotificationService.checkPermissions();
        return nativeEnabled && capStatus === "granted";
      }
      const webStatus = await NotificationService.checkPermissions();
      return webStatus === "granted";
    } catch {
      return false;
    }
  }

  static async getSnapshot(): Promise<AppPermissionSnapshot> {
    const [notifications, microphone, exactAlarms, dndAccess] = await Promise.all([
      this.checkNotifications(),
      this.checkMicrophone(),
      checkExactAlarmPermission(),
      Capacitor.isNativePlatform() ? checkDndPermission() : Promise.resolve(false),
    ]);

    const snapshot: AppPermissionSnapshot = {
      notifications,
      microphone,
      exactAlarms,
      dndAccess,
    };
    notifySnapshot(snapshot);
    return snapshot;
  }

  /**
   * Smartly requests a permission: tries the native OS runtime prompt first,
   * and if Android suppresses the dialog due to prior denial, opens the exact
   * system settings page so the user can re-enable it cleanly.
   */
  static async requestSmart(kind: AppPermissionKey): Promise<boolean> {
    if (kind === "notifications") {
      const granted = await NotificationService.requestPermissions();
      if (granted) {
        await this.getSnapshot();
        return true;
      }
      if (Capacitor.isNativePlatform()) {
        await openNativeNotificationSettings();
      }
      await this.getSnapshot();
      return latestSnapshot.notifications;
    }

    if (kind === "microphone") {
      const granted = await NativeVoiceService.requestPermissions();
      if (granted) {
        await this.getSnapshot();
        return true;
      }
      if (Capacitor.isNativePlatform()) {
        await openNativeAppSettings();
      }
      await this.getSnapshot();
      return latestSnapshot.microphone;
    }

    if (kind === "exactAlarms") {
      await requestExactAlarmPermission();
      await this.getSnapshot();
      return latestSnapshot.exactAlarms;
    }

    await requestDndPermission();
    await this.getSnapshot();
    return latestSnapshot.dndAccess;
  }

  /**
   * Runs on every app launch to silently re-try runtime prompts if OS permits
   * and detect any denied critical permissions for the startup unlock sheet.
   */
  static async runStartupPermissionAudit(): Promise<{
    hasMissing: boolean;
    snapshot: AppPermissionSnapshot;
  }> {
    if (!Capacitor.isNativePlatform()) {
      const snap = await this.getSnapshot();
      return { hasMissing: false, snapshot: snap };
    }

    const initial = await this.getSnapshot();

    if (!initial.notifications) {
      await NotificationService.requestPermissions().catch(() => false);
    }
    if (!initial.microphone) {
      await SpeechRecognition.requestPermissions().catch(() => null);
    }

    const updated = await this.getSnapshot();
    const hasMissing =
      !updated.notifications || !updated.microphone || !updated.exactAlarms;

    return { hasMissing, snapshot: updated };
  }
}
