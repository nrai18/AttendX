import { registerPlugin, Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface RingerPlugin {
  setRingerMode(options: { mode: 'silent' | 'vibrate' | 'normal' }): Promise<void>;
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

export const PERMISSION_WARNING_NOTIF_ID = 7002;

export const checkAndReconcileRinger = async (pinnedNotificationId: number = 7001): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  const unmuteTime = getScheduledUnmuteTime();
  // Include 1-second defensive window for setTimeout jitter or tick quantization
  if (unmuteTime !== null && (Date.now() >= unmuteTime - 1000)) {
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

export const mutePhone = async (unmuteEpochMs?: number): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await RingerMode.setRingerMode({ mode: 'silent' });
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
            title: "Action Required: Permission Missing",
            body: "AttendX needs 'Do Not Disturb' access to mute your phone for classes. Please enable it in your phone Settings.",
            summaryText: "System Warning",
            smallIcon: "ic_stat_adobe",
            iconColor: "#F59E0B",
            channelId: 'system_alerts',
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

