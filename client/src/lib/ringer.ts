import { registerPlugin, Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface RingerPlugin {
  setRingerMode(options: { mode: 'silent' | 'vibrate' | 'normal'; unmuteEpochMs?: number; className?: string }): Promise<void>;
  checkDndPermission(): Promise<{ granted: boolean }>;
  requestDndPermission(): Promise<{ opened: boolean }>;
  checkNotificationPermission(): Promise<{ granted: boolean }>;
  openNotificationSettings(): Promise<{ opened: boolean }>;
  checkExactAlarmPermission(): Promise<{ granted: boolean }>;
  requestExactAlarmPermission(): Promise<{ opened: boolean }>;
  checkMicrophonePermission(): Promise<{ granted: boolean }>;
  openAppSettings(): Promise<{ opened: boolean }>;
  testMuteNotification(): Promise<{ success: boolean }>;
  isMuteSessionActive(): Promise<{ active: boolean; unmuteEpochMs: number }>;
  consumePendingLaunchRoute(): Promise<{ route?: string | null }>;
  scheduleClassReminder(options: {
    id: number;
    title: string;
    body: string;
    largeBody?: string;
    summaryText?: string;
    className: string;
    triggerAtMs: number;
    endTimeMs: number;
    autoDndIfPermitted?: boolean;
  }): Promise<{ scheduled: boolean }>;
  cancelAllClassReminders(): Promise<{ cancelled: boolean }>;
}

const RingerMode = registerPlugin<RingerPlugin>('RingerMode');

export const UNMUTE_TIMESTAMP_STORAGE_KEY = 'attendx_scheduled_unmute_time';

export const setScheduledUnmuteTime = (timestampMs: number | null): void => {
  try {
    if (timestampMs !== null && !isNaN(timestampMs)) {
      localStorage.setItem(UNMUTE_TIMESTAMP_STORAGE_KEY, String(timestampMs));
    } else {
      localStorage.removeItem(UNMUTE_TIMESTAMP_STORAGE_KEY);
    }
  } catch (e) {
    console.warn('Failed to set scheduled unmute time in storage', e);
  }
};

export const getScheduledUnmuteTime = (): number | null => {
  try {
    const raw = localStorage.getItem(UNMUTE_TIMESTAMP_STORAGE_KEY);
    if (!raw) return null;
    const num = Number(raw);
    return isNaN(num) ? null : num;
  } catch (e) {
    return null;
  }
};

export const checkDndPermission = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await RingerMode.checkDndPermission();
    return !!res?.granted;
  } catch (e) {
    return false;
  }
};

export const requestDndPermission = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await RingerMode.requestDndPermission();
    return !!res?.opened;
  } catch (e) {
    return false;
  }
};

export const checkNativeNotificationPermission = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await RingerMode.checkNotificationPermission();
    return !!res?.granted;
  } catch (e) {
    return false;
  }
};

export const openNativeNotificationSettings = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await RingerMode.openNotificationSettings();
    return !!res?.opened;
  } catch (e) {
    return false;
  }
};

export const checkExactAlarmPermission = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const res = await RingerMode.checkExactAlarmPermission();
    return !!res?.granted;
  } catch (e) {
    return true;
  }
};

export const requestExactAlarmPermission = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await RingerMode.requestExactAlarmPermission();
    return !!res?.opened;
  } catch (e) {
    return false;
  }
};

export const checkNativeMicrophonePermission = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await RingerMode.checkMicrophonePermission();
    return !!res?.granted;
  } catch (e) {
    return false;
  }
};

export const openNativeAppSettings = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await RingerMode.openAppSettings();
    return !!res?.opened;
  } catch (e) {
    return false;
  }
};

export const testMuteNotification = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await RingerMode.testMuteNotification();
    return !!res?.success;
  } catch (e) {
    return false;
  }
};

export const PERMISSION_WARNING_NOTIF_ID = 7002;

