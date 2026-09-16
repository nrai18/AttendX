import { registerPlugin, Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface RingerPlugin {
  setRingerMode(options: { mode: 'silent' | 'vibrate' | 'normal' }): Promise<void>;
}

const RingerMode = registerPlugin<RingerPlugin>('RingerMode');

export const UNMUTE_TIMESTAMP_STORAGE_KEY = 'attendx_scheduled_unmute_time';

export const getScheduledUnmuteTime = (): number | null => {
  try {
    const val = typeof window !== 'undefined' ? localStorage.getItem(UNMUTE_TIMESTAMP_STORAGE_KEY) : null;
    return val ? parseInt(val, 10) : null;
  } catch {
    return null;
  }
};

export const setScheduledUnmuteTime = (timestampMs: number | null): void => {
  try {
    if (typeof window === 'undefined') return;
    if (timestampMs === null) {
      localStorage.removeItem(UNMUTE_TIMESTAMP_STORAGE_KEY);
    } else {
      localStorage.setItem(UNMUTE_TIMESTAMP_STORAGE_KEY, timestampMs.toString());
    }
  } catch (err) {
    console.error('Failed to set scheduled unmute timestamp in storage:', err);
  }
};

export const mutePhone = async (unmuteUntilMs?: number): Promise<boolean> => {
  if (unmuteUntilMs) {
    setScheduledUnmuteTime(unmuteUntilMs);
  }
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await RingerMode.setRingerMode({ mode: 'silent' });
    return true;
  } catch (err: any) {
    console.error('Failed to mute phone:', err);
    
    // Notify the user they need to grant permission manually
    if (err.message?.includes('DND') || err.message?.includes('permission')) {
       await LocalNotifications.schedule({
         notifications: [{
           id: 8080,
           title: "Action Required: Permission Missing",
           body: "AttendX needs 'Do Not Disturb' access to mute your phone for classes. Please enable it in your phone Settings.",
           channelId: 'system_alerts',
           schedule: { at: new Date(Date.now() + 1000) }
         }]
       });
    }
    return false;
  }
};

export const unmutePhone = async (): Promise<boolean> => {
  setScheduledUnmuteTime(null);
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await RingerMode.setRingerMode({ mode: 'normal' });
    return true;
  } catch (err) {
    console.error('Failed to unmute phone:', err);
    return false;
  }
};

export const checkAndReconcileRinger = async (): Promise<boolean> => {
  const unmuteTime = getScheduledUnmuteTime();
  if (unmuteTime !== null && Date.now() >= unmuteTime) {
    console.log("Scheduled unmute time elapsed during app suspension or background; restoring ringer to normal.");
    const success = await unmutePhone();
    try {
      if (Capacitor.isNativePlatform()) {
        await LocalNotifications.cancel({ notifications: [{ id: 8888 }] });
      }
    } catch (e) {
      console.warn("Failed to cancel pinned silent mode notification during ringer reconciliation:", e);
    }
    return success;
  }
  return false;
};

