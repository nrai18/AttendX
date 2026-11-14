import { Preferences } from "@capacitor/preferences";

const KEY_SNOOZED_UNTIL = "attendx_update_snoozed_until";
const KEY_SNOOZED_TAG = "attendx_update_snoozed_tag";
const KEY_VERIFIED_FILE = "attendx_update_verified_file";
const KEY_VERIFIED_TAG = "attendx_update_verified_tag";

export class UpdateStorage {
  static async setSnooze(tag: string, hours = 24): Promise<void> {
    const snoozedUntil = Date.now() + hours * 60 * 60 * 1000;
    await Preferences.set({
      key: KEY_SNOOZED_UNTIL,
      value: String(snoozedUntil),
    });
    await Preferences.set({ key: KEY_SNOOZED_TAG, value: tag });
  }

  static async isSnoozed(tag: string): Promise<boolean> {
    const { value: snoozedUntilStr } = await Preferences.get({
      key: KEY_SNOOZED_UNTIL,
    });
    const { value: snoozedTag } = await Preferences.get({
      key: KEY_SNOOZED_TAG,
    });

    if (!snoozedUntilStr || snoozedTag !== tag) return false;
    const snoozedUntil = Number(snoozedUntilStr);
    return Date.now() < snoozedUntil;
  }

  static async saveVerifiedApk(tag: string, filePath: string): Promise<void> {
    await Preferences.set({ key: KEY_VERIFIED_FILE, value: filePath });
    await Preferences.set({ key: KEY_VERIFIED_TAG, value: tag });
  }

  static async getVerifiedApk(tag: string): Promise<string | null> {
    const { value: vTag } = await Preferences.get({ key: KEY_VERIFIED_TAG });
    const { value: filePath } = await Preferences.get({
      key: KEY_VERIFIED_FILE,
    });
    return vTag === tag && filePath ? filePath : null;
  }

  static async clearVerifiedApk(): Promise<void> {
    await Preferences.remove({ key: KEY_VERIFIED_FILE });
    await Preferences.remove({ key: KEY_VERIFIED_TAG });
  }
}
