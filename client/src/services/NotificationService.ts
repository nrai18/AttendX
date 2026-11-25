import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { mutePhone, unmutePhone, checkAndReconcileRinger, setScheduledUnmuteTime, getScheduledUnmuteTime, PERMISSION_WARNING_NOTIF_ID, requestDndPermission } from '../lib/ringer';
import { nativeUpdater } from "./updater/nativeUpdater";
import { useAttendanceStore } from '../stores/attendanceStore';
import { useAssignmentStore } from '../stores/assignmentStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useAuthStore } from '../stores/authStore';
import { useCacheStore } from '../stores/cacheStore';
import { useOfflineStore } from '../stores/offlineStore';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { triggerDynamicHUD } from '../components/ui/dynamic-island-hud';
import { addMinutes, setHours, setMinutes, startOfDay, addDays, isSameDay } from 'date-fns';

// ─────────────────────────────────────────────────────────
// NOTIFICATION ID BANDS (Rigid, Non-Overlapping Architecture)
// ─────────────────────────────────────────────────────────
export const PINNED_MUTE_NOTIF_ID = 7001;
export { PERMISSION_WARNING_NOTIF_ID };
export const ACADEMIC_UPDATES_START_ID = 8800;
export const ACADEMIC_UPDATES_END_ID = 8899;
export const ASSIGNMENT_REMINDERS_START_ID = 9000;
export const ASSIGNMENT_REMINDERS_END_ID = 69999;
export const HOLIDAY_NOTIF_START_ID = 70000;
export const HOLIDAY_NOTIF_END_ID = 74999;
export const BIRTHDAY_NOTIF_START_ID = 75000;
export const BIRTHDAY_NOTIF_END_ID = 79999;
export const TIMETABLE_NOTIF_START_ID = 100000;
export const TIMETABLE_NOTIF_END_ID = 899999;

/**
 * Deterministic string-to-positive-integer hash (djb2 variant).
 */
export function hashStringToNumber(str: string): number {
  const s = typeof str === 'string' ? str : String(str || '');
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) + s.charCodeAt(i);
    hash = hash & 0x7FFFFFFF;
  }
  return hash;
}

/**
 * Formats a Date or date string to local calendar "YYYY-MM-DD" without UTC day-shift.
 */
export function formatLocalDate(dateInput: Date | string): string {
  if (typeof dateInput === 'string') {
    const match = dateInput.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generates deterministic notification IDs for timetable slots and daily summaries.
 */
export function getNotificationIdForSlot(
  slotId: string,
  dayOrDate: string | number,
  type: 'standard' | 'headsup' | 'endofday' = 'standard'
): number {
  const dateStr = typeof dayOrDate === 'string' ? dayOrDate : String(dayOrDate);
  const hash = hashStringToNumber(`${slotId}_${dateStr}_${type}`);
  return TIMETABLE_NOTIF_START_ID + (hash % 799999);
}

export function getHolidayNotificationId(dateStr: string): number {
  return HOLIDAY_NOTIF_START_ID + (hashStringToNumber(dateStr) % 5000);
}

export function getBirthdayNotificationId(name: string, dateStr: string): number {
  return BIRTHDAY_NOTIF_START_ID + (hashStringToNumber(`${name}_${dateStr}`) % 5000);
}

export function getAssignmentNotificationId(assignmentId: string, reminderIndex: number): number {
  return ASSIGNMENT_REMINDERS_START_ID + ((hashStringToNumber(assignmentId) % 20000) * 3) + (reminderIndex % 3);
}

/**
 * Identifies whether a notification ID belongs to the managed set that
 * autoScheduleFromTimetable() is responsible for re-synchronizing.
 */
export function isManagedTimetableNotificationId(id: number): boolean {
  return (
    (id >= TIMETABLE_NOTIF_START_ID && id <= TIMETABLE_NOTIF_END_ID) ||
    (id >= HOLIDAY_NOTIF_START_ID && id <= BIRTHDAY_NOTIF_END_ID)
  );
}

/**
 * Checks if a calendar event (with optional multi-day range) is active on a given target day.
 */
export function isEventActiveOnDate(e: { date?: string; endDate?: string }, targetDay: Date): boolean {
  if (!e || !e.date) return false;
  const start = parseLocalDate(e.date);
  const end = e.endDate ? parseLocalDate(e.endDate) : start;
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
  const target = startOfDay(targetDay);
  const startTime = Math.min(start.getTime(), end.getTime());
  const endTime = Math.max(start.getTime(), end.getTime());
  return target.getTime() >= startTime && target.getTime() <= endTime;
}

/**
 * Safely parses a date string in local calendar time (e.g. YYYY-MM-DD),
 * avoiding negative UTC timezone offset day-shift bugs.
 */
export function parseLocalDate(dateInput: string | Date): Date {
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? startOfDay(new Date()) : startOfDay(dateInput);
  }
  if (typeof dateInput === 'string') {
    const match = dateInput.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      const d = new Date(year, month, day, 0, 0, 0, 0);
      return isNaN(d.getTime()) ? startOfDay(new Date()) : d;
    }
  }
  const parsed = new Date(dateInput);
  return isNaN(parsed.getTime()) ? startOfDay(new Date()) : startOfDay(parsed);
}

/**
 * Safely parses HH:mm onto a base date, guaranteeing 0 seconds/milliseconds.
 */
