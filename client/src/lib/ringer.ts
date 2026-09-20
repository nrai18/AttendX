import { registerPlugin, Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface RingerPlugin {
  setRingerMode(options: { mode: 'silent' | 'vibrate' | 'normal' }): Promise<void>;
}

const RingerMode = registerPlugin<RingerPlugin>('RingerMode');

export const mutePhone = async (): Promise<boolean> => {
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
           schedule: { at: new Date(Date.now() + 1000) }
         }]
       });
    }
    return false;
  }
};

export const unmutePhone = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await RingerMode.setRingerMode({ mode: 'normal' });
    return true;
  } catch (err) {
    console.error('Failed to unmute phone:', err);
    return false;
  }
};
