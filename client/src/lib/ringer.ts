import { registerPlugin, Capacitor } from '@capacitor/core';

export interface RingerPlugin {
  setRingerMode(options: { mode: 'silent' | 'vibrate' | 'normal' }): Promise<void>;
}

const RingerMode = registerPlugin<RingerPlugin>('RingerMode');

export const mutePhone = async () => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await RingerMode.setRingerMode({ mode: 'silent' });
  } catch (err: any) {
    if (err.message === 'DND_PERMISSION_REQUIRED') {
      console.warn('DND permission required to mute phone.');
    } else {
      console.error('Failed to mute phone:', err);
    }
  }
};

export const unmutePhone = async () => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await RingerMode.setRingerMode({ mode: 'normal' });
  } catch (err) {
    console.error('Failed to unmute phone:', err);
  }
};