export const checkAndReconcileRinger = async (pinnedNotificationId: number = 7001): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  const unmuteTime = getScheduledUnmuteTime();
  // Include 1-second defensive window for setTimeout jitter or tick quantization
  if (unmuteTime !== null && (Date.now() >= unmuteTime - 1000)) {
    try {
      const nativeState = await RingerMode.isMuteSessionActive();
      if (!nativeState?.active) {
        // Native receiver already unmuted (manual button or native alarm); clear JS state without overwriting manual user audio mode
        setScheduledUnmuteTime(null);
        try {
          await LocalNotifications.cancel({ notifications: [{ id: pinnedNotificationId }, { id: 8888 }] });
        } catch {}
        return false;
      }
    } catch {}

    console.log("Scheduled unmute time elapsed or reached; restoring ringer to normal.");
    const success = await unmutePhone();
    try {
      await LocalNotifications.cancel({ notifications: [{ id: pinnedNotificationId }, { id: 8888 }] });
    } catch {}
    try {
      // @ts-ignore
      if (typeof LocalNotifications.removeDeliveredNotifications === 'function') {
        await LocalNotifications.removeDeliveredNotifications({ notifications: [{ id: pinnedNotificationId }, { id: 8888 }] as any });
      }
    } catch {}
    if (!success) {
      // Clear scheduled time even if unmute failed to avoid an endless retry loop
      setScheduledUnmuteTime(null);
    }
    return success;
  }
  return false;
};

export const mutePhone = async (unmuteEpochMs?: number, className?: string): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await RingerMode.setRingerMode({ mode: 'silent', unmuteEpochMs, className });
    if (unmuteEpochMs) {
      setScheduledUnmuteTime(unmuteEpochMs);
    }
    return true;
  } catch (err: any) {
    console.error('Failed to mute phone:', err);
    
    // Notify the user they need to grant permission manually
    if (err.message?.includes('DND') || err.message?.includes('permission')) {
      try {
        await LocalNotifications.schedule({
          notifications: [{
            id: PERMISSION_WARNING_NOTIF_ID,
            title: "Action Required: DND Access Missing",
            body: "Tap here to open Do Not Disturb settings and allow AttendX to mute your phone during classes.",
            summaryText: "System Warning",
            smallIcon: "ic_stat_attendx",
            largeIcon: "attendx_notification_icon",
            iconColor: "#F59E0B",
            channelId: 'system_alerts',
            extra: { type: 'dnd_permission', route: '/settings' },
            schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true }
          }]
        });
      } catch (notifErr) {
        console.warn("Failed to schedule permission warning notification:", notifErr);
      }
    }
    return false;
  }
};

export const unmutePhone = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await RingerMode.setRingerMode({ mode: 'normal' });
    setScheduledUnmuteTime(null);
    return true;
  } catch (err) {
    console.error('Failed to unmute phone:', err);
    return false;
  }
};

export const consumePendingLaunchRoute = async (): Promise<string | null> => {
  if (Capacitor.getPlatform() !== 'android') return null;
  try {
    const res = await RingerMode.consumePendingLaunchRoute();
    return res?.route && typeof res.route === 'string' ? res.route : null;
  } catch {
    return null;
  }
};

export const scheduleNativeClassReminder = async (options: {
  id: number;
  title: string;
  body: string;
  largeBody?: string;
  summaryText?: string;
  className: string;
  triggerAtMs: number;
  endTimeMs: number;
  autoDndIfPermitted?: boolean;
}): Promise<boolean> => {
  if (Capacitor.getPlatform() !== 'android') return false;
  try {
    const res = await RingerMode.scheduleClassReminder(options);
    return !!res?.scheduled;
  } catch {
    return false;
  }
};

export const cancelAllNativeClassReminders = async (): Promise<void> => {
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    await RingerMode.cancelAllClassReminders();
  } catch {}
};