export function parseTimeOnDate(baseDate: Date, timeStr?: string): Date | null {
  if (!baseDate || isNaN(baseDate.getTime()) || !timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  const result = new Date(baseDate);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/**
 * Clamps target day of month to the maximum valid day in that month
 * (e.g. Feb 31 -> Feb 28/29, Apr 31 -> Apr 30), preventing rollover bugs.
 */
export function clampDateToMonth(year: number, monthIndex: number, targetDay: number): Date {
  const safeDay = isNaN(targetDay) ? 1 : targetDay;
  const maxDays = new Date(year, monthIndex + 1, 0).getDate();
  const clampedDay = Math.min(Math.max(1, safeDay), maxDays);
  return new Date(year, monthIndex, clampedDay);
}

function toDeviceLocalDateTime(baseDate: Date, hour: number, minute: number): Date {
  return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hour, minute, 0, 0);
}

/**
 * Pure calculation for academic summary dates across Daily, Weekly, Monthly, and Yearly frequencies.
 */
export function calculateNextSummaryDates(
  frequency: { type: string; subValue?: string },
  summaryTimeStr: string = "18:00",
  now: Date = new Date()
): Date[] {
  let [summaryHour, summaryMinute] = [18, 0];
  if (summaryTimeStr) {
    const parts = summaryTimeStr.split(":");
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    summaryHour = isNaN(h) ? 18 : Math.min(23, Math.max(0, h));
    summaryMinute = isNaN(m) ? 0 : Math.min(59, Math.max(0, m));
  }

  const results: Date[] = [];
  const today = startOfDay(now);

  if (frequency.type === 'Daily') {
    for (let i = 0; i <= 7; i++) {
      const candidate = toDeviceLocalDateTime(addDays(today, i), summaryHour, summaryMinute);
      if (candidate.getTime() > now.getTime()) {
        results.push(candidate);
      }
    }
  } else if (frequency.type === 'Weekly') {
    const daysMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const targetDay = (frequency.subValue && daysMap[frequency.subValue] !== undefined)
      ? daysMap[frequency.subValue]
      : 1;

    let firstTargetDay = today;
    while (firstTargetDay.getDay() !== targetDay) {
      firstTargetDay = addDays(firstTargetDay, 1);
    }

    const todayCandidate = toDeviceLocalDateTime(firstTargetDay, summaryHour, summaryMinute);
    if (todayCandidate.getTime() <= now.getTime()) {
      firstTargetDay = addDays(firstTargetDay, 7);
    }

    for (let i = 0; i < 4; i++) {
      const weeklyDate = toDeviceLocalDateTime(addDays(firstTargetDay, i * 7), summaryHour, summaryMinute);
      results.push(weeklyDate);
    }
  } else if (frequency.type === 'Monthly') {
    const rawTargetDay = parseInt(frequency.subValue || "1", 10);
    const targetDay = isNaN(rawTargetDay) ? 1 : rawTargetDay;
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const currentMonthClamped = clampDateToMonth(currentYear, currentMonth, targetDay);
    const currentCandidate = toDeviceLocalDateTime(currentMonthClamped, summaryHour, summaryMinute);

    const startMonthOffset = currentCandidate.getTime() > now.getTime() ? 0 : 1;

    for (let i = 0; i < 3; i++) {
      const targetMonthIndex = currentMonth + startMonthOffset + i;
      const monthRef = new Date(currentYear, targetMonthIndex, 1);
      const year = monthRef.getFullYear();
      const month = monthRef.getMonth();
      const clampedDate = clampDateToMonth(year, month, targetDay);
      results.push(toDeviceLocalDateTime(clampedDate, summaryHour, summaryMinute));
    }
  }

  return results;
}

export function getOffDayEventForDate(
  events: any[],
  date: Date,
): { title: string; isExam: boolean } | null {
  const dayEvents = (events || []).filter((e) => isEventActiveOnDate(e, date));
  for (const e of dayEvents) {
    const lowerTitle = (e.title || "").toLowerCase();
    const typeLower = (e.type || e.eventType || "").toLowerCase();
    if (
      typeLower === "restricted" ||
      typeLower === "restricted_holiday" ||
      lowerTitle.includes("restricted")
    ) {
      continue;
    }
    if (typeLower === "holiday" || lowerTitle.includes("holiday")) {
      return { title: e.title || "Holiday", isExam: false };
    }
    if (lowerTitle.includes("vacation") || lowerTitle.includes("break")) {
      return { title: e.title || "Break", isExam: false };
    }
    if (
      typeLower === "exam" ||
      /\b(midsem|mid[\s-]?sem|midterm|mid[\s-]?term|endsem|end[\s-]?sem|exam)\b/i.test(
        lowerTitle,
      )
    ) {
      return { title: e.title || "Exam", isExam: true };
    }
  }
  return null;
}

export function getInstructionalCutoffIso(
  events: any[],
  activeSemester?: any,
): string | null {
  let ltdIso: string | null = null;
  for (const e of events || []) {
    const lowerTitle = (e?.title || "").toLowerCase();
    if (
      lowerTitle.includes("last teaching day") ||
      lowerTitle.includes("last working day")
    ) {
      const raw = e.endDate || e.date;
      if (raw) {
        const iso = formatLocalDate(parseLocalDate(raw));
        if (!ltdIso || iso > ltdIso) ltdIso = iso;
      }
    }
  }
  let semEndIso: string | null = null;
  if (activeSemester?.endDate) {
    semEndIso = formatLocalDate(parseLocalDate(activeSemester.endDate));
  }
  if (ltdIso && semEndIso) return ltdIso < semEndIso ? ltdIso : semEndIso;
  return ltdIso || semEndIso;
}

export class NotificationService {
  private static readonly SYNCED_FCM_TOKEN_KEY = "attendx_synced_fcm_token";
  private static isInitialized = false;
  private static isSchedulingTimetable = false;
  private static hasQueuedTimetableRun = false;
  private static isSchedulingAssignments = false;
  private static hasQueuedAssignmentsRun = false;
  private static isSchedulingAcademic = false;
  private static hasQueuedAcademicRun = false;
  private static lastResumeScheduleAt = 0;
  private static lastProactiveSyncAt = 0;
  private static lastStatsSyncAt = 0;
  private static inFlightProactiveSync: Promise<void> | null = null;
  private static lastAcademicFrequency: {
    type: string;
    subValue?: string;
  } | null = null;
  private static unmuteTimeoutId: ReturnType<typeof setTimeout> | null = null;

  static async waitForStoreHydration(
    timeoutMs: number = 2000,
  ): Promise<boolean> {
    const stores = [
      useAuthStore,
      useAttendanceStore,
      useCacheStore,
      useNotificationStore,
      useAssignmentStore,
    ];
    const allHydrated = () =>
      stores.every((store) => store.persist?.hasHydrated?.() !== false);

    if (allHydrated()) return true;

    return new Promise<boolean>((resolve) => {
      let resolved = false;
      const tryFinish = () => {
        if (!resolved && allHydrated()) {
          resolved = true;
          clearTimeout(timer);
          resolve(true);
        }
      };

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(
            Boolean(
              allHydrated() || useAttendanceStore.getState().activeSemesterId,
            ),
          );
        }
      }, timeoutMs);

      for (const store of stores) {
        if (store.persist?.hasHydrated?.() === false && store.persist?.onFinishHydration) {
          store.persist.onFinishHydration(tryFinish);
        }
      }
    });
  }

  private static pushListenersRegistered = false;

  private static setupPushListeners() {
    if (!Capacitor.isNativePlatform() || this.pushListenersRegistered) return;
    this.pushListenersRegistered = true;

    PushNotifications.addListener("registration", async (token) => {
      console.log("[FCM] Push registration success, token: " + token.value);
      localStorage.setItem("fcm_token", token.value);
      try {
        if (useAuthStore.getState().isAuthenticated) {
          const lastSynced = localStorage.getItem(this.SYNCED_FCM_TOKEN_KEY);
          if (lastSynced !== token.value) {
            await api.patch("/users/me", { fcmToken: token.value });
            localStorage.setItem(this.SYNCED_FCM_TOKEN_KEY, token.value);
            console.log("[FCM] Successfully synced FCM token to backend.");
          }
        }
      } catch (error) {
        console.error(
          "[FCM] Failed to sync FCM token to backend (will retry on login):",
          error,
        );
      }
    });

    PushNotifications.addListener("registrationError", (error: any) => {
      console.error("[FCM] Error on registration: " + JSON.stringify(error));
    });

    PushNotifications.addListener(
      "pushNotificationReceived",
      (notification) => {
        console.log("[FCM] Push received in foreground: ", notification);
        let rawData =
          notification.data || (notification as any)?.notification?.data || {};
        if (typeof rawData === "string") {
          try {
            rawData = JSON.parse(rawData);
          } catch (_) {}
        }
        const data =
          typeof rawData === "object" && rawData !== null ? rawData : {};
        const type = String(
          data.type || data.notification_type || "",
        ).toLowerCase();
        const classroomId = String(
          data.classroomId || data.classroom_id || data.id || "",
        );
        const title =
          notification.title || data.pushTitle || data.title || "Notification";
        const body = notification.body || data.pushBody || data.body || "";
        const targetRoute =
          data.route ||
          data.url ||
          (classroomId
            ? `/classrooms/${classroomId}`
            : type === "classroom_deleted"
              ? "/classrooms"
              : type === "semester_transition"
                ? "/today?promptSemesterTransition=true"
                : type === "birthday" || type === "peer_sync_redeemed"
                  ? "/today"
                  : null);

        if (
          type === "classroom_announcement" ||
          type === "classroom_broadcast" ||
          type === "announcement"
        ) {
          if (classroomId) {
            const annObj = {
              id: data.announcementId || data.id || `fcm-${Date.now()}`,
              title: data.title || title || "Classroom Notice",
              content: data.content || data.body || body || "",
              body: data.content || data.body || body || "",
              importance: data.importance || "low",
              isPinned: Boolean(data.isPinned && data.isPinned !== "false"),
              createdAt: data.createdAt || new Date().toISOString(),
              authorName: data.authorName || "Classroom Admin",
            };
            useCacheStore
              .getState()
              .appendClassroomAnnouncement(classroomId, annObj);
          }
          window.dispatchEvent(
            new CustomEvent("fcm_classroom_broadcast", {
              detail: { ...data, classroomId, type },
            }),
          );
          triggerDynamicHUD({
            type: "plane",
            label: title,
            subtitle: body,
            durationMs: 5000,
            route: targetRoute || undefined,
          });
        } else if (
          type === "classroom_poll_created" ||
          type === "classroom_poll_closed" ||
          type === "classroom_poll_stopped" ||
          type === "classroom_poll"
        ) {
          window.dispatchEvent(
            new CustomEvent("fcm_classroom_poll_updated", {
              detail: { ...data, classroomId, type },
            }),
          );
          triggerDynamicHUD({
            type: type === "classroom_poll_closed" || type === "classroom_poll_stopped" ? "success" : "plane",
            label: title,
            subtitle: body,
            durationMs: 4500,
            route: targetRoute || undefined,
          });
        } else if (
          type === "classroom_access_updated" ||
          type === "broadcast_permission_updated"
        ) {
          window.dispatchEvent(
            new CustomEvent("fcm_classroom_access_updated", {
              detail: { ...data, classroomId, type },
            }),
          );
          triggerDynamicHUD({
            type: "success",
            label: title,
            subtitle: body,
            durationMs: 4000,
            route: targetRoute || undefined,
          });
        } else if (
          type === "classroom_deleted" ||
          type === "classroom_disbanded"
        ) {
          window.dispatchEvent(
            new CustomEvent("fcm_classroom_deleted", {
              detail: { ...data, classroomId, type },
            }),
          );
          triggerDynamicHUD({
            type: "trash",
            label: title,
            subtitle: body,
            durationMs: 5000,
            route: "/classrooms",
          });
        } else if (
          type === "native_update" ||
          type === "ota_update" ||
          type === "app_update" ||
          type === "update"
        ) {
          triggerDynamicHUD({
            type: "sparkle",
            label: title,
            subtitle: body,
            durationMs: 5000,
          });
          if (nativeUpdater.isAvailable()) {
            window.dispatchEvent(new CustomEvent("open-update-sheet"));
          }
        } else if (
          type === "semester_transition" ||
          type === "peer_sync_redeemed" ||
          type === "birthday" ||
          notification.title ||
          data.title ||
          data.pushTitle
        ) {
          triggerDynamicHUD({
            type: type === "peer_sync_redeemed" ? "success" : "sparkle",
            label: title,
            subtitle: body,
            durationMs: 5000,
            route: targetRoute || undefined,
          });
        }
      },
    );

    PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (notification) => {
        console.log("[FCM] Push action performed: ", notification);
        let rawData =
          notification.notification?.data || (notification as any)?.data || {};
        if (typeof rawData === "string") {
          try {
            rawData = JSON.parse(rawData);
          } catch (_) {}
        }
        const data =
          typeof rawData === "object" && rawData !== null ? rawData : {};
        const type = String(
          data.type || data.notification_type || "",
        ).toLowerCase();
        const classroomId = String(
          data.classroomId || data.classroom_id || data.id || "",
        );
        const targetRoute =
          data.route ||
          data.url ||
          (classroomId
            ? `/classrooms/${classroomId}`
            : type === "classroom_deleted"
              ? "/classrooms"
              : type === "semester_transition"
                ? "/today?promptSemesterTransition=true"
                : type === "birthday" || type === "peer_sync_redeemed"
                  ? "/today"
                  : null);

        // Re-dispatch live events when user taps notification from tray
        if (
          type === "classroom_announcement" ||
          type === "classroom_broadcast" ||
          type === "announcement"
        ) {
          if (classroomId) {
            const annObj = {
              id: data.announcementId || data.id || `fcm-${Date.now()}`,
              title: data.title || "Classroom Notice",
              content: data.content || data.body || "",
              body: data.content || data.body || "",
              importance: data.importance || "low",
              isPinned: Boolean(data.isPinned && data.isPinned !== "false"),
              createdAt: data.createdAt || new Date().toISOString(),
              authorName: data.authorName || "Classroom Admin",
            };
            useCacheStore
              .getState()
              .appendClassroomAnnouncement(classroomId, annObj);
          }
          window.dispatchEvent(
            new CustomEvent("fcm_classroom_broadcast", {
              detail: { ...data, classroomId, type },
            }),
          );
        } else if (
          type === "classroom_poll_created" ||
          type === "classroom_poll_closed" ||
          type === "classroom_poll_stopped" ||
          type === "classroom_poll"
        ) {
          window.dispatchEvent(
            new CustomEvent("fcm_classroom_poll_updated", {
              detail: { ...data, classroomId, type },
            }),
          );
        } else if (
          type === "classroom_access_updated" ||
          type === "broadcast_permission_updated"
        ) {
          window.dispatchEvent(
            new CustomEvent("fcm_classroom_access_updated", {
              detail: { ...data, classroomId, type },
            }),
          );
        } else if (
          type === "classroom_deleted" ||
          type === "classroom_disbanded"
        ) {
          window.dispatchEvent(
            new CustomEvent("fcm_classroom_deleted", {
              detail: { ...data, classroomId, type },
            }),
          );
        }

        if (type === "native_update" || type === "ota_update" || type === "app_update" || type === "update") {
          if (nativeUpdater.isAvailable()) {
            window.dispatchEvent(new CustomEvent("open-update-sheet"));
          }
        } else if (targetRoute) {
          try {
            sessionStorage.setItem("pending_push_route", targetRoute);
          } catch (_) {}
          window.dispatchEvent(
            new CustomEvent("push_route", { detail: targetRoute }),
          );
        }
      },
    );
  }

  static async checkPermissions(): Promise<
    "prompt" | "prompt-with-rationale" | "granted" | "denied"
  > {
    if (!Capacitor.isNativePlatform()) {
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") return "granted";
        if (Notification.permission === "denied") return "denied";
        return "prompt";
      }
      return "granted";
    }
    try {
      const perm = await LocalNotifications.checkPermissions();
      return perm.display;
    } catch {
      return "denied";
    }
  }

  static async requestPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      if (typeof window !== "undefined" && "Notification" in window) {
        try {
          const res = await Notification.requestPermission();
          return res === "granted";
        } catch {
          return false;
        }
      }
      return true;
    }
    try {
      let perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        perm = await LocalNotifications.requestPermissions();
      }
      const isGranted = perm.display === "granted";
      if (isGranted) {
        await this.registerPushNotifications();
        await this.syncFcmToken();
        this.scheduleAllProactiveNotifications().catch(() => {});
      }
      return isGranted;
    } catch (e) {
      console.warn("Failed to request notification permissions:", e);
      return false;
    }
  }

  static async registerPushNotifications() {
    if (!Capacitor.isNativePlatform()) return;

    try {
      this.setupPushListeners();
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === "prompt") {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== "granted") {
        console.warn("User denied push notification permissions.");
        return;
      }

      await PushNotifications.register();
    } catch (e) {
      console.warn("Could not register push notifications:", e);
    }
  }

  static async syncFcmToken(force = false) {
    const token = localStorage.getItem("fcm_token");
    if (token) {
      try {
        const lastSynced = localStorage.getItem(this.SYNCED_FCM_TOKEN_KEY);
        if (!force && lastSynced === token) return;
        await api.patch("/users/me", { fcmToken: token });
        localStorage.setItem(this.SYNCED_FCM_TOKEN_KEY, token);
        console.log(
          "[FCM] Successfully synced FCM token to backend after login.",
        );
      } catch (error) {
        console.error("[FCM] Failed to sync FCM token:", error);
      }
    } else {
      this.setupPushListeners();
      console.log(
        "[FCM] Token is null at sync. Re-registering push to force token emission.",
      );
      if (Capacitor.isNativePlatform()) {
        import("@capacitor/push-notifications").then(
          ({ PushNotifications }) => {
            PushNotifications.register().catch(() => {});
          },
        );
      }
    }
  }

  static async init() {
    if (!Capacitor.isNativePlatform() || this.isInitialized) return;
    this.isInitialized = true;

    // Request basic permissions safely without blocking initialization on failure
    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        await LocalNotifications.requestPermissions();
      }

      // Initialize Push Notifications
      await this.registerPushNotifications();
    } catch (permErr) {
      console.warn(
        "Could not check/request notification permissions:",
        permErr,
      );
    }

    // Create premium notification channels with defensive error handling
    try {
      await LocalNotifications.createChannel({
        id: "class_alerts",
        name: "Class Reminders",
        description: "Heads-up alerts before your class begins.",
        importance: 5,
        visibility: 1,
        lights: true,
        lightColor: "#6366F1",
        vibration: true,
      });

      await LocalNotifications.createChannel({
        id: "academic_briefings",
        name: "Academic Summaries",
        description:
          "Daily, weekly, and monthly briefing summaries and attendance reviews.",
        importance: 3,
        visibility: 1,
        lights: true,
        lightColor: "#3B82F6",
        vibration: false,
      });

      await LocalNotifications.createChannel({
        id: "assignment_alerts",
        name: "Assignment Deadlines",
        description: "Reminders for upcoming coursework and project deadlines.",
        importance: 4,
        visibility: 1,
        lights: true,
        lightColor: "#EF4444",
        vibration: true,
      });

      await LocalNotifications.createChannel({
        id: "system_alerts",
        name: "System Alerts",
        description: "Administrative warnings and device permission prompts.",
        importance: 4,
        visibility: 1,
        lights: true,
        lightColor: "#F59E0B",
        vibration: true,
      });
    } catch (e) {
      console.warn("Could not create notification channels:", e);
    }

    try {
      await LocalNotifications.registerActionTypes({
        types: [
          {
            id: "CLASS_SILENT_ACTIONS",
            actions: [
              {
                id: "UNMUTE_ACTION",
                title: "\uD83D\uDD0A Unmute Phone",
                foreground: false,
                destructive: false,
              },
            ],
          },
          {
            id: "CLASS_REMINDER_ACTIONS",
            actions: [
              {
                id: "MUTE_ACTION",
                title: "\uD83D\uDD15 Mute Phone for Class",
                foreground: false,
                destructive: false,
              },
            ],
          },
        ],
      });
    } catch (e) {
      console.warn("Could not register notification action types:", e);
    }

    // Reconcile ringer on startup
    await checkAndReconcileRinger(PINNED_MUTE_NOTIF_ID);

    // Reconcile ringer and synchronize notifications when app returns to foreground from background
    try {
      CapacitorApp.addListener("appStateChange", async ({ isActive }) => {
        if (isActive) {
          await checkAndReconcileRinger(PINNED_MUTE_NOTIF_ID);

          // If user was prompted to enable DND permission and returned, fulfill the pending mute request
          try {
            const pendingMuteRaw = localStorage.getItem(
              "attendx_pending_mute_request",
            );
            if (pendingMuteRaw) {
              const pendingMute = JSON.parse(pendingMuteRaw);
              if (pendingMute.endTimeMs && pendingMute.endTimeMs > Date.now()) {
                const { checkDndPermission, mutePhone } =
                  await import("../lib/ringer");
                const hasDnd = await checkDndPermission();
                if (hasDnd) {
                  localStorage.removeItem("attendx_pending_mute_request");
                  const muted = await mutePhone(
                    pendingMute.endTimeMs,
                    pendingMute.classTitle || "Class",
                  );
                  if (muted) {
                    await this.triggerPinnedClassMute(
                      pendingMute.classTitle || "Class",
                      new Date(pendingMute.endTimeMs),
                      true,
                    );
                    // Phone muted via pinned notification
                  }
                }
              } else {
                localStorage.removeItem("attendx_pending_mute_request");
              }
            }
          } catch (pendingErr) {
            console.warn(
              "Failed to process pending mute on app resume:",
              pendingErr,
            );
          }

          try {
            const perm = await LocalNotifications.checkPermissions();
            if (perm.display === "granted") {
              await this.registerPushNotifications();
              await this.syncFcmToken();
              const now = Date.now();
              if (now - this.lastResumeScheduleAt > 15 * 1000) {
                this.lastResumeScheduleAt = now;
                await this.scheduleAllProactiveNotifications();
              }
            }
          } catch {}
        }
      });
    } catch (e) {
      console.warn("Could not register appStateChange listener:", e);
    }

    if (typeof window !== "undefined") {
      window.addEventListener("focus", () => {
        checkAndReconcileRinger(PINNED_MUTE_NOTIF_ID).catch(() => {});
      });
    }

    const navigateInApp = (url: string) => {
      try {
        try {
          sessionStorage.setItem("pending_push_route", url);
        } catch {}
        window.dispatchEvent(new CustomEvent("push_route", { detail: url }));
        if (window.location.pathname !== url) {
          window.history.pushState(null, "", url);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }
      } catch {
        window.location.href = url;
      }
    };

    // Listen for unmute/mute actions and notification body taps
    try {
      LocalNotifications.addListener(
        "localNotificationActionPerformed",
        async (action) => {
          try {
            // Tap on the notification body itself
            if (
              action.actionId === "tap" ||
              action.actionId === "ACADEMIC_UPDATE_OPEN"
            ) {
              const extra = action.notification.extra;
              if (
                Number(action.notification.id) ===
                  PERMISSION_WARNING_NOTIF_ID ||
                (extra && extra.type === "dnd_permission")
              ) {
                navigateInApp("/settings");
                await requestDndPermission();
                return;
              }
              if (extra && (extra.type === "ota_update" || extra.type === "native_update" || extra.type === "app_update" || extra.type === "update")) {
                if (nativeUpdater.isAvailable()) {
                  window.dispatchEvent(new CustomEvent("open-update-sheet"));
                }
                return;
              }
              if (extra && (extra.route || extra.url)) {
                navigateInApp(extra.route || extra.url);
                return;
              }
              const id = Number(action.notification.id);
              // Daily Academic Briefings (8800..8809) -> Today schedule; Weekly/Monthly (8810..8899) -> Reports
              if (id >= ACADEMIC_UPDATES_START_ID && id <= 8809) {
                navigateInApp("/today");
                return;
              }
              if (id >= 8810 && id <= ACADEMIC_UPDATES_END_ID) {
                navigateInApp("/report");
                return;
              }
              // Assignment series (9000..69999)
              if (
                id >= ASSIGNMENT_REMINDERS_START_ID &&
                id <= ASSIGNMENT_REMINDERS_END_ID
              ) {
                navigateInApp("/assignments");
                return;
              }
              // Timetable classes & events
              if (isManagedTimetableNotificationId(id)) {
                navigateInApp("/today");
                return;
              }
            }

            if (action.actionId === "UNMUTE_ACTION") {
              const success = await unmutePhone();
              if (success) {
                await LocalNotifications.cancel({
                  notifications: [{ id: PINNED_MUTE_NOTIF_ID }, { id: 8888 }],
                });
                try {
                  // @ts-ignore
                  if (
                    typeof LocalNotifications.removeDeliveredNotifications ===
                    "function"
                  ) {
                    await LocalNotifications.removeDeliveredNotifications({
                      notifications: [
                        { id: PINNED_MUTE_NOTIF_ID },
                        { id: 8888 },
                      ] as any,
                    });
                  }
                } catch {}
                // Pinned notification dismissed; no web toast needed
              }
            } else if (action.actionId === "MUTE_ACTION") {
              let rawExtra = action.notification.extra;
              if (typeof rawExtra === "string") {
                try {
                  rawExtra = JSON.parse(rawExtra);
                } catch {}
              }
              const { classTitle, endTimeStr, startTimeStr, endTimeMs } =
                rawExtra || {};

              let endTime = new Date();
              let classEnded = false;

              if (
                endTimeMs &&
                typeof endTimeMs === "number" &&
                !isNaN(endTimeMs) &&
                endTimeMs > 0
              ) {
                endTime = new Date(endTimeMs);
                if (endTime.getTime() <= Date.now()) {
                  classEnded = true;
                }
              } else if (endTimeStr) {
                const parsedEnd = parseTimeOnDate(new Date(), endTimeStr);
                if (parsedEnd) {
                  endTime = parsedEnd;
                  // Check if class crossed midnight (e.g. start 23:00, end 01:00)
                  let crossesMidnight = false;
                  if (startTimeStr) {
                    const parsedStart = parseTimeOnDate(
                      new Date(),
                      startTimeStr,
                    );
                    if (
                      parsedStart &&
                      parsedStart.getTime() > parsedEnd.getTime()
                    ) {
                      crossesMidnight = true;
                    }
                  }
                  if (crossesMidnight) {
                    if (endTime.getTime() < Date.now())
                      endTime = addDays(endTime, 1);
                  } else if (endTime.getTime() <= Date.now()) {
                    classEnded = true;
                  }
                } else {
                  endTime = addMinutes(new Date(), 60);
                }
              } else {
                endTime = addMinutes(new Date(), 60);
              }

              if (classEnded) {
                // Class already ended; dismiss notification silently
                try {
                  await LocalNotifications.cancel({
                    notifications: [{ id: Number(action.notification.id) }],
                  });
                  // @ts-ignore
                  if (
                    typeof LocalNotifications.removeDeliveredNotifications ===
                    "function"
                  ) {
                    await LocalNotifications.removeDeliveredNotifications({
                      notifications: [action.notification as any],
                    });
                  }
                } catch {}
                return;
              }

              // Try muting with scheduled unmute epoch
              const success = await mutePhone(
                endTime.getTime(),
                classTitle || "Class",
              );
              if (!success) {
                // Store pending request so as soon as user grants DND in Settings and returns, it automatically mutes!
                localStorage.setItem(
                  "attendx_pending_mute_request",
                  JSON.stringify({
                    classTitle: classTitle || "Class",
                    endTimeMs: endTime.getTime(),
                    endTimeStr,
                    startTimeStr,
                  }),
                );
                toast.error(
                  "DND Permission required. Please enable Do Not Disturb access in Settings.",
                );
                return;
              }
              localStorage.removeItem("attendx_pending_mute_request");

              // Pinned notification triggered below; no duplicate web toast needed
              await this.triggerPinnedClassMute(
                classTitle || "Class",
                endTime,
                true,
              );
            }
          } catch (actionErr) {
            console.error("Error processing notification action:", actionErr);
          }
        },
      );
    } catch (e) {
      console.warn(
        "Could not register localNotificationActionPerformed listener:",
        e,
      );
    }

    // Sweep for any stuck DND notifications from previous sessions
    try {
      const delivered = await LocalNotifications.getDeliveredNotifications();
      const stuckMute = delivered.notifications.find(
        (n) => Number(n.id) === PINNED_MUTE_NOTIF_ID || Number(n.id) === 8888,
      );
      if (stuckMute) {
        await checkAndReconcileRinger(PINNED_MUTE_NOTIF_ID);
        try {
          // @ts-ignore
          if (LocalNotifications.removeDeliveredNotifications) {
            await LocalNotifications.removeDeliveredNotifications({
              notifications: [stuckMute],
            });
          }
        } catch (e) {}
      }
    } catch (e) {
      console.warn("Failed to clear stuck notifications", e);
    }
  }

  static async scheduleClassReminder(
    classTitle: string,
    actualStartTime: Date,
    notifyTime: Date,
    location?: string,
    endTimeStr?: string,
    slotId: string = "slot",
    type: "standard" | "headsup" = "standard",
  ) {
    if (!Capacitor.isNativePlatform()) return;
    if (isNaN(actualStartTime.getTime()) || isNaN(notifyTime.getTime())) return;
    if (notifyTime.getTime() <= Date.now()) return;

    try {
      const cleanTitle = (classTitle || "Class").trim();
      const scheduledDate = formatLocalDate(actualStartTime);
      const rawStartTimeStr = `${String(actualStartTime.getHours()).padStart(2, "0")}:${String(actualStartTime.getMinutes()).padStart(2, "0")}`;
      const timeStr = actualStartTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const notifId = getNotificationIdForSlot(
        slotId,
        scheduledDate,
        type,
      );
      let endObj = endTimeStr
        ? parseTimeOnDate(actualStartTime, endTimeStr)
        : null;
      if (endObj && endObj.getTime() <= actualStartTime.getTime()) {
        endObj = addDays(endObj, 1);
      }
      const calculatedEndMs = endObj
        ? endObj.getTime()
        : actualStartTime.getTime() + 60 * 60 * 1000;

      const reminderTitle =
        type === "headsup"
          ? `Upcoming (Heads Up): ${cleanTitle}`
          : `Upcoming: ${cleanTitle}`;
      const reminderBody = `Starts at ${timeStr} ${location ? `| ${location.trim()}` : ""}`;
      const reminderLargeBody =
        type === "headsup"
          ? `\uD83D\uDCDA Class: ${cleanTitle}\n\u23F0 Time: ${timeStr} - ${endTimeStr || "TBD"}\n\uD83D\uDCCD Room: ${location ? location.trim() : "N/A"}\n\nHeads up: Your upcoming class starts soon. Tap below to mute your phone without opening AttendX.`
          : `\uD83D\uDCDA Class: ${cleanTitle}\n\u23F0 Time: ${timeStr} - ${endTimeStr || "TBD"}\n\uD83D\uDCCD Room: ${location ? location.trim() : "N/A"}\n\nTap the action button below to silently mute your phone for this class without opening AttendX.`;

      // On Android, schedule via native BroadcastReceiver AlarmManager so tapping Mute or
      // engaging Auto-DND (when DND access is granted) NEVER opens the app.
      if (Capacitor.getPlatform() === "android") {
        let autoDndEnabled = true;
        try {
          const pref = localStorage.getItem("attendx_auto_dnd_if_granted");
          if (pref === "false") autoDndEnabled = false;
        } catch {}

        const { scheduleNativeClassReminder } = await import("../lib/ringer");
        const okNative = await scheduleNativeClassReminder({
          id: notifId,
          title: reminderTitle,
          body: reminderBody,
          largeBody: reminderLargeBody,
          summaryText: "Class Reminder",
          className: cleanTitle,
          triggerAtMs: notifyTime.getTime(),
          endTimeMs: calculatedEndMs,
          autoDndIfPermitted: type !== "headsup" && autoDndEnabled,
        });
        if (okNative) return;
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title: reminderTitle,
            body: reminderBody,
            largeBody: reminderLargeBody,
            summaryText: "Class Reminder",
            smallIcon: "ic_stat_attendx",
            largeIcon: "attendx_notification_icon",
            iconColor: "#6366F1",
            channelId: "class_alerts",
            foreground: true,
            actionTypeId: "CLASS_REMINDER_ACTIONS",
            extra: {
              classTitle: cleanTitle,
              endTimeStr,
              startTimeStr: rawStartTimeStr,
              endTimeMs: calculatedEndMs,
              scheduledDate,
            },
            schedule: {
              at: notifyTime,
              allowWhileIdle: true,
            },
          },
        ],
      });
    } catch (e) {
      console.warn("Failed to schedule class reminder:", e);
    }
  }

  static async triggerPinnedClassMute(
    className: string,
    endTime: Date,
    alreadyMuted: boolean = false,
  ) {
    if (isNaN(endTime.getTime())) return;
    setScheduledUnmuteTime(endTime.getTime());
    if (!Capacitor.isNativePlatform()) return;

    try {
      const cleanClassName = (className || "Class").trim();

      if (!alreadyMuted) {
        const ok = await mutePhone(endTime.getTime(), cleanClassName);
        if (!ok) return;
      }

      if (this.unmuteTimeoutId) {
        clearTimeout(this.unmuteTimeoutId);
        this.unmuteTimeoutId = null;
      }

      const timeUntilEnd = Math.min(
        Math.max(0, endTime.getTime() - Date.now()),
        2147483647,
      );
      if (timeUntilEnd > 0) {
        this.unmuteTimeoutId = setTimeout(async () => {
          this.unmuteTimeoutId = null;
          await checkAndReconcileRinger(PINNED_MUTE_NOTIF_ID);
        }, timeUntilEnd);
      }
    } catch (e) {
      console.warn("Failed to trigger pinned class mute notification:", e);
    }
  }

  static async scheduleHolidayNotification(
    holidayName: string | undefined,
    date: Date,
    customMessage: string = "No classes scheduled! Enjoy your day off.",
  ) {
    if (!Capacitor.isNativePlatform()) return;
    let targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) return;
    if (targetDate.getHours() === 0 && targetDate.getMinutes() === 0) {
      targetDate.setHours(8, 0, 0, 0);
    }
    if (targetDate.getTime() <= Date.now()) return;

    try {
      const cleanHolidayName = (holidayName || "Holiday").trim();
      const notifId = getHolidayNotificationId(formatLocalDate(targetDate));

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title: cleanHolidayName.toLowerCase().includes("holiday")
              ? "Holiday Today: " + cleanHolidayName
              : "Event Today: " + cleanHolidayName,
            body: customMessage,
            largeBody: "\u2728 " + cleanHolidayName + "\n\n" + customMessage,
            summaryText: "Holiday Event",
            smallIcon: "ic_stat_attendx",
            largeIcon: "attendx_notification_icon",
            iconColor: "#10B981",
            channelId: "class_alerts",
            schedule: { at: targetDate, allowWhileIdle: true },
          },
        ],
      });
    } catch (e) {
      console.warn("Failed to schedule holiday notification:", e);
    }
  }

  static async scheduleBirthdayNotification(name: string, date: Date) {
    if (!Capacitor.isNativePlatform()) return;
    let targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) return;
    if (targetDate.getHours() === 0 && targetDate.getMinutes() === 0) {
      targetDate.setHours(9, 0, 0, 0);
    }
    if (targetDate.getTime() <= Date.now()) return;

    try {
      let cleanName = (name || "Friend").trim();
      cleanName = cleanName
        .replace(/^(?:happy\s+)?birthday\s+of\s+/i, "")
        .replace(/^(?:happy\s+)?birthday\s+/i, "")
        .replace(/(?:'s|s)?\s*birthday.*$/i, "")
        .replace(/^(?:of\s+)/i, "")
        .trim();
      if (!cleanName) cleanName = "Friend";

      const notifId = getBirthdayNotificationId(
        cleanName,
        formatLocalDate(targetDate),
      );

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title: "Happy Birthday!",
            body: `Wish ${cleanName} a great birthday today!`,
            largeBody: `\uD83C\uDF82 It's ${cleanName}'s birthday today!\n\nDon't forget to send them your best wishes and make their day special!`,
            summaryText: "Birthday Event",
            smallIcon: "ic_stat_attendx",
            largeIcon: "attendx_notification_icon",
            iconColor: "#F59E0B",
            channelId: "class_alerts",
            schedule: { at: targetDate, allowWhileIdle: true },
          },
        ],
      });
    } catch (e) {
      console.warn("Failed to schedule birthday notification:", e);
    }
  }

  private static mapServerEvents(rawEvents: any[]): any[] {
    if (!Array.isArray(rawEvents)) return [];
    return rawEvents.map((ev: any) => ({
      id: ev.id,
      title: ev.title || "Event",
      type: ev.eventType || "academic",
      eventType: ev.eventType || "academic",
      date: ev.date ? ev.date.split("T")[0] + "T00:00:00" : "",
      endDate: ev.endDate ? ev.endDate.split("T")[0] + "T00:00:00" : undefined,
      description: ev.description,
    }));
  }

  private static normalizeTimetableSlots(raw: any): any[] {
    const arr = Array.isArray(raw) ? raw : raw?.slots || [];
    if (!Array.isArray(arr)) return [];
    return arr.map((s: any) => ({
      ...s,
      startTime:
        typeof s.startTime === "string" ? s.startTime.slice(0, 5) : s.startTime,
      endTime:
        typeof s.endTime === "string" ? s.endTime.slice(0, 5) : s.endTime,
    }));
  }

  private static async syncProactiveNotificationSources(
    force: boolean = false,
  ): Promise<void> {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const authState = useAuthStore.getState();
    if (!authState.isAuthenticated && !authState.accessToken) return;

    const now = Date.now();
    if (!force && this.lastProactiveSyncAt > 0 && now - this.lastProactiveSyncAt < 30_000) {
      return;
    }
    if (this.inFlightProactiveSync && !force) {
      return this.inFlightProactiveSync;
    }

    const runSync = (async () => {
      try {
        this.lastProactiveSyncAt = Date.now();

        const [semSettled, assignSettled] = await Promise.allSettled([
          api.get("/semesters/active"),
          api.get("/assignments"),
        ]);

        if (
          assignSettled.status === "fulfilled" &&
          Array.isArray(assignSettled.value?.data)
        ) {
          useAssignmentStore
            .getState()
            .mergeFetchedAssignments(assignSettled.value.data);
        }

        const cachedSem =
          useCacheStore.getState().semester?.activeSemester ||
          useCacheStore.getState().timetable?.activeSemester ||
          null;
        const activeSem =
          semSettled.status === "fulfilled" && semSettled.value?.data?.id
            ? semSettled.value.data
            : cachedSem;

        if (!activeSem?.id) return;

        useAttendanceStore.setState({
          activeSemesterId: activeSem.id,
          hasActiveSemester: true,
        });
        const existingSemCache = useCacheStore.getState().semester || {};
        useCacheStore.getState().setCache("semester", {
          ...existingSemCache,
          activeSemester: activeSem,
        });

        const todayIso = formatLocalDate(new Date());
        const tomorrowIso = formatLocalDate(addDays(new Date(), 1));
        const shouldRefreshStats =
          force ||
          useAttendanceStore.getState().subjects.length === 0 ||
          Date.now() - this.lastStatsSyncAt > 60_000;
        const todayCacheEntry = useCacheStore.getState().today?.[todayIso];
        const tomorrowCacheEntry = useCacheStore.getState().today?.[tomorrowIso];
        const needsTodayAgenda =
          force ||
          !todayCacheEntry?.agenda ||
          Date.now() - Number(todayCacheEntry?.syncedAt || 0) > 180_000;
        const needsTomorrowAgenda =
          force ||
          !tomorrowCacheEntry?.agenda ||
          Date.now() - Number(tomorrowCacheEntry?.syncedAt || 0) > 300_000;

        const [ttSettled, evSettled, statsSettled, todaySettled, tomorrowSettled] = await Promise.allSettled([
          api.get(`/timetable/${activeSem.id}`),
          api.get(`/events?semesterId=${activeSem.id}`),
          shouldRefreshStats
            ? api.get(`/attendance/stats?semesterId=${activeSem.id}`)
            : Promise.resolve(null),
          needsTodayAgenda
            ? api.get(`/attendance/today?date=${todayIso}`)
            : Promise.resolve(null),
          needsTomorrowAgenda
            ? api.get(`/attendance/today?date=${tomorrowIso}`)
            : Promise.resolve(null),
        ]);

        const pendingQueue = useOfflineStore.getState().queue;
        const hasPendingTimetable = pendingQueue.some((q) =>
          q.url.includes("/timetable")
        );
        const hasPendingEvents = pendingQueue.some((q) =>
          q.url.includes("/events")
        );
        const hasPendingAttendanceOrSubjects = pendingQueue.some(
          (q) => q.url.includes("/attendance") || q.url.includes("/subjects")
        );

        if (
          !hasPendingTimetable &&
          ttSettled.status === "fulfilled" &&
          ttSettled.value?.data
        ) {
          const slots = this.normalizeTimetableSlots(ttSettled.value.data);
          const existingTt = useCacheStore.getState().timetable || {};
          useCacheStore.getState().setCache("timetable", {
            ...existingTt,
            activeSemester: activeSem,
            slots,
          });
        }

        if (
          !hasPendingEvents &&
          evSettled.status === "fulfilled" &&
          Array.isArray(evSettled.value?.data)
        ) {
          const mappedEvents = this.mapServerEvents(evSettled.value.data);
          useAttendanceStore.setState({ events: mappedEvents });
          const curSemCache = useCacheStore.getState().semester || {};
          useCacheStore.getState().setCache("semester", {
            ...curSemCache,
            activeSemester: activeSem,
            events: evSettled.value.data,
          });
        }

        if (
          !hasPendingAttendanceOrSubjects &&
          statsSettled.status === "fulfilled" &&
          statsSettled.value?.data
        ) {
          const rawStats = Array.isArray(statsSettled.value.data)
            ? statsSettled.value.data
            : statsSettled.value.data?.subjects || [];
          if (Array.isArray(rawStats) && rawStats.length > 0) {
            this.lastStatsSyncAt = Date.now();
            const curSubCache = useCacheStore.getState().subjects || {};
            useCacheStore.getState().setCache("subjects", {
              ...curSubCache,
              stats: rawStats,
              activeSemesterId: activeSem.id,
            });
          }
        }
        if (!hasPendingAttendanceOrSubjects) {
          const curTodayCache = { ...(useCacheStore.getState().today || {}) };
          let updatedTodayCache = false;
          const applyFetchedAgenda = (iso: string, settledRes: PromiseSettledResult<any>) => {
            if (settledRes.status !== "fulfilled" || !settledRes.value?.data) return;
            const raw = settledRes.value.data;
            const agendaList = Array.isArray(raw) ? raw : Array.isArray(raw?.agenda) ? raw.agenda : null;
            if (!agendaList) return;
            curTodayCache[iso] = {
              ...(curTodayCache[iso] || {}),
              agenda: agendaList,
              activeSemester: activeSem,
              syncedAt: Date.now(),
            };
            updatedTodayCache = true;
          };
          applyFetchedAgenda(todayIso, todaySettled);
          applyFetchedAgenda(tomorrowIso, tomorrowSettled);
          if (updatedTodayCache) {
            useCacheStore.getState().setCache("today", curTodayCache);
          }
        }
      } catch (e) {
        console.warn("NotificationService: proactive source sync failed:", e);
      }
    })();

    this.inFlightProactiveSync = runSync;
    try {
      await runSync;
    } finally {
      if (this.inFlightProactiveSync === runSync) {
        this.inFlightProactiveSync = null;
      }
    }
  }

  /**
   * Proactively checks permissions, onboarding/semester state, timetable slots,
   * events, subjects, assignments, and summary preferences, and schedules ALL
   * notifications without waiting for the user to open any specific page.
   */
  static async scheduleAllProactiveNotifications(
    force: boolean = false,
  ): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      await this.waitForStoreHydration(2000);

      // 1. Prior check: Check notification permissions
      const perm = await this.checkPermissions();
      if (perm !== "granted") {
        return;
      }

      // 2. Sync fresh semester, timetable, events, subject stats, and assignments when online
      await this.syncProactiveNotificationSources(force);

      // 3. Schedule Timetable Classes, Holidays, Birthdays, Campus Events & EOD Summaries
      await this.autoScheduleFromTimetable();

      // 4. Schedule All Academic Summaries (Daily, Weekly, Monthly)
      const activeFreq = useCacheStore.getState().reminderFrequency || {
        type: "Daily",
      };
      await this.scheduleAcademicUpdates(activeFreq);

      // 5. Schedule Assignment Reminders
      await this.scheduleAssignmentReminders();
    } catch (e) {
      console.warn(
        "NotificationService: scheduleAllProactiveNotifications error:",
        e,
      );
    }
  }

  static async autoScheduleFromTimetable(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    if (this.isSchedulingTimetable) {
      this.hasQueuedTimetableRun = true;
      return;
    }

    this.isSchedulingTimetable = true;
    try {
      do {
        this.hasQueuedTimetableRun = false;
        await this._executeAutoScheduleFromTimetable();
      } while (this.hasQueuedTimetableRun);
    } finally {
      this.isSchedulingTimetable = false;
      this.hasQueuedTimetableRun = false;
    }
  }

  private static async _executeAutoScheduleFromTimetable(): Promise<void> {
    try {
      await this.waitForStoreHydration(2000);
      let activeSemester =
        useCacheStore.getState().semester?.activeSemester ||
        useCacheStore.getState().timetable?.activeSemester ||
        null;
      let activeSemesterId =
        useAttendanceStore.getState().activeSemesterId ||
        activeSemester?.id ||
        null;
      if (!activeSemesterId || !activeSemester) {
        try {
          const semRes = await api.get("/semesters/active");
          if (semRes.data?.id) {
            activeSemester = semRes.data;
            activeSemesterId = semRes.data.id;
            useAttendanceStore.setState({
              activeSemesterId: semRes.data.id,
              hasActiveSemester: true,
            });
            const curSem = useCacheStore.getState().semester || {};
            useCacheStore.getState().setCache("semester", {
              ...curSem,
              activeSemester: semRes.data,
            });
          }
        } catch (e) {
          console.warn(
            "NotificationService: could not fetch active semester",
            e,
          );
        }
      }
      if (!activeSemesterId) return;

      console.log(
        "Auto-scheduling local notifications for upcoming classes and events...",
      );

      let rawSlots: any = useCacheStore.getState().timetable?.slots;
      let events = useAttendanceStore.getState().events || [];

      // Concurrently fetch slots and events if missing in memory so neither blocks the other
      const prefetchTasks: Promise<any>[] = [];
      if (!rawSlots || rawSlots.length === 0) {
        prefetchTasks.push(
          api
            .get(`/timetable/${activeSemesterId}`)
            .then((res) => {
              const slotsArr = this.normalizeTimetableSlots(res.data);
              rawSlots = slotsArr;
              if (slotsArr.length > 0) {
                const existingTt = useCacheStore.getState().timetable || {};
                useCacheStore.getState().setCache("timetable", {
                  ...existingTt,
                  ...(activeSemester ? { activeSemester } : {}),
                  slots: slotsArr,
                });
              }
            })
            .catch((e) =>
              console.warn("Failed to fetch timetable for auto-scheduling", e),
            ),
        );
      }
      if (events.length === 0) {
        prefetchTasks.push(
          api
            .get(`/events?semesterId=${activeSemesterId}`)
            .then((evRes) => {
              if (Array.isArray(evRes.data)) {
                events = this.mapServerEvents(evRes.data);
                useAttendanceStore.setState({ events });
              }
            })
            .catch(() => {}),
        );
      }

      if (prefetchTasks.length > 0) {
        await Promise.allSettled(prefetchTasks);
      }

      const allSlots: any[] = Array.isArray(rawSlots)
        ? rawSlots
        : rawSlots?.slots || [];
      const slots: any[] = allSlots.filter((s) => !s?.validUntil);
      const allEvents = [...events];
      const cutoffIso = getInstructionalCutoffIso(allEvents, activeSemester);

      // If both slots and events are completely empty, nothing to schedule
      if (slots.length === 0 && allEvents.length === 0) return;

      // Purge any previously scheduled native class reminders + LocalNotifications before re-syncing
      try {
        const { cancelAllNativeClassReminders } = await import("../lib/ringer");
        await cancelAllNativeClassReminders();
      } catch {}

      const pending = await LocalNotifications.getPending();
      const deterministicOffIds = new Set<number>();
      for (let d = 0; d < 7; d++) {
        const dayDate = addDays(startOfDay(new Date()), d);
        const dayIso = formatLocalDate(dayDate);
        const dayAgenda = useCacheStore.getState().today?.[dayIso]?.agenda;
        if (Array.isArray(dayAgenda)) {
          dayAgenda.forEach((item: any) => {
            const st = String(item?.status || "").toLowerCase();
            if (st === "off" || st === "cancelled") {
              const sid = String(item?.id || "");
              if (sid) {
                deterministicOffIds.add(getNotificationIdForSlot(sid, dayIso, "standard"));
                deterministicOffIds.add(getNotificationIdForSlot(sid, dayIso, "headsup"));
              }
            }
          });
        }
        deterministicOffIds.add(getNotificationIdForSlot("eod", dayIso, "endofday"));
      }
      slots.forEach((s) => {
        for (let d = 0; d < 7; d++) {
          const dayIso = formatLocalDate(addDays(startOfDay(new Date()), d));
          deterministicOffIds.add(getNotificationIdForSlot(String(s.id), dayIso, "standard"));
          deterministicOffIds.add(getNotificationIdForSlot(String(s.id), dayIso, "headsup"));
        }
      });

      const cancelIds = new Set<number>(
        pending.notifications
          .filter((n) => isManagedTimetableNotificationId(Number(n.id)))
          .map((n) => Number(n.id)),
      );
      deterministicOffIds.forEach((id) => cancelIds.add(id));
      if (cancelIds.size > 0) {
        await LocalNotifications.cancel({
          notifications: Array.from(cancelIds).map((id) => ({ id })),
        });
      }

      const today = startOfDay(new Date());
      let scheduledCount = 0;
      const notificationsToSchedule: any[] = [];

      const config = useNotificationStore.getState().config;
      const reminderOffset =
        config && typeof config.classReminderOffset === "number"
          ? config.classReminderOffset
          : 10;

      const eventHorizonDays = cutoffIso ? 30 : 14;
      for (let i = 0; i < eventHorizonDays; i++) {
        const currentDay = addDays(today, i);
        const currentIso = formatLocalDate(currentDay);
        const isPastCutoff = Boolean(cutoffIso && currentIso > cutoffIso);
        const isExtendedHorizon = i >= 14;

        // Note: Self Birthday notifications are dispatched as official FCM Push Notifications from the backend at 8:00 AM IST.
        // Local notification scheduling for Self Birthday is disabled to eliminate duplicate alerts.

        // Multi-day event support: check if currentDay falls anywhere within event date range
        const dayEvents = allEvents.filter((e) =>
          isEventActiveOnDate(e, currentDay),
        );

        let isClassOff = getOffDayEventForDate(allEvents, currentDay) !== null;
        let eventNotifIndex = 0;

        for (const e of dayEvents) {
          const lowerTitle = (e.title || "").toLowerCase();
          const typeLower = (e.type || e.eventType || "").toLowerCase();
          const isRestricted =
            typeLower === "restricted" ||
            typeLower === "restricted_holiday" ||
            lowerTitle.includes("restricted");
          const isExamEvent =
            !lowerTitle.includes("break") &&
            !lowerTitle.includes("vacation") &&
            (typeLower === "exam" ||
              typeLower === "midsem" ||
              typeLower === "endsem" ||
              /\b(midsem|mid[\s-]?sem|midterm|mid[\s-]?term|endsem|end[\s-]?sem|exam|viva|practical\s+test|assessment\s+test)\b/i.test(
                lowerTitle,
              ));
          const isBreakEvent =
            lowerTitle.includes("vacation") || lowerTitle.includes("break");
          const isHolidayEvent =
            !isRestricted &&
            (typeLower === "holiday" || lowerTitle.includes("holiday"));

          // Beyond 14 days, only schedule exam alerts (especially after Last Working Day)
          if (isExtendedHorizon && !isExamEvent) {
            continue;
          }

          // After Last Teaching Day, suppress generic class-cancelling holiday noise and prioritize exam alerts
          if (isPastCutoff && isClassOff && !isExamEvent && !isBreakEvent) {
            // Still allow major holidays & exams; skip unrelated past-cutoff clutter if non-essential
          }

          const eventCancelsClasses =
            isHolidayEvent || isExamEvent || isBreakEvent;
          let specialMessage = "You have an event today.";
          if (isExamEvent) {
            specialMessage = isPastCutoff
              ? "Regular classes have concluded. All the best for your exam today!"
              : "All the best for your exams!";
          } else if (isHolidayEvent) {
            specialMessage = "No classes scheduled! Enjoy your day off.";
          } else if (isRestricted) {
            specialMessage = "Restricted Holiday today.";
          } else if (isBreakEvent) {
            specialMessage = "Enjoy your vacation!";
          }

          if (eventCancelsClasses) isClassOff = true;

          // 1. Handle Birthdays (Exclude public holidays & official academic milestones)
          const isAcademicOtherMilestone =
            /\b(fee\s+payment|registration|fee\s+verification|answer[\s-]*sheets?|shortage|result\s+preparation|declaration|commencement|classes|teaching|convocation|orientation|induction|workshop|seminar|meeting|submission|feedback|enrollment|enrolment)\b/i.test(
              lowerTitle,
            );
          const isExplicitPeerBday =
            /\b(birthdays?|b'?days?|b-?days?|dob)\b|🎂/i.test(
              `${lowerTitle} ${String(e.description || "").toLowerCase()}`,
            ) ||
            (typeLower === "other" &&
              !e.isHolidayList &&
              !isHolidayEvent &&
              !isRestricted &&
              !(e as any).isHoliday &&
              !isAcademicOtherMilestone);
          if (
            isExplicitPeerBday &&
            !isHolidayEvent &&
            !isRestricted &&
            !(e as any).isHoliday &&
            !typeLower.includes("holiday") &&
            !isExtendedHorizon
          ) {
            const notifyTime = setHours(currentDay, 9);
            if (notifyTime.getTime() > Date.now()) {
              let cleanName = (e.title || "Friend").trim();
              cleanName = cleanName
                .replace(/^(?:happy\s+)?(?:birthday|b'?day)\s+of\s+/i, "")
                .replace(/^(?:happy\s+)?(?:birthday|b'?day)\s+/i, "")
                .replace(/(?:'s|s)?\s*(?:birthday|b'?day).*$/i, "")
                .replace(/^(?:of\s+)/i, "")
                .trim();
              if (!cleanName) cleanName = "Friend";
              const baseBdayId = getBirthdayNotificationId(
                cleanName,
                currentIso,
              );
              const notifId =
                BIRTHDAY_NOTIF_START_ID +
                (((baseBdayId - BIRTHDAY_NOTIF_START_ID) + eventNotifIndex) %
                  5000);
              notificationsToSchedule.push({
                id: notifId,
                title: "\ud83c\udf82 Happy Birthday!",
                body: `Wish ${cleanName} a great birthday today!`,
                largeBody: `\uD83C\uDF82 It's ${cleanName}'s birthday today!\n\nDon't forget to send them your best wishes and make their day special!`,
                summaryText: "Birthday Event",
                smallIcon: "ic_stat_attendx",
                largeIcon: "attendx_notification_icon",
                iconColor: "#F59E0B",
                channelId: "class_alerts",
                schedule: { at: notifyTime, allowWhileIdle: true },
              });
              scheduledCount++;
              eventNotifIndex++;
            }
            continue;
          }

          // 2. Exam & Event / Holiday Notifications (Exams never mislabeled as Holidays)
          const cleanHolidayName = (e.title || "Event").trim();
          const baseHolidayId = getHolidayNotificationId(currentIso);

          if (isExamEvent) {
            const morningExamTime = setMinutes(setHours(currentDay, 8), 0);
            if (morningExamTime.getTime() > Date.now()) {
              const examNotifId =
                HOLIDAY_NOTIF_START_ID +
                (((baseHolidayId - HOLIDAY_NOTIF_START_ID) + eventNotifIndex) %
                  5000);
              notificationsToSchedule.push({
                id: examNotifId,
                title: `\uD83D\uDCDD Exam Today: ${cleanHolidayName}`,
                body: specialMessage,
                largeBody: `\uD83D\uDCDD ${cleanHolidayName}\n\n${specialMessage}`,
                summaryText: "Exam Reminder",
                smallIcon: "ic_stat_attendx",
                largeIcon: "attendx_notification_icon",
                iconColor: "#F43F5E",
                channelId: "class_alerts",
                extra: {
                  type: "exam_reminder",
                  scheduledDate: currentIso,
                  route: "/semester/events",
                },
                schedule: { at: morningExamTime, allowWhileIdle: true },
              });
              scheduledCount++;
              eventNotifIndex++;
            }

            // Evening-before prep reminder at 7:00 PM on exam start day or post-teaching day period
            const isExamStartDay = isSameDay(parseLocalDate(e.date), currentDay);
            if ((isPastCutoff || isExamStartDay) && i > 0) {
              const eveTime = setMinutes(setHours(addDays(currentDay, -1), 19), 0);
              if (eveTime.getTime() > Date.now()) {
                const eveId =
                  HOLIDAY_NOTIF_START_ID +
                  (((baseHolidayId - HOLIDAY_NOTIF_START_ID) + 2500 + eventNotifIndex) %
                    5000);
                notificationsToSchedule.push({
                  id: eveId,
                  title: `\uD83D\uDCDD Exam Tomorrow: ${cleanHolidayName}`,
                  body: "Classes are off — review notes, admit details, and get a good rest tonight.",
                  largeBody: `\uD83D\uDCDD Upcoming Exam Tomorrow\n\n${cleanHolidayName} starts tomorrow (${currentIso}). Best of luck!`,
                  summaryText: "Exam Prep Reminder",
                  smallIcon: "ic_stat_attendx",
                  largeIcon: "attendx_notification_icon",
                  iconColor: "#F59E0B",
                  channelId: "class_alerts",
                  extra: {
                    type: "exam_eve_reminder",
                    scheduledDate: currentIso,
                    route: "/semester/events",
                  },
                  schedule: { at: eveTime, allowWhileIdle: true },
                });
                scheduledCount++;
                eventNotifIndex++;
              }
            }
            continue;
          }

          const notifyTime = setHours(currentDay, 8);
          if (notifyTime.getTime() > Date.now()) {
            const notifId =
              HOLIDAY_NOTIF_START_ID +
              (((baseHolidayId - HOLIDAY_NOTIF_START_ID) + eventNotifIndex) %
                5000);
            notificationsToSchedule.push({
              id: notifId,
              title:
                isHolidayEvent || isBreakEvent
                  ? "\ud83c\udf89 Holiday: " + cleanHolidayName
                  : "\ud83d\udcc6 Event: " + cleanHolidayName,
              body: specialMessage,
              largeBody: "\u2728 " + cleanHolidayName + "\n\n" + specialMessage,
              summaryText: isHolidayEvent || isBreakEvent
                ? "Holiday Event"
                : "Calendar Event",
              smallIcon: "ic_stat_attendx",
              largeIcon: "attendx_notification_icon",
              iconColor: isHolidayEvent || isBreakEvent ? "#10B981" : "#3B82F6",
              channelId: "class_alerts",
              extra: {
                type: "calendar_event",
                scheduledDate: currentIso,
                route: "/semester/events",
              },
              schedule: { at: notifyTime, allowWhileIdle: true },
            });
            scheduledCount++;
            eventNotifIndex++;
          }
        }

        if (isClassOff || isPastCutoff || i >= 7 || slots.length === 0) {
          continue;
        }

        let dbDay = currentDay.getDay() - 1;
        if (dbDay === -1) dbDay = 6;

        const daySlots = slots.filter((s) => s.dayOfWeek === dbDay);

        // Merge date-specific Extra Classes & Cancelled/OFF overrides when cached (TodayPage / Widget / Offline)
        const cachedAgenda = useCacheStore.getState().today?.[currentIso]?.agenda;
        const agendaList: any[] = Array.isArray(cachedAgenda) ? cachedAgenda : [];
        const offItems = agendaList.filter((item) => {
          const st = String(item?.status || "").toLowerCase();
          return st === "off" || st === "cancelled";
        });
        const offOrCancelledIds = new Set(offItems.map((item) => String(item.id)));
        const offOrCancelledKeys = new Set(
          offItems.map(
            (item) =>
              `${item?.subject?.id || ""}_${String(item?.startTime || "").slice(0, 5)}`,
          ),
        );
        const isSlotMarkedOff = (s: any) =>
          offOrCancelledIds.has(String(s.id)) ||
          offOrCancelledKeys.has(
            `${s?.subjectId || s?.subject?.id || ""}_${String(s?.startTime || "").slice(0, 5)}`,
          );
        const extraDaySlots = agendaList
          .filter((item) => {
            const isExtraItem = Boolean(
              item?.isExtra ||
                item?.overrideType === "extra_class" ||
                item?.type === "override",
            );
            const st = String(item?.status || "").toLowerCase();
            return (
              isExtraItem &&
              st !== "off" &&
              st !== "cancelled" &&
              item?.startTime &&
              !daySlots.some((s) => String(s.id) === String(item.id))
            );
          })
          .map((item) => ({
            id: item.id,
            subject: item.subject,
            startTime: String(item.startTime).slice(0, 5),
            endTime: item.endTime ? String(item.endTime).slice(0, 5) : undefined,
            room: item.room,
            isExtra: true,
          }));

        const activeDaySlots = [
          ...daySlots.filter((s) => !isSlotMarkedOff(s)),
          ...extraDaySlots,
        ].sort((a, b) =>
          String(a.startTime || "").localeCompare(String(b.startTime || "")),
        );

        let maxEndTimeObj: Date | null = null;
        let maxScheduledReminderMs = 0;

        for (let j = 0; j < activeDaySlots.length; j++) {
          const slot = activeDaySlots[j];
          const prevSlot = j > 0 ? activeDaySlots[j - 1] : null;

          const subjectName = (
            slot.subject?.name ||
            slot.subject?.code ||
            "Class"
          ).trim();
          const startTimeStr = slot.startTime;
          const endTimeStr = slot.endTime;
          const slotId = slot.id || `slot_${dbDay}_${j}`;

          const classStartObj = parseTimeOnDate(currentDay, startTimeStr);
          if (!classStartObj) continue;

          const standardNotifyTime = addMinutes(classStartObj, -reminderOffset);
          let headsUpTime: Date | null = null;

          if (config?.notifyNextClassOnEnd && prevSlot && prevSlot.endTime) {
            const prevEndObj = parseTimeOnDate(currentDay, prevSlot.endTime);
            if (prevEndObj) {
              // Fire heads-up when the previous class ends, provided it ends before the standard notification time
              if (
                prevEndObj.getTime() <=
                standardNotifyTime.getTime() - 5 * 60 * 1000
              ) {
                headsUpTime = prevEndObj;
              }
            }
          }

          const timeStr = classStartObj.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          const roomStr =
            config?.showLocation && slot.room ? slot.room.trim() : "";
          let classEndObj = endTimeStr
            ? parseTimeOnDate(currentDay, endTimeStr)
            : null;
          if (
            classEndObj &&
            classEndObj.getTime() <= classStartObj.getTime()
          ) {
            classEndObj = addDays(classEndObj, 1);
          }
          const resolvedEndObj = classEndObj || addMinutes(classStartObj, 60);
          const calculatedEndMs = resolvedEndObj.getTime();
          if (reminderOffset > -1) {
            if (headsUpTime && headsUpTime.getTime() > Date.now()) {
              maxScheduledReminderMs = Math.max(maxScheduledReminderMs, headsUpTime.getTime());
              const headsUpId = getNotificationIdForSlot(
                slotId,
                currentIso,
                "headsup",
              );
              notificationsToSchedule.push({
                id: headsUpId,
                title: `Upcoming (Heads Up): ${subjectName}`,
                body: `Starts at ${timeStr} ${roomStr ? `| ${roomStr}` : ""}`,
                largeBody: `\uD83D\uDCDA Class: ${subjectName}\n\u23F0 Time: ${timeStr} - ${endTimeStr || "TBD"}\n\uD83D\uDCCD Room: ${roomStr || "N/A"}\n\nHeads up: Your upcoming class starts soon. Tap below to mute your phone for this class.`,
                summaryText: "Class Reminder",
                smallIcon: "ic_stat_attendx",
                largeIcon: "attendx_notification_icon",
                iconColor: "#6366F1",
                channelId: "class_alerts",
                foreground: true,
                actionTypeId: "CLASS_REMINDER_ACTIONS",
                extra: {
                  classTitle: subjectName,
                  endTimeStr,
                  startTimeStr,
                  endTimeMs: calculatedEndMs,
                  scheduledDate: currentIso,
                },
                schedule: { at: headsUpTime, allowWhileIdle: true },
              });
              scheduledCount++;
            }

            if (standardNotifyTime.getTime() > Date.now()) {
              maxScheduledReminderMs = Math.max(maxScheduledReminderMs, standardNotifyTime.getTime());
              const standardId = getNotificationIdForSlot(
                slotId,
                currentIso,
                "standard",
              );
              notificationsToSchedule.push({
                id: standardId,
                title: `Upcoming: ${subjectName}`,
                body: `Starts at ${timeStr} ${roomStr ? `| ${roomStr}` : ""}`,
                largeBody: `\uD83D\uDCDA Class: ${subjectName}\n\u23F0 Time: ${timeStr} - ${endTimeStr || "TBD"}\n\uD83D\uDCCD Room: ${roomStr || "N/A"}\n\nTap the action button below to instantly mute your phone for the duration of this class.`,
                summaryText: "Class Reminder",
                smallIcon: "ic_stat_attendx",
                largeIcon: "attendx_notification_icon",
                iconColor: "#6366F1",
                channelId: "class_alerts",
                foreground: true,
                actionTypeId: "CLASS_REMINDER_ACTIONS",
                extra: {
                  classTitle: subjectName,
                  endTimeStr,
                  startTimeStr,
                  endTimeMs: calculatedEndMs,
                  scheduledDate: currentIso,
                },
                schedule: { at: standardNotifyTime, allowWhileIdle: true },
              });
              scheduledCount++;
            }
          }

          if (!maxEndTimeObj || resolvedEndObj > maxEndTimeObj) {
            maxEndTimeObj = resolvedEndObj;
          }
        }

        if (config?.endOfDaySummary && maxEndTimeObj && activeDaySlots.length > 0) {
          if (
            maxEndTimeObj.getTime() > Date.now() &&
            maxEndTimeObj.getTime() >= maxScheduledReminderMs
          ) {
            let endOfDayTitle = "Done for the day!";
            let endOfDayBody = "All classes have ended. Enjoy your evening!";
            let endOfDayLargeBody =
              "\uD83C\uDF19 All classes for today have concluded. You can pack up and enjoy the rest of your day. See you tomorrow!";

            const tomorrow = addDays(currentDay, 1);
            const tomorrowIso = formatLocalDate(tomorrow);
            const tomorrowPastCutoff = Boolean(cutoffIso && tomorrowIso > cutoffIso);
            const tomorrowOff = getOffDayEventForDate(allEvents, tomorrow);

            const getSlotsForDay = (d: Date) => {
              let dDay = d.getDay() - 1;
              if (dDay === -1) dDay = 6;
              return slots.filter((s) => s.dayOfWeek === dDay);
            };

            const tomorrowSlots = getSlotsForDay(tomorrow);
            const tomorrowIsOff =
              tomorrowPastCutoff ||
              tomorrowOff !== null ||
              tomorrowSlots.length === 0;

            if (tomorrowPastCutoff && cutoffIso === currentIso) {
              endOfDayLargeBody = "\uD83C\uDF93 Teaching classes for this semester have concluded! Wishing you the very best for your upcoming exams.";
              endOfDayBody = "Teaching classes concluded for this semester. Best of luck for your exams!";
            } else if (tomorrowOff) {
              if (tomorrowOff.isExam) {
                endOfDayLargeBody = `\u2728 All classes for today have concluded. All the best for ${tomorrowOff.title} tomorrow!`;
                endOfDayBody = `Classes ended. Best of luck for ${tomorrowOff.title} tomorrow!`;
              } else {
                endOfDayLargeBody = `\u2728 All classes for today have concluded. Enjoy ${tomorrowOff.title} tomorrow!`;
                endOfDayBody = `Classes ended. Enjoy ${tomorrowOff.title} tomorrow!`;
              }
            } else if (currentDay.getDay() === 5) {
              // Friday
              const saturdaySlots = tomorrowSlots;
              const sunday = addDays(currentDay, 2);
              const sundayIso = formatLocalDate(sunday);
              const sundaySlots = getSlotsForDay(sunday);
              const sundayOff = getOffDayEventForDate(allEvents, sunday);
              const sundayIsOff =
                Boolean(cutoffIso && sundayIso > cutoffIso) ||
                sundayOff !== null ||
                sundaySlots.length === 0;

              if ((tomorrowPastCutoff || saturdaySlots.length === 0) && sundayIsOff) {
                endOfDayLargeBody = `\uD83C\uDF89 All classes for the week have concluded. Pack up and enjoy your weekend!`;
                endOfDayBody = `All classes ended. Enjoy the weekend!`;
              }
            } else if (currentDay.getDay() === 6 && tomorrowIsOff) {
              // Saturday
              endOfDayLargeBody = `\uD83C\uDF89 All classes for today have concluded. Pack up and enjoy your Sunday off!`;
              endOfDayBody = `All classes ended. Enjoy your day off tomorrow!`;
            } else if (tomorrowIsOff) {
              endOfDayLargeBody = `\uD83C\uDF19 All classes for today have concluded. Enjoy your day off tomorrow!`;
              endOfDayBody = `All classes ended. Enjoy your day off tomorrow!`;
            }

            const endOfDayId = getNotificationIdForSlot(
              "eod",
              currentIso,
              "endofday",
            );

            notificationsToSchedule.push({
              id: endOfDayId,
              title: endOfDayTitle,
              body: endOfDayBody,
              largeBody: endOfDayLargeBody,
              schedule: { at: maxEndTimeObj, allowWhileIdle: true },
              summaryText: "End of Day",
              smallIcon: "ic_stat_attendx",
              largeIcon: "attendx_notification_icon",
              iconColor: "#3B82F6",
              channelId: "class_alerts",
              extra: {
                type: "endofday",
                scheduledDate: currentIso,
                endTimeMs: maxEndTimeObj.getTime(),
                route: "/today",
              },
            });
            scheduledCount++;
          }
        }
      }

      // Ensure zero internal ID collisions within the scheduled batch via deterministic band-aware linear probing
      const usedBatchIds = new Set<number>();
      const dedupedBatch: any[] = [];
      for (const notif of notificationsToSchedule) {
        let finalId = notif.id;
        let bandStart = TIMETABLE_NOTIF_START_ID;
        let bandEnd = TIMETABLE_NOTIF_END_ID;
        if (
          finalId >= HOLIDAY_NOTIF_START_ID &&
          finalId <= HOLIDAY_NOTIF_END_ID
        ) {
          bandStart = HOLIDAY_NOTIF_START_ID;
          bandEnd = HOLIDAY_NOTIF_END_ID;
        } else if (
          finalId >= BIRTHDAY_NOTIF_START_ID &&
          finalId <= BIRTHDAY_NOTIF_END_ID
        ) {
          bandStart = BIRTHDAY_NOTIF_START_ID;
          bandEnd = BIRTHDAY_NOTIF_END_ID;
        }
        const bandSize = bandEnd - bandStart + 1;
        while (usedBatchIds.has(finalId)) {
          finalId =
            ((((finalId - bandStart + 1) % bandSize) + bandSize) % bandSize) +
            bandStart;
        }
        notif.id = finalId;
        usedBatchIds.add(finalId);
        dedupedBatch.push(notif);
      }

      // Single atomic schedule call over the Capacitor bridge
      if (dedupedBatch.length > 0) {
        await LocalNotifications.schedule({ notifications: dedupedBatch });
      }

      // Prune past delivered class alerts across days via endTimeMs or scheduledDate
      try {
        const delivered = await LocalNotifications.getDeliveredNotifications();
        const todayIso = formatLocalDate(new Date());
        const staleClassNotifs = delivered.notifications.filter((n) => {
          const id = Number(n.id);
          if (id >= TIMETABLE_NOTIF_START_ID && id <= TIMETABLE_NOTIF_END_ID) {
            if (n.extra?.type === "endofday") {
              if (!config?.endOfDaySummary) return true;
              const scheduledDate = n.extra?.scheduledDate;
              return Boolean(
                typeof scheduledDate === "string" && scheduledDate < todayIso,
              );
            }
            const endTimeMs = Number(n.extra?.endTimeMs);
            if (Number.isFinite(endTimeMs) && endTimeMs > 0) {
              return endTimeMs <= Date.now();
            }
            const scheduledDate = n.extra?.scheduledDate;
            if (typeof scheduledDate === "string" && scheduledDate < todayIso) {
              return true;
            }
            const endTimeStr = n.extra?.endTimeStr;
            if (endTimeStr) {
              const endObj = parseTimeOnDate(new Date(), endTimeStr);
              if (endObj && endObj.getTime() <= Date.now()) {
                return true;
              }
            }
          }
          return false;
        });
        if (staleClassNotifs.length > 0) {
          // @ts-ignore
          if (
            typeof LocalNotifications.removeDeliveredNotifications ===
            "function"
          ) {
            await LocalNotifications.removeDeliveredNotifications({
              notifications: staleClassNotifs,
            });
          }
        }
      } catch (e) {
        console.warn("Could not prune delivered class alerts:", e);
      }

      console.log(
        `Successfully scheduled ${scheduledCount} notifications for the next 7 days.`,
      );
    } catch (err) {
      console.error("Failed to auto-schedule timetable notifications:", err);
    }
  }

  static async cancelAssignmentReminders(assignmentId: string): Promise<void> {
    if (!Capacitor.isNativePlatform() || !assignmentId) return;
    try {
      const idsToCancel = [0, 1, 2].map((idx) =>
        getAssignmentNotificationId(assignmentId, idx),
      );
      await LocalNotifications.cancel({
        notifications: idsToCancel.map((id) => ({ id })),
      });
      try {
        const delivered = await LocalNotifications.getDeliveredNotifications();
        const deliveredToClear = delivered.notifications.filter((n) =>
          idsToCancel.includes(Number(n.id)),
        );
        if (deliveredToClear.length > 0) {
          // @ts-ignore
          if (
            typeof LocalNotifications.removeDeliveredNotifications ===
            "function"
          ) {
            await LocalNotifications.removeDeliveredNotifications({
              notifications: deliveredToClear,
            });
          }
        }
      } catch (e) {}
    } catch (err) {
      console.error("Failed to cancel assignment reminders:", err);
    }
  }

  static async scheduleAssignmentReminders(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    if (this.isSchedulingAssignments) {
      this.hasQueuedAssignmentsRun = true;
      return;
    }

    this.isSchedulingAssignments = true;
    try {
      do {
        this.hasQueuedAssignmentsRun = false;
        await this._executeScheduleAssignmentReminders();
      } while (this.hasQueuedAssignmentsRun);
    } finally {
      this.isSchedulingAssignments = false;
      this.hasQueuedAssignmentsRun = false;
    }
  }

  private static async _executeScheduleAssignmentReminders(): Promise<void> {
    try {
      const pending = await LocalNotifications.getPending();
      const toCancel = pending.notifications.filter((n) => {
        const id = Number(n.id);
        return (
          id >= ASSIGNMENT_REMINDERS_START_ID &&
          id <= ASSIGNMENT_REMINDERS_END_ID
        );
      });
      if (toCancel.length > 0) {
        await LocalNotifications.cancel({
          notifications: toCancel.map((n) => ({ id: Number(n.id) })),
        });
      }

      // Read from local store first for instant, offline-safe state
      let assignments: any[] = useAssignmentStore.getState().assignments || [];
      if (assignments.length === 0) {
        try {
          const res = await api.get("/assignments");
          assignments = Array.isArray(res.data) ? res.data : [];
          if (assignments.length > 0) {
            useAssignmentStore.setState({ assignments });
          }
        } catch {
          // Keep empty if offline
        }
      }

      const notifications = [];

      for (const assignment of assignments) {
        if (
          !assignment ||
          (assignment.completions && assignment.completions.length > 0)
        )
          continue;

        const deadline = new Date(assignment.deadline);
        if (isNaN(deadline.getTime()) || deadline.getTime() <= Date.now())
          continue;

        const cleanTitle = (assignment.title || "Assignment").trim();

        // Schedule cascade reminders
        const reminders = [
          {
            time: deadline.getTime() - 24 * 60 * 60 * 1000,
            title: "Assignment Due Tomorrow",
            text: "due tomorrow",
          },
          {
            time: deadline.getTime() - 2 * 60 * 60 * 1000,
            title: "Assignment Due in 2 Hours",
            text: "due in 2 hours",
          },
          {
            time: deadline.getTime() - 15 * 60 * 1000,
            title: "Assignment Due Soon",
            text: "due in 15 minutes!",
          },
        ];

        for (let remIdx = 0; remIdx < reminders.length; remIdx++) {
          const rem = reminders[remIdx];
          const remDate = new Date(rem.time);
          if (remDate.getTime() > Date.now()) {
            const notifId = getAssignmentNotificationId(
              assignment.id || cleanTitle,
              remIdx,
            );
            notifications.push({
              id: notifId,
              title: rem.title,
              body: cleanTitle,
              largeBody: `\u23F0 Reminder: "${cleanTitle}" is ${rem.text} at ${deadline.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
              channelId: "assignment_alerts",
              smallIcon: "ic_stat_attendx",
              largeIcon: "attendx_notification_icon",
              iconColor: "#EF4444",
              schedule: { at: remDate, allowWhileIdle: true },
            });
          }
        }
      }

      // Ensure zero internal ID collisions within the assignment batch via deterministic linear probing
      const usedAssignmentBatchIds = new Set<number>();
      const dedupedAssignmentBatch: any[] = [];
      const bandSize =
        ASSIGNMENT_REMINDERS_END_ID - ASSIGNMENT_REMINDERS_START_ID + 1;

      for (const notif of notifications) {
        let finalId = notif.id;
        while (usedAssignmentBatchIds.has(finalId)) {
          finalId =
            ((((finalId - ASSIGNMENT_REMINDERS_START_ID + 1) % bandSize) +
              bandSize) %
              bandSize) +
            ASSIGNMENT_REMINDERS_START_ID;
        }
        notif.id = finalId;
        usedAssignmentBatchIds.add(finalId);
        dedupedAssignmentBatch.push(notif);
      }

      if (dedupedAssignmentBatch.length > 0) {
        await LocalNotifications.schedule({
          notifications: dedupedAssignmentBatch,
        });
      }

      // Remove delivered notifications for assignments that are now completed or deleted
      try {
        const delivered = await LocalNotifications.getDeliveredNotifications();
        const deliveredAssignmentAlerts = delivered.notifications.filter(
          (n) => {
            const id = Number(n.id);
            return (
              id >= ASSIGNMENT_REMINDERS_START_ID &&
              id <= ASSIGNMENT_REMINDERS_END_ID
            );
          },
        );

        if (deliveredAssignmentAlerts.length > 0) {
          const activeNotificationIds = new Set<number>();
          for (const a of assignments) {
            if (!a || (a.completions && a.completions.length > 0)) continue;
            for (let remIdx = 0; remIdx < 3; remIdx++) {
              activeNotificationIds.add(
                getAssignmentNotificationId(a.id || a.title, remIdx),
              );
            }
          }

          const staleDelivered = deliveredAssignmentAlerts.filter(
            (n) => !activeNotificationIds.has(Number(n.id)),
          );
          if (staleDelivered.length > 0) {
            // @ts-ignore
            if (
              typeof LocalNotifications.removeDeliveredNotifications ===
              "function"
            ) {
              await LocalNotifications.removeDeliveredNotifications({
                notifications: staleDelivered,
              });
            }
          }
        }
      } catch (e) {
        console.warn("Could not prune delivered assignment notifications:", e);
      }
    } catch (error) {
      console.error("Failed to schedule assignment reminders", error);
    }
  }

  static async scheduleAcademicUpdates(frequency: {
    type: string;
    subValue?: string;
  }): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    this.lastAcademicFrequency = frequency;

    if (this.isSchedulingAcademic) {
      this.hasQueuedAcademicRun = true;
      return;
    }

    this.isSchedulingAcademic = true;
    try {
      do {
        this.hasQueuedAcademicRun = false;
        await this._executeScheduleAcademicUpdates(
          this.lastAcademicFrequency || frequency,
        );
      } while (this.hasQueuedAcademicRun);
    } finally {
      this.isSchedulingAcademic = false;
      this.hasQueuedAcademicRun = false;
    }
  }

  private static async _executeScheduleAcademicUpdates(frequency: {
    type: string;
    subValue?: string;
  }): Promise<void> {
    try {
      const pending = await LocalNotifications.getPending();
      const toCancel = pending.notifications.filter((n) => {
        const id = Number(n.id);
        return id >= ACADEMIC_UPDATES_START_ID && id <= ACADEMIC_UPDATES_END_ID;
      });
      if (toCancel.length > 0) {
        await LocalNotifications.cancel({
          notifications: toCancel.map((n) => ({ id: Number(n.id) })),
        });
      }

      const cacheState = useCacheStore.getState();
      const activeFreq = frequency ||
        cacheState.reminderFrequency || { type: "Weekly" };
      if (!activeFreq || activeFreq.type === "Never") return;

      const memory = cacheState.frequencyMemory || {};
      const config = useNotificationStore.getState().config;
      const notificationsToSchedule = [];
      const now = new Date();

      let allEvents = useAttendanceStore.getState().events || [];
      const storeSubjects = useAttendanceStore.getState().subjects || [];
      let subjects: any[] =
        storeSubjects.length > 0
          ? storeSubjects
          : Array.isArray(cacheState.subjects?.stats)
            ? cacheState.subjects.stats
            : Array.isArray(cacheState.subjects_overview)
              ? cacheState.subjects_overview
              : [];

      let cachedSlots: any[] = (cacheState.timetable?.slots || []).filter(
        (s: any) => !s?.validUntil,
      );

      // Proactively fetch events, slots, and subject stats if missing in memory so summaries have full context
      const activeSemId =
        useAttendanceStore.getState().activeSemesterId ||
        cacheState.semester?.activeSemester?.id;
      if (
        activeSemId &&
        (allEvents.length === 0 ||
          cachedSlots.length === 0 ||
          subjects.length === 0)
      ) {
        try {
          const [evSettled, ttSettled, statsSettled] = await Promise.allSettled([
            allEvents.length === 0
              ? api.get(`/events?semesterId=${activeSemId}`)
              : Promise.resolve(null),
            cachedSlots.length === 0
              ? api.get(`/timetable/${activeSemId}`)
              : Promise.resolve(null),
            subjects.length === 0
              ? api.get(`/attendance/stats?semesterId=${activeSemId}`)
              : Promise.resolve(null),
          ]);
          if (
            evSettled.status === "fulfilled" &&
            evSettled.value?.data &&
            Array.isArray(evSettled.value.data)
          ) {
            allEvents = this.mapServerEvents(evSettled.value.data);
            useAttendanceStore.setState({ events: allEvents });
          }
          if (ttSettled.status === "fulfilled" && ttSettled.value?.data) {
            const normalized = this.normalizeTimetableSlots(
              ttSettled.value.data,
            );
            if (normalized.length > 0) {
              cachedSlots = normalized.filter((s: any) => !s?.validUntil);
              const existingTt = useCacheStore.getState().timetable || {};
              useCacheStore.getState().setCache("timetable", {
                ...existingTt,
                slots: normalized,
              });
            }
          }
          if (statsSettled.status === "fulfilled" && statsSettled.value?.data) {
            const rawStats = Array.isArray(statsSettled.value.data)
              ? statsSettled.value.data
              : statsSettled.value.data?.subjects || [];
            if (Array.isArray(rawStats) && rawStats.length > 0) {
              subjects = rawStats;
              const curSubCache = useCacheStore.getState().subjects || {};
              useCacheStore.getState().setCache("subjects", {
                ...curSubCache,
                stats: rawStats,
                activeSemesterId: activeSemId,
              });
            }
          }
        } catch (_) {}
      }

      let attended = 0;
      let total = 0;
      subjects.forEach((s: any) => {
        attended += Number(s?.attended) || 0;
        total += Number(s?.total) || 0;
      });
      const overallPct =
        total === 0 ? 100 : Math.round((attended / total) * 100);

      const activeSemester =
        cacheState.semester?.activeSemester ||
        (cacheState.timetable as any)?.activeSemester;
      const cutoffIso = getInstructionalCutoffIso(allEvents, activeSemester);

      // Independent, distinct delivery times for each summary tier
      const dailyTime =
        config?.dailySummaryTime || config?.summaryTime || "18:00";
      const weeklyTime = config?.weeklySummaryTime || "18:00";
      const monthlyTime = config?.monthlySummaryTime || "19:00";

      // 1. Daily Academic Briefings: scheduled for the next 7 days at dailyTime
      const dailyDates = calculateNextSummaryDates(
        { type: "Daily" },
        dailyTime,
        now,
      ).slice(0, 10);
      for (let i = 0; i < dailyDates.length; i++) {
        const notifyDate = dailyDates[i];
        const isMorningBriefing = notifyDate.getHours() < 14;
        const targetDay = isMorningBriefing
          ? notifyDate
          : addDays(notifyDate, 1);
        const dayLabel = isMorningBriefing ? "Today" : "Tomorrow";
        const dayLabelPossessive = isMorningBriefing ? "Today's" : "Tomorrow's";
        const dayLabelLower = isMorningBriefing ? "today" : "tomorrow";

        const targetOff = getOffDayEventForDate(allEvents, targetDay);
        const isPastCutoff = Boolean(
          cutoffIso && formatLocalDate(targetDay) > cutoffIso,
        );

        let dbTargetDay = targetDay.getDay() === 0 ? 6 : targetDay.getDay() - 1;
        const targetSlots = isPastCutoff
          ? []
          : cachedSlots.filter((s: any) => s.dayOfWeek === dbTargetDay);
        const targetHasClasses = targetSlots.length > 0 && !targetOff;

        let title = "Tomorrow's Briefing";
        let body = "You have classes coming up tomorrow.";
        let largeBody =
          "🎒 Prepare for Tomorrow\n\nYou have classes scheduled. Tap to review your timetable, check for assignments, and pack your bag!";

        if (targetOff?.isExam) {
          title = `${dayLabel}: ${targetOff.title}`;
          body = `Regular classes suspended ${dayLabelLower} for ${targetOff.title}. All the best!`;
          largeBody = `📝 ${dayLabelPossessive} Briefing\n\n${dayLabel} has ${targetOff.title} scheduled. Regular classes are suspended — all the best!`;
        } else if (isPastCutoff && !targetOff) {
          // After Last Working Day: only alert about upcoming exams, never repetitive "Day Off" class spam
          const upcomingExam = allEvents
            .filter((e: any) => {
              const t = String(e?.title || "").toLowerCase();
              const ty = String(e?.type || e?.eventType || "").toLowerCase();
              const isEx = !t.includes("break") && !t.includes("vacation") && (ty === "exam" || ty === "midsem" || ty === "endsem" || /\b(midsem|mid[\s-]?sem|endsem|end[\s-]?sem|exam|viva|practical\s+test|assessment\s+test)\b/i.test(t));
              if (!isEx) return false;
              const evStart = parseLocalDate(e.date);
              const diffDays = Math.round((evStart.getTime() - startOfDay(targetDay).getTime()) / 86400000);
              return diffDays >= 0 && diffDays <= 14;
            })
            .sort((a: any, b: any) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime())[0];

          if (!upcomingExam) {
            continue;
          }
          const evStart = parseLocalDate(upcomingExam.date);
          const daysToExam = Math.round((evStart.getTime() - startOfDay(targetDay).getTime()) / 86400000);
          title = daysToExam === 0
            ? `${dayLabel}: ${upcomingExam.title}`
            : `📝 Exam in ${daysToExam} day${daysToExam === 1 ? "" : "s"}`;
          body = daysToExam === 0
            ? `Classes concluded — focus on ${upcomingExam.title}!`
            : `Classes concluded — ${upcomingExam.title} begins in ${daysToExam} day${daysToExam === 1 ? "" : "s"}.`;
          largeBody = `📝 Post-Teaching Exam Briefing\n\n${body}`;
        } else if (targetOff) {
          title = `${dayLabel}: ${targetOff.title}`;
          body = `No regular classes scheduled ${dayLabelLower} for ${targetOff.title}. Enjoy your day off!`;
          largeBody = `✨ ${dayLabelPossessive} Briefing\n\n${dayLabel} is ${targetOff.title}! No regular classes are scheduled. Enjoy your day!`;
        } else if (!targetHasClasses) {
          title = `${dayLabelPossessive} Briefing: Day Off`;
          body = `No classes scheduled for ${dayLabelLower}. Take some time to relax or catch up on studies!`;
          largeBody = `🎒 ${dayLabelPossessive} Briefing\n\nYou have no classes scheduled for ${dayLabelLower}. Enjoy your day off or review your coursework!`;
        } else {
          title = `${dayLabelPossessive} Briefing`;
          body = `You have ${targetSlots.length} class${targetSlots.length === 1 ? "" : "es"} scheduled ${dayLabelLower}.`;
          largeBody = `🎒 Prepare for ${dayLabel}\n\nYou have ${targetSlots.length} class${targetSlots.length === 1 ? "" : "es"} scheduled ${dayLabelLower}. Tap to review your schedule!`;
        }

        notificationsToSchedule.push({
          id: ACADEMIC_UPDATES_START_ID + i,
          title,
          body,
          largeBody,
          summaryText: "Academic Briefing",
          smallIcon: "ic_stat_attendx",
          largeIcon: "attendx_notification_icon",
          iconColor: "#3B82F6",
          channelId: "academic_briefings",
          extra: {
            type: "morning_summary",
            frequency: "daily",
            route: "/today",
            url: "/today",
          },
          schedule: { at: notifyDate, allowWhileIdle: true },
        });
      }

      // 2. Weekly Academic Review: scheduled for the next 4 weeks at weeklyTime on chosen weekly day
      const weeklyDay =
        memory.Weekly ||
        (activeFreq.type === "Weekly" ? activeFreq.subValue : "Sun") ||
        "Sun";
      const weeklyDates = calculateNextSummaryDates(
        { type: "Weekly", subValue: weeklyDay },
        weeklyTime,
        now,
      );
      for (let i = 0; i < weeklyDates.length; i++) {
        const notifyDate = weeklyDates[i];
        const endOfWeekDay = addDays(notifyDate, -1);
        const startOfWeekDay = addDays(endOfWeekDay, -6);
        const weekEvents = allEvents.filter((e) => {
          if (!e.date) return false;
          const start = parseLocalDate(e.date);
          const end = e.endDate ? parseLocalDate(e.endDate) : start;
          return (
            start.getTime() <= endOfWeekDay.getTime() &&
            end.getTime() >= startOfWeekDay.getTime()
          );
        });
        let largeBody =
          "📅 Weekly Review\n\nTake a look back at your attendance performance this week and plan ahead for the upcoming week.";
        if (
          weekEvents.some(
            (e) =>
              (e.eventType || e.type || "").toLowerCase() === "holiday" ||
              (e.title || "").toLowerCase().includes("holiday"),
          )
        ) {
          largeBody =
            "📅 Weekly Review\n\nIt was a short week with some holidays! Check how your attendance was impacted and review your targets.";
        }
        notificationsToSchedule.push({
          id: 8810 + i,
          title: "Weekly Summary",
          body: "Weekly Review: See how you did this past week!",
          largeBody,
          summaryText: "Weekly Review",
          smallIcon: "ic_stat_attendx",
          largeIcon: "attendx_notification_icon",
          iconColor: "#8B5CF6",
          channelId: "academic_briefings",
          extra: {
            type: "weekly_summary",
            frequency: "weekly",
            route: "/report",
            url: "/report",
          },
          schedule: { at: notifyDate, allowWhileIdle: true },
        });
      }

      // 3. Monthly Attendance Summary: scheduled for the next 3 months at monthlyTime on chosen monthly day
      const monthlyDay =
        memory.Monthly ||
        (activeFreq.type === "Monthly" ? activeFreq.subValue : "1") ||
        "1";
      const monthlyDates = calculateNextSummaryDates(
        { type: "Monthly", subValue: monthlyDay },
        monthlyTime,
        now,
      );
      for (let i = 0; i < monthlyDates.length; i++) {
        const notifyDate = monthlyDates[i];
        notificationsToSchedule.push({
          id: 8820 + i,
          title: "Monthly Attendance Summary",
          body: "Your monthly review is ready! See how well you did this month.",
          largeBody: `📈 Monthly Summary\n\nYour overall attendance is currently at ${overallPct}%. Tap to see your detailed breakdown and performance across all subjects.`,
          summaryText: "Monthly Summary",
          smallIcon: "ic_stat_attendx",
          largeIcon: "attendx_notification_icon",
          iconColor: "#EC4899",
          channelId: "academic_briefings",
          extra: {
            type: "monthly_summary",
            frequency: "monthly",
            route: "/report",
            url: "/report",
          },
          schedule: { at: notifyDate, allowWhileIdle: true },
        });
      }

      if (notificationsToSchedule.length > 0) {
        await LocalNotifications.schedule({
          notifications: notificationsToSchedule,
        });
      }
    } catch (error) {
      console.error("Failed to schedule academic updates:", error);
    }
  }

  static async cancelAll(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const { cancelAllNativeClassReminders } = await import("../lib/ringer");
      await cancelAllNativeClassReminders();
      if (typeof LocalNotifications.cancelAll === "function") {
        await LocalNotifications.cancelAll();
      } else {
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
          await LocalNotifications.cancel({
            notifications: pending.notifications.map((n) => ({
              id: Number(n.id),
            })),
          });
        }
      }
      try {
        if (
          typeof LocalNotifications.removeAllDeliveredNotifications ===
          "function"
        ) {
          await LocalNotifications.removeAllDeliveredNotifications();
        }
      } catch (e) {
        console.warn(
          "Could not remove delivered notifications on cancelAll:",
          e,
        );
      }
      if (getScheduledUnmuteTime() !== null) {
        await unmutePhone().catch(() => {});
      }
      setScheduledUnmuteTime(null);
      console.log(
        "All local notifications and delivered alerts purged successfully.",
      );
    } catch (e) {
      console.error("Failed to cancel all notifications:", e);
    }
  }

  static async triggerTestAcademicSummaryNotification(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      let perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        perm = await LocalNotifications.requestPermissions();
        if (perm.display !== "granted") return false;
      }

      const subjects = useAttendanceStore.getState().subjects || [];
      let attended = 0;
      let total = 0;
      subjects.forEach((s) => {
        attended += s.attended || 0;
        total += s.total || 0;
      });
      const overallPct =
        total === 0 ? 100 : Math.round((attended / total) * 100);

      await LocalNotifications.schedule({
        notifications: [
          {
            id: 8899,
            title: "📊 Monthly Summary (Test)",
            body: `Your monthly review is ready! Overall attendance is at ${overallPct}%.`,
            largeBody: `📊 Monthly Summary\n\nYour notification channels and alarms are active! Your overall attendance is currently at ${overallPct}%. Tap to view your subjects.`,
            summaryText: "Academic Update",
            smallIcon: "ic_stat_attendx",
            largeIcon: "attendx_notification_icon",
            iconColor: "#3B82F6",
            channelId: "academic_briefings",
            extra: {
              type: "monthly_summary",
              frequency: "monthly",
              route: "/report",
              url: "/report",
            },
            schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true },
          },
        ],
      });
      return true;
    } catch (e) {
      console.error("Failed to trigger test academic notification:", e);
      return false;
    }
  }

  static async triggerTestMuteNotification(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const { testMuteNotification } = await import("../lib/ringer");
      return await testMuteNotification();
    } catch (e) {
      console.error("Failed to trigger test mute notification", e);
      return false;
    }
  }
}




