import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { mutePhone, unmutePhone, checkAndReconcileRinger, setScheduledUnmuteTime, PERMISSION_WARNING_NOTIF_ID, requestDndPermission } from '../lib/ringer';
import { useAttendanceStore } from '../stores/attendanceStore';
import { useAssignmentStore } from '../stores/assignmentStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useAuthStore } from '../stores/authStore';
import { useCacheStore } from '../stores/cacheStore';
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

export class NotificationService {
  private static isInitialized = false;
  private static isSchedulingTimetable = false;
  private static hasQueuedTimetableRun = false;
  private static isSchedulingAssignments = false;
  private static hasQueuedAssignmentsRun = false;
  private static isSchedulingAcademic = false;
  private static hasQueuedAcademicRun = false;
  private static lastAcademicFrequency: { type: string; subValue?: string } | null = null;

  static async waitForStoreHydration(timeoutMs: number = 2000): Promise<boolean> {
    if (useAttendanceStore.persist?.hasHydrated?.()) return true;
    if (useAttendanceStore.getState().activeSemesterId) return true;

    return new Promise<boolean>((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(Boolean(useAttendanceStore.getState().activeSemesterId || useAttendanceStore.persist?.hasHydrated?.()));
        }
      }, timeoutMs);

      if (useAttendanceStore.persist?.onFinishHydration) {
        useAttendanceStore.persist.onFinishHydration(() => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            resolve(true);
          }
        });
      } else {
        const unsub = useAttendanceStore.subscribe((state) => {
          if (state.activeSemesterId && !resolved) {
            resolved = true;
            clearTimeout(timer);
            unsub();
            resolve(true);
          }
        });
      }
    });
  }

  private static pushListenersRegistered = false;

  private static setupPushListeners() {
    if (!Capacitor.isNativePlatform() || this.pushListenersRegistered) return;
    this.pushListenersRegistered = true;

    PushNotifications.addListener('registration', async (token) => {
      console.log('[FCM] Push registration success, token: ' + token.value);
      localStorage.setItem('fcm_token', token.value);
      try {
        if (useAuthStore.getState().isAuthenticated) {
          await api.patch('/users/me', { fcmToken: token.value });
          console.log('[FCM] Successfully synced FCM token to backend.');
        }
      } catch (error) {
        console.error('[FCM] Failed to sync FCM token to backend (will retry on login):', error);
      }
    });

    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('[FCM] Error on registration: ' + JSON.stringify(error));
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[FCM] Push received in foreground: ', notification);
      let rawData = notification.data || (notification as any)?.notification?.data || {};
      if (typeof rawData === 'string') {
        try {
          rawData = JSON.parse(rawData);
        } catch (_) {}
      }
      const data = typeof rawData === 'object' && rawData !== null ? rawData : {};
      const type = String(data.type || data.notification_type || '').toLowerCase();
      const classroomId = String(data.classroomId || data.classroom_id || data.id || '');
      const title = notification.title || data.title || 'Classroom Broadcast';
      const body = notification.body || data.body || '';
      const targetRoute = data.route || data.url || (classroomId ? `/classrooms/${classroomId}` : type === 'classroom_deleted' ? '/classrooms' : null);

      if (type === 'classroom_announcement' || type === 'classroom_broadcast' || type === 'announcement') {
        if (classroomId) {
          const annObj = {
            id: data.announcementId || data.id || `fcm-${Date.now()}`,
            title: title || data.title || 'Classroom Notice',
            content: data.content || data.body || body || '',
            body: data.content || data.body || body || '',
            importance: data.importance || 'low',
            isPinned: Boolean(data.isPinned && data.isPinned !== 'false'),
            createdAt: data.createdAt || new Date().toISOString(),
            authorName: data.authorName || 'Classroom Admin',
          };
          useCacheStore.getState().appendClassroomAnnouncement(classroomId, annObj);
        }
        window.dispatchEvent(new CustomEvent('fcm_classroom_broadcast', { detail: { ...data, classroomId, type } }));
        triggerDynamicHUD({
          type: 'plane',
          label: title,
          subtitle: body,
          durationMs: 5000,
          route: targetRoute || undefined,
        });
      } else if (type === 'classroom_access_updated' || type === 'broadcast_permission_updated') {
        window.dispatchEvent(new CustomEvent('fcm_classroom_access_updated', { detail: { ...data, classroomId, type } }));
        triggerDynamicHUD({
          type: 'success',
          label: title,
          subtitle: body,
          durationMs: 4000,
          route: targetRoute || undefined,
        });
      } else if (type === 'classroom_deleted' || type === 'classroom_disbanded') {
        window.dispatchEvent(new CustomEvent('fcm_classroom_deleted', { detail: { ...data, classroomId, type } }));
        triggerDynamicHUD({
          type: 'trash',
          label: title,
          subtitle: body,
          durationMs: 5000,
          route: '/classrooms',
        });
      }
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('[FCM] Push action performed: ', notification);
      let rawData = notification.notification?.data || (notification as any)?.data || {};
      if (typeof rawData === 'string') {
        try {
          rawData = JSON.parse(rawData);
        } catch (_) {}
      }
      const data = typeof rawData === 'object' && rawData !== null ? rawData : {};
      const type = String(data.type || data.notification_type || '').toLowerCase();
      const classroomId = String(data.classroomId || data.classroom_id || data.id || '');
      const targetRoute = data.route || data.url || (classroomId ? `/classrooms/${classroomId}` : type === 'classroom_deleted' ? '/classrooms' : null);

      // Re-dispatch live events when user taps notification from tray
      if (type === 'classroom_announcement' || type === 'classroom_broadcast' || type === 'announcement') {
        if (classroomId) {
          const annObj = {
            id: data.announcementId || data.id || `fcm-${Date.now()}`,
            title: data.title || 'Classroom Notice',
            content: data.content || data.body || '',
            body: data.content || data.body || '',
            importance: data.importance || 'low',
            isPinned: Boolean(data.isPinned && data.isPinned !== 'false'),
            createdAt: data.createdAt || new Date().toISOString(),
            authorName: data.authorName || 'Classroom Admin',
          };
          useCacheStore.getState().appendClassroomAnnouncement(classroomId, annObj);
        }
        window.dispatchEvent(new CustomEvent('fcm_classroom_broadcast', { detail: { ...data, classroomId, type } }));
      } else if (type === 'classroom_access_updated' || type === 'broadcast_permission_updated') {
        window.dispatchEvent(new CustomEvent('fcm_classroom_access_updated', { detail: { ...data, classroomId, type } }));
      } else if (type === 'classroom_deleted' || type === 'classroom_disbanded') {
        window.dispatchEvent(new CustomEvent('fcm_classroom_deleted', { detail: { ...data, classroomId, type } }));
      }

      if (type === 'ota_update') {
        window.dispatchEvent(new Event('check_ota_update'));
      } else if (targetRoute) {
        try {
          sessionStorage.setItem('pending_push_route', targetRoute);
        } catch (_) {}
        window.dispatchEvent(new CustomEvent('push_route', { detail: targetRoute }));
      }
    });
  }

  static async checkPermissions(): Promise<'prompt' | 'prompt-with-rationale' | 'granted' | 'denied'> {
    if (!Capacitor.isNativePlatform()) {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') return 'granted';
        if (Notification.permission === 'denied') return 'denied';
        return 'prompt';
      }
      return 'granted';
    }
    try {
      const perm = await LocalNotifications.checkPermissions();
      return perm.display;
    } catch {
      return 'denied';
    }
  }

  static async requestPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        try {
          const res = await Notification.requestPermission();
          return res === 'granted';
        } catch {
          return false;
        }
      }
      return true;
    }
    try {
      let perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        perm = await LocalNotifications.requestPermissions();
      }
      const isGranted = perm.display === 'granted';
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

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn('User denied push notification permissions.');
        return;
      }

      await PushNotifications.register();
    } catch (e) {
      console.warn("Could not register push notifications:", e);
    }
  }

  static async syncFcmToken() {
    const token = localStorage.getItem('fcm_token');
    if (token) {
      try {
        await api.patch('/users/me', { fcmToken: token });
        console.log('[FCM] Successfully synced FCM token to backend after login.');
      } catch (error) {
        console.error('[FCM] Failed to sync FCM token:', error);
      }
    } else {
      this.setupPushListeners();
      console.log('[FCM] Token is null at sync. Re-registering push to force token emission.');
      if (Capacitor.isNativePlatform()) {
        import('@capacitor/push-notifications').then(({ PushNotifications }) => {
          PushNotifications.register().catch(() => {});
        });
      }
    }
  }

  static async init() {
    if (!Capacitor.isNativePlatform() || this.isInitialized) return;
    this.isInitialized = true;
    
    // Request basic permissions safely without blocking initialization on failure
    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }

      // Initialize Push Notifications
      await this.registerPushNotifications();
    } catch (permErr) {
      console.warn("Could not check/request notification permissions:", permErr);
    }

    // Create premium notification channels with defensive error handling
    try {
      await LocalNotifications.createChannel({
        id: 'class_alerts',
        name: 'Class Reminders',
        description: 'Heads-up alerts before your class begins.',
        importance: 5, 
        visibility: 1, 
        lights: true,
        lightColor: '#6366F1', 
        vibration: true,
      });

      await LocalNotifications.createChannel({
        id: 'silent_mode',
        name: 'Active Silent Mode',
        description: 'Pinned notification while class is actively running and phone is muted.',
        importance: 3, // Default importance: displays pinned notification in shade without DND hiding it
        visibility: 1, 
        lights: false,
        vibration: false,
      });

      await LocalNotifications.createChannel({
        id: 'academic_briefings',
        name: 'Academic Summaries',
        description: 'Daily, weekly, and monthly briefing summaries and attendance reviews.',
        importance: 3,
        visibility: 1,
        lights: true,
        lightColor: '#3B82F6',
        vibration: false,
      });

      await LocalNotifications.createChannel({
        id: 'assignment_alerts',
        name: 'Assignment Deadlines',
        description: 'Reminders for upcoming coursework and project deadlines.',
        importance: 4,
        visibility: 1,
        lights: true,
        lightColor: '#EF4444',
        vibration: true,
      });

      await LocalNotifications.createChannel({
        id: 'system_alerts',
        name: 'System Alerts',
        description: 'Administrative warnings and device permission prompts.',
        importance: 4,
        visibility: 1,
        lights: true,
        lightColor: '#F59E0B',
        vibration: true,
      });
    } catch (e) {
      console.warn("Could not create notification channels:", e);
    }

    try {
      await LocalNotifications.registerActionTypes({
        types: [
          {
            id: 'CLASS_SILENT_ACTIONS',
            actions: [
              {
                id: 'UNMUTE_ACTION',
                title: '\uD83D\uDD0A Unmute Phone',
                foreground: false,
                destructive: false
              }
            ]
          },
          {
            id: 'CLASS_REMINDER_ACTIONS',
            actions: [
              {
                id: 'MUTE_ACTION',
                title: '\uD83D\uDD15 Mute Phone for Class',
                foreground: false,
                destructive: false
              }
            ]
          }
        ]
      });
    } catch (e) {
      console.warn("Could not register notification action types:", e);
    }

    // Reconcile ringer on startup
    await checkAndReconcileRinger(PINNED_MUTE_NOTIF_ID);

    // Reconcile ringer and synchronize notifications when app returns to foreground from background
    try {
      CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
        if (isActive) {
          await checkAndReconcileRinger(PINNED_MUTE_NOTIF_ID);

          // If user was prompted to enable DND permission and returned, fulfill the pending mute request
          try {
            const pendingMuteRaw = localStorage.getItem('attendx_pending_mute_request');
            if (pendingMuteRaw) {
              const pendingMute = JSON.parse(pendingMuteRaw);
              if (pendingMute.endTimeMs && pendingMute.endTimeMs > Date.now()) {
                const { checkDndPermission, mutePhone } = await import('../lib/ringer');
                const hasDnd = await checkDndPermission();
                if (hasDnd) {
                  localStorage.removeItem('attendx_pending_mute_request');
                  const muted = await mutePhone(pendingMute.endTimeMs, pendingMute.classTitle || "Class");
                  if (muted) {
                    await this.triggerPinnedClassMute(pendingMute.classTitle || "Class", new Date(pendingMute.endTimeMs));
                    const { toast } = await import('sonner');
                    // Phone muted via pinned notification
                  }
                }
              } else {
                localStorage.removeItem('attendx_pending_mute_request');
              }
            }
          } catch (pendingErr) {
            console.warn("Failed to process pending mute on app resume:", pendingErr);
          }

          try {
            const perm = await LocalNotifications.checkPermissions();
            if (perm.display === 'granted') {
              await this.registerPushNotifications();
              await this.syncFcmToken();
              await this.scheduleAllProactiveNotifications();
            }
          } catch {}
        }
      });
    } catch (e) {
      console.warn("Could not register appStateChange listener:", e);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        checkAndReconcileRinger(PINNED_MUTE_NOTIF_ID).catch(() => {});
      });
    }

    const navigateInApp = (url: string) => {
      try {
        if (window.location.pathname !== url) {
          window.history.pushState(null, '', url);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      } catch {
        window.location.href = url;
      }
    };

    // Listen for unmute/mute actions and notification body taps
    try {
      LocalNotifications.addListener('localNotificationActionPerformed', async (action) => {
        try {
          // Tap on the notification body itself
          if (action.actionId === 'tap' || action.actionId === 'ACADEMIC_UPDATE_OPEN') {
            const extra = action.notification.extra;
            if (Number(action.notification.id) === PERMISSION_WARNING_NOTIF_ID || (extra && extra.type === 'dnd_permission')) {
               navigateInApp('/settings');
               await requestDndPermission();
               return;
            }
            if (extra && extra.type === 'ota_update') {
               window.dispatchEvent(new Event('check_ota_update'));
               return;
            }
            if (extra && (extra.route || extra.url)) {
               navigateInApp(extra.route || extra.url);
               return;
            }
            const id = Number(action.notification.id);
            // Academic updates series (8800..8899)
            if (id >= ACADEMIC_UPDATES_START_ID && id <= ACADEMIC_UPDATES_END_ID) {
              navigateInApp('/report');
              return;
            }
            // Assignment series (9000..69999)
            if (id >= ASSIGNMENT_REMINDERS_START_ID && id <= ASSIGNMENT_REMINDERS_END_ID) {
              navigateInApp('/assignments');
              return;
            }
            // Timetable classes & events
            if (isManagedTimetableNotificationId(id)) {
              navigateInApp('/today');
              return;
            }
          }

          if (action.actionId === 'UNMUTE_ACTION') {
            const success = await unmutePhone();
            if (success) {
              await LocalNotifications.cancel({ notifications: [{ id: PINNED_MUTE_NOTIF_ID }, { id: 8888 }] });
              try {
                // @ts-ignore
                if (typeof LocalNotifications.removeDeliveredNotifications === 'function') {
                  await LocalNotifications.removeDeliveredNotifications({ notifications: [{ id: PINNED_MUTE_NOTIF_ID }, { id: 8888 }] as any });
                }
              } catch {}
              // Pinned notification dismissed; no web toast needed
            }
          } else if (action.actionId === 'MUTE_ACTION') {
            let rawExtra = action.notification.extra;
            if (typeof rawExtra === 'string') {
              try { rawExtra = JSON.parse(rawExtra); } catch {}
            }
            const { classTitle, endTimeStr, startTimeStr, endTimeMs } = rawExtra || {};
            
            let endTime = new Date();
            let classEnded = false;

            if (endTimeMs && typeof endTimeMs === 'number' && !isNaN(endTimeMs) && endTimeMs > 0) {
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
                  const parsedStart = parseTimeOnDate(new Date(), startTimeStr);
                  if (parsedStart && parsedStart.getTime() > parsedEnd.getTime()) {
                    crossesMidnight = true;
                  }
                }
                if (crossesMidnight) {
                  if (endTime.getTime() < Date.now()) endTime = addDays(endTime, 1);
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
                await LocalNotifications.cancel({ notifications: [{ id: Number(action.notification.id) }] });
                // @ts-ignore
                if (typeof LocalNotifications.removeDeliveredNotifications === 'function') {
                  await LocalNotifications.removeDeliveredNotifications({ notifications: [action.notification as any] });
                }
              } catch {}
              return;
            }

            // Try muting with scheduled unmute epoch
            const success = await mutePhone(endTime.getTime(), classTitle || "Class");
            if (!success) {
              // Store pending request so as soon as user grants DND in Settings and returns, it automatically mutes!
              localStorage.setItem('attendx_pending_mute_request', JSON.stringify({
                classTitle: classTitle || "Class",
                endTimeMs: endTime.getTime(),
                endTimeStr,
                startTimeStr,
              }));
              toast.error("DND Permission required. Please enable Do Not Disturb access in Settings.");
              return;
            }
            localStorage.removeItem('attendx_pending_mute_request');

            // Pinned notification triggered below; no duplicate web toast needed
            await this.triggerPinnedClassMute(classTitle || "Class", endTime);
          }
        } catch (actionErr) {
          console.error("Error processing notification action:", actionErr);
        }
      });
    } catch (e) {
      console.warn("Could not register localNotificationActionPerformed listener:", e);
    }

    // Sweep for any stuck DND notifications from previous sessions
    try {
      const delivered = await LocalNotifications.getDeliveredNotifications();
      const stuckMute = delivered.notifications.find(n => Number(n.id) === PINNED_MUTE_NOTIF_ID || Number(n.id) === 8888);
      if (stuckMute) {
        await checkAndReconcileRinger(PINNED_MUTE_NOTIF_ID);
        try {
          // @ts-ignore
          if (LocalNotifications.removeDeliveredNotifications) {
            await LocalNotifications.removeDeliveredNotifications({ notifications: [stuckMute] });
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
    type: 'standard' | 'headsup' = 'standard'
  ) {
    if (!Capacitor.isNativePlatform()) return;
    if (isNaN(actualStartTime.getTime()) || isNaN(notifyTime.getTime())) return;
    if (notifyTime.getTime() <= Date.now()) return;

    try {
      const cleanTitle = (classTitle || "Class").trim();
      const timeStr = actualStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const notifId = getNotificationIdForSlot(slotId, formatLocalDate(actualStartTime), type);
      const endObj = endTimeStr ? parseTimeOnDate(actualStartTime, endTimeStr) : null;
      const calculatedEndMs = endObj ? endObj.getTime() : (actualStartTime.getTime() + 60 * 60 * 1000);

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title: type === 'headsup' ? `Upcoming (Heads Up): ${cleanTitle}` : `Upcoming: ${cleanTitle}`,
            body: `Starts at ${timeStr} ${location ? `| ${location.trim()}` : ''}`,
            largeBody: type === 'headsup'
              ? `\uD83D\uDCDA Class: ${cleanTitle}\n\u23F0 Time: ${timeStr} - ${endTimeStr || 'TBD'}\n\uD83D\uDCCD Room: ${location ? location.trim() : 'N/A'}\n\nHeads up: Your upcoming class starts soon. Tap below to mute your phone for this class.`
              : `\uD83D\uDCDA Class: ${cleanTitle}\n\u23F0 Time: ${timeStr} - ${endTimeStr || 'TBD'}\n\uD83D\uDCCD Room: ${location ? location.trim() : 'N/A'}\n\nTap the action button below to instantly mute your phone for the duration of this class.`,
            summaryText: "Class Reminder",
            smallIcon: "ic_stat_attendx",
            largeIcon: "attendx_notification_icon",
            iconColor: "#6366F1", 
            channelId: 'class_alerts',
            foreground: true,
            actionTypeId: 'CLASS_REMINDER_ACTIONS',
            extra: { classTitle: cleanTitle, endTimeStr, startTimeStr: timeStr, endTimeMs: calculatedEndMs },
            schedule: { 
              at: notifyTime,
              allowWhileIdle: true
            },
          }
        ]
      });
    } catch (e) {
      console.warn("Failed to schedule class reminder:", e);
    }
  }

  static async triggerPinnedClassMute(className: string, endTime: Date) {
    if (isNaN(endTime.getTime())) return;
    setScheduledUnmuteTime(endTime.getTime());
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      const cleanClassName = (className || "Class").trim();
      const timeStr = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Trigger native ringer plugin to silence and register native resurrection
      await mutePhone(endTime.getTime(), cleanClassName);

      // On native Android, mutePhone already registers the un-swipeable native pinned notification with FLAG_NO_CLEAR.
      // We only schedule via Capacitor LocalNotifications if NOT on native platform (e.g. web environment fallback).
      if (!Capacitor.isNativePlatform()) {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: PINNED_MUTE_NOTIF_ID,
              title: `Class in Session`,
              body: `Phone is silenced until ${timeStr}`,
              largeBody: `\uD83D\uDD15 Current Class: ${cleanClassName}\n\nYour phone has been muted via AttendX. It will restore to normal volume automatically at ${timeStr}, or you can unmute manually below.`,
              summaryText: "Do Not Disturb Active",
              smallIcon: "ic_stat_attendx",
              largeIcon: "attendx_notification_icon",
              iconColor: "#10B981", 
              channelId: 'silent_mode',
              ongoing: true,
              autoCancel: false,
              actionTypeId: 'CLASS_SILENT_ACTIONS',
              schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true }
            }
          ]
        });
      }

      const timeUntilEnd = Math.min(Math.max(0, endTime.getTime() - Date.now()), 2147483647);
      if (timeUntilEnd > 0) {
        setTimeout(async () => {
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
    customMessage: string = "No classes scheduled! Enjoy your day off."
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
            title: cleanHolidayName.toLowerCase().includes("holiday") ? "Holiday Today: " + cleanHolidayName : "Event Today: " + cleanHolidayName,
            body: customMessage,
            largeBody: "\u2728 " + cleanHolidayName + "\n\n" + customMessage,
            summaryText: "Holiday Event",
            smallIcon: "ic_stat_attendx",
            largeIcon: "attendx_notification_icon",
            iconColor: "#10B981", 
            channelId: "class_alerts",
            schedule: { at: targetDate, allowWhileIdle: true }
          }
        ]
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
        .replace(/^(?:happy\s+)?birthday\s+of\s+/i, '')
        .replace(/^(?:happy\s+)?birthday\s+/i, '')
        .replace(/(?:'s|s)?\s*birthday.*$/i, '')
        .replace(/^(?:of\s+)/i, '')
        .trim();
      if (!cleanName) cleanName = "Friend";

      const notifId = getBirthdayNotificationId(cleanName, formatLocalDate(targetDate));

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
            schedule: { at: targetDate, allowWhileIdle: true }
          }
        ]
      });
    } catch (e) {
      console.warn("Failed to schedule birthday notification:", e);
    }
  }

  /**
   * Proactively checks permissions, onboarding/semester state, timetable slots,
   * events, and summary preferences, and schedules ALL notifications (classes, events,
   * and all 4 academic summaries) without waiting for the user to open any specific page.
   */
  static async scheduleAllProactiveNotifications(force: boolean = false): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      // 1. Prior check: Check notification permissions
      const perm = await this.checkPermissions();
      if (perm !== 'granted') {
        return;
      }

      // 2. Schedule Timetable Classes & Semester Events (does prior checks for semester, slots, and events)
      await this.autoScheduleFromTimetable();

      // 3. Schedule All Academic Summaries (Daily, Weekly, Monthly)
      const activeFreq = useCacheStore.getState().reminderFrequency || { type: 'Daily' };
      await this.scheduleAcademicUpdates(activeFreq);

      // 4. Schedule Assignment Reminders
      await this.scheduleAssignmentReminders();
    } catch (e) {
      console.warn("NotificationService: scheduleAllProactiveNotifications error:", e);
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
      let activeSemesterId = useAttendanceStore.getState().activeSemesterId;
      if (!activeSemesterId) {
        const cached = useCacheStore.getState().timetable;
        if (cached?.activeSemester?.id) {
          activeSemesterId = cached.activeSemester.id;
        }
      }
      if (!activeSemesterId) {
        try {
          const semRes = await api.get("/semesters/active");
          if (semRes.data?.id) {
            activeSemesterId = semRes.data.id;
            useAttendanceStore.setState({ activeSemesterId: semRes.data.id, hasActiveSemester: true });
          }
        } catch (e) {
          console.warn("NotificationService: could not fetch active semester", e);
        }
      }
      if (!activeSemesterId) return;

      console.log("Auto-scheduling local notifications for upcoming classes and events...");

      let rawSlots: any = useCacheStore.getState().timetable?.slots;
      let events = useAttendanceStore.getState().events || [];

      // Concurrently fetch slots and events if missing in memory so neither blocks the other
      const prefetchTasks: Promise<any>[] = [];
      if (!rawSlots || rawSlots.length === 0) {
        prefetchTasks.push(
          api.get(`/timetable/${activeSemesterId}`)
            .then(res => {
              rawSlots = res.data;
              const slotsArr = Array.isArray(rawSlots) ? rawSlots : (rawSlots?.slots || []);
              if (slotsArr.length > 0) {
                useCacheStore.getState().setTimetable({ slots: slotsArr });
              }
            })
            .catch(e => console.warn("Failed to fetch timetable for auto-scheduling", e))
        );
      }
      if (events.length === 0) {
        prefetchTasks.push(
          api.get(`/events?semesterId=${activeSemesterId}`)
            .then(evRes => {
              if (Array.isArray(evRes.data)) {
                events = evRes.data.map((ev: any) => ({
                  title: ev.title || "Event",
                  type: ev.eventType || "academic",
                  date: ev.date ? ev.date.split('T')[0] + "T00:00:00" : "",
                  endDate: ev.endDate ? ev.endDate.split('T')[0] + "T00:00:00" : undefined
                }));
                useAttendanceStore.setState({ events });
              }
            })
            .catch(() => {})
        );
      }

      if (prefetchTasks.length > 0) {
        await Promise.allSettled(prefetchTasks);
      }

      const slots: any[] = Array.isArray(rawSlots) ? rawSlots : (rawSlots?.slots || []);
      const allEvents = [...events];

      // If both slots and events are completely empty, nothing to schedule
      if (slots.length === 0 && allEvents.length === 0) return;
      
      const pending = await LocalNotifications.getPending();
      const toCancel = pending.notifications.filter(n => isManagedTimetableNotificationId(Number(n.id)));
      if (toCancel.length > 0) {
        await LocalNotifications.cancel({ notifications: toCancel.map(n => ({ id: Number(n.id) })) });
      }

      const today = startOfDay(new Date());
      let scheduledCount = 0;
      const notificationsToSchedule: any[] = [];

      const config = useNotificationStore.getState().config;
      const reminderOffset = (config && typeof config.classReminderOffset === 'number') ? config.classReminderOffset : 10;
      const user = useAuthStore.getState().user;

      for (let i = 0; i < 14; i++) {
        const currentDay = addDays(today, i);
        
        // Note: Self Birthday notifications are dispatched as official FCM Push Notifications from the backend at 8:00 AM IST.
        // Local notification scheduling for Self Birthday is disabled to eliminate duplicate alerts.

        // Multi-day event support: check if currentDay falls anywhere within event date range
        const dayEvents = allEvents.filter(e => isEventActiveOnDate(e, currentDay));

        let isClassOff = false;
        let eventNotifIndex = 0;
        
        for (const e of dayEvents) {
          const lowerTitle = (e.title || "").toLowerCase();
          const typeLower = (e.type || e.eventType || "").toLowerCase();
          
          let eventCancelsClasses = false;
          let specialMessage = "You have an event today.";
          
          if (typeLower === 'holiday' || lowerTitle.includes('holiday')) {
            if (typeLower !== 'restricted' && typeLower !== 'restricted_holiday' && !lowerTitle.includes('restricted')) {
              eventCancelsClasses = true;
              specialMessage = "No classes scheduled! Enjoy your day off.";
            } else {
              specialMessage = "Restricted Holiday today.";
            }
          } else if (
            (!lowerTitle.includes('break') && !lowerTitle.includes('vacation')) && (
              typeLower === 'exam' || 
            lowerTitle.includes('midsem') || lowerTitle.includes('mid sem') || lowerTitle.includes('mid-sem') || lowerTitle.includes('midterm') || lowerTitle.includes('mid term') ||
            lowerTitle.includes('endsem') || lowerTitle.includes('end sem') || lowerTitle.includes('end-sem') ||
            lowerTitle.includes('exam')
          )
          ) {
            eventCancelsClasses = true;
            specialMessage = "All the best for your exams!";
          } else if (lowerTitle.includes('vacation') || lowerTitle.includes('break')) {
            eventCancelsClasses = true;
            specialMessage = "Enjoy your vacation!";
          }

          if (eventCancelsClasses) isClassOff = true;

          // 1. Handle Birthdays (Exclude public holidays with "Birthday" in the title)
          if (lowerTitle.includes("birthday") && !typeLower.includes('holiday')) {
            const notifyTime = setHours(currentDay, 9);
            if (notifyTime.getTime() > Date.now()) {
              let cleanName = (e.title || "Friend").trim();
              cleanName = cleanName
                .replace(/^(?:happy\s+)?birthday\s+of\s+/i, '')
                .replace(/^(?:happy\s+)?birthday\s+/i, '')
                .replace(/(?:'s|s)?\s*birthday.*$/i, '')
                .replace(/^(?:of\s+)/i, '')
                .trim();
              if (!cleanName) cleanName = "Friend";
              const notifId = getBirthdayNotificationId(cleanName, formatLocalDate(currentDay)) + eventNotifIndex;
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
                schedule: { at: notifyTime, allowWhileIdle: true }
              });
              scheduledCount++;
              eventNotifIndex++;
            }
            continue; 
          }

          // 2. Generic Event / Holiday Notification
          const notifyTime = setHours(currentDay, 8);
          if (notifyTime.getTime() > Date.now()) {
            const cleanHolidayName = (e.title || "Event").trim();
            const notifId = getHolidayNotificationId(formatLocalDate(currentDay)) + eventNotifIndex;
            notificationsToSchedule.push({
              id: notifId,
              title: (eventCancelsClasses || typeLower.includes('holiday') || lowerTitle.includes('holiday')) ? "\ud83c\udf89 Holiday: " + cleanHolidayName : "\ud83d\udcc6 Event: " + cleanHolidayName,
              body: specialMessage,
              largeBody: "\u2728 " + cleanHolidayName + "\n\n" + specialMessage,
              summaryText: eventCancelsClasses ? "Holiday Event" : "Calendar Event",
              smallIcon: "ic_stat_attendx",
              largeIcon: "attendx_notification_icon",
              iconColor: eventCancelsClasses ? "#10B981" : "#3B82F6", 
              channelId: "class_alerts",
              schedule: { at: notifyTime, allowWhileIdle: true }
            });
            scheduledCount++;
            eventNotifIndex++;
          }
        }

        if (isClassOff || i >= 7 || slots.length === 0) {
          continue; 
        }

        let dbDay = currentDay.getDay() - 1;
        if (dbDay === -1) dbDay = 6; 

        const daySlots = slots.filter(s => s.dayOfWeek === dbDay);
        daySlots.sort((a, b) => a.startTime.localeCompare(b.startTime));
        
        let maxEndTimeObj: Date | null = null;
        
        for (let j = 0; j < daySlots.length; j++) {
          const slot = daySlots[j];
          const prevSlot = j > 0 ? daySlots[j - 1] : null;

          const subjectName = (slot.subject?.name || slot.subject?.code || "Class").trim();
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
              if (prevEndObj.getTime() <= (standardNotifyTime.getTime() - 5 * 60 * 1000)) {
                headsUpTime = prevEndObj;
              }
            }
          }

          const timeStr = classStartObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const roomStr = (config?.showLocation && slot.room) ? slot.room.trim() : '';
          const classEndObj = endTimeStr ? parseTimeOnDate(currentDay, endTimeStr) : null;
          const calculatedEndMs = classEndObj ? classEndObj.getTime() : (classStartObj.getTime() + 60 * 60 * 1000);

          if (reminderOffset > -1) {
            if (headsUpTime && headsUpTime.getTime() > Date.now()) {
              const headsUpId = getNotificationIdForSlot(slotId, formatLocalDate(currentDay), 'headsup');
              notificationsToSchedule.push({
                id: headsUpId,
                title: `Upcoming (Heads Up): ${subjectName}`,
                body: `Starts at ${timeStr} ${roomStr ? `| ${roomStr}` : ''}`,
                largeBody: `\uD83D\uDCDA Class: ${subjectName}\n\u23F0 Time: ${timeStr} - ${endTimeStr || 'TBD'}\n\uD83D\uDCCD Room: ${roomStr || 'N/A'}\n\nHeads up: Your upcoming class starts soon. Tap below to mute your phone for this class.`,
                summaryText: "Class Reminder",
                smallIcon: "ic_stat_attendx",
                largeIcon: "attendx_notification_icon",
                iconColor: "#6366F1", 
                channelId: 'class_alerts',
                foreground: true,
                actionTypeId: 'CLASS_REMINDER_ACTIONS',
                extra: { classTitle: subjectName, endTimeStr, startTimeStr, endTimeMs: calculatedEndMs },
                schedule: { at: headsUpTime, allowWhileIdle: true }
              });
              scheduledCount++;
            }

            if (standardNotifyTime.getTime() > Date.now()) {
              const standardId = getNotificationIdForSlot(slotId, formatLocalDate(currentDay), 'standard');
              notificationsToSchedule.push({
                id: standardId,
                title: `Upcoming: ${subjectName}`,
                body: `Starts at ${timeStr} ${roomStr ? `| ${roomStr}` : ''}`,
                largeBody: `\uD83D\uDCDA Class: ${subjectName}\n\u23F0 Time: ${timeStr} - ${endTimeStr || 'TBD'}\n\uD83D\uDCCD Room: ${roomStr || 'N/A'}\n\nTap the action button below to instantly mute your phone for the duration of this class.`,
                summaryText: "Class Reminder",
                smallIcon: "ic_stat_attendx",
                largeIcon: "attendx_notification_icon",
                iconColor: "#6366F1", 
                channelId: 'class_alerts',
                foreground: true,
                actionTypeId: 'CLASS_REMINDER_ACTIONS',
                extra: { classTitle: subjectName, endTimeStr, startTimeStr, endTimeMs: calculatedEndMs },
                schedule: { at: standardNotifyTime, allowWhileIdle: true }
              });
              scheduledCount++;
            }
          }
          
          if (classEndObj && (!maxEndTimeObj || classEndObj > maxEndTimeObj)) {
            maxEndTimeObj = classEndObj;
          }
        }

        if (config?.endOfDaySummary && maxEndTimeObj && daySlots.length > 0) {
          if (maxEndTimeObj.getTime() > Date.now()) {
            let endOfDayTitle = "Done for the day!";
            let endOfDayBody = "All classes have ended. Enjoy your evening!";
            let endOfDayLargeBody = "\uD83C\uDF19 All classes for today have concluded. You can pack up and enjoy the rest of your day. See you tomorrow!";

            const tomorrow = addDays(currentDay, 1);
            const tomorrowEvents = allEvents.filter(e => isEventActiveOnDate(e, tomorrow));
            
            let tomorrowHolidayTitle: string | null = null;
            for (const e of tomorrowEvents) {
              const lowerTitle = (e.title || "").toLowerCase();
              const typeLower = (e.type || e.eventType || "").toLowerCase();
              if (typeLower === 'holiday' || typeLower === 'exam' || lowerTitle.includes('holiday') || lowerTitle.includes('exam') || lowerTitle.includes('break') || lowerTitle.includes('vacation')) {
                if (typeLower !== 'restricted' && typeLower !== 'restricted_holiday' && !lowerTitle.includes('restricted')) {
                  tomorrowHolidayTitle = e.title;
                  break;
                }
              }
            }

            const getSlotsForDay = (d: Date) => {
              let dDay = d.getDay() - 1;
              if (dDay === -1) dDay = 6;
              return slots.filter(s => s.dayOfWeek === dDay);
            };

            const tomorrowSlots = getSlotsForDay(tomorrow);
            const tomorrowIsOff = tomorrowHolidayTitle !== null || tomorrowSlots.length === 0;

            if (tomorrowHolidayTitle) {
              endOfDayLargeBody = `\u2728 All classes for today have concluded. Prepare for the upcoming ${tomorrowHolidayTitle} tomorrow!`;
              endOfDayBody = `Classes ended. Enjoy ${tomorrowHolidayTitle} tomorrow!`;
            } else if (currentDay.getDay() === 5) { // Friday
              const saturdaySlots = tomorrowSlots;
              const sunday = addDays(currentDay, 2);
              const sundaySlots = getSlotsForDay(sunday);
              const sundayEvents = allEvents.filter(e => isEventActiveOnDate(e, sunday));
              let sundayHoliday = false;
              for (const e of sundayEvents) {
                const lowerTitle = (e.title || "").toLowerCase();
                const typeLower = (e.type || e.eventType || "").toLowerCase();
                if (typeLower === 'holiday' || typeLower === 'exam' || lowerTitle.includes('holiday')) {
                  if (typeLower !== 'restricted' && typeLower !== 'restricted_holiday') sundayHoliday = true;
                }
              }
              const sundayIsOff = sundayHoliday || sundaySlots.length === 0;

              if (saturdaySlots.length === 0 && sundayIsOff) {
                endOfDayLargeBody = `\uD83C\uDF89 All classes for the week have concluded. Pack up and enjoy your weekend!`;
                endOfDayBody = `All classes ended. Enjoy the weekend!`;
              }
            } else if (currentDay.getDay() === 6 && tomorrowIsOff) { // Saturday
              endOfDayLargeBody = `\uD83C\uDF89 All classes for today have concluded. Pack up and enjoy your Sunday off!`;
              endOfDayBody = `All classes ended. Enjoy your day off tomorrow!`;
            } else if (tomorrowIsOff) {
              endOfDayLargeBody = `\uD83C\uDF19 All classes for today have concluded. Enjoy your day off tomorrow!`;
              endOfDayBody = `All classes ended. Enjoy your day off tomorrow!`;
            }

            const endOfDayId = getNotificationIdForSlot("eod", formatLocalDate(currentDay), 'endofday');

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
              channelId: 'class_alerts'
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
        if (finalId >= HOLIDAY_NOTIF_START_ID && finalId <= HOLIDAY_NOTIF_END_ID) {
          bandStart = HOLIDAY_NOTIF_START_ID;
          bandEnd = HOLIDAY_NOTIF_END_ID;
        } else if (finalId >= BIRTHDAY_NOTIF_START_ID && finalId <= BIRTHDAY_NOTIF_END_ID) {
          bandStart = BIRTHDAY_NOTIF_START_ID;
          bandEnd = BIRTHDAY_NOTIF_END_ID;
        }
        const bandSize = bandEnd - bandStart + 1;
        while (usedBatchIds.has(finalId)) {
          finalId = (((finalId - bandStart + 1) % bandSize) + bandSize) % bandSize + bandStart;
        }
        notif.id = finalId;
        usedBatchIds.add(finalId);
        dedupedBatch.push(notif);
      }

      // Single atomic schedule call over the Capacitor bridge
      if (dedupedBatch.length > 0) {
        await LocalNotifications.schedule({ notifications: dedupedBatch });
      }

      // Prune past delivered class alerts whose class has already ended today
      try {
        const delivered = await LocalNotifications.getDeliveredNotifications();
        const staleClassNotifs = delivered.notifications.filter(n => {
          const id = Number(n.id);
          if (id >= TIMETABLE_NOTIF_START_ID && id <= TIMETABLE_NOTIF_END_ID) {
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
          if (typeof LocalNotifications.removeDeliveredNotifications === 'function') {
            await LocalNotifications.removeDeliveredNotifications({ notifications: staleClassNotifs });
          }
        }
      } catch (e) {
        console.warn("Could not prune delivered class alerts:", e);
      }
      
      console.log(`Successfully scheduled ${scheduledCount} notifications for the next 7 days.`);
    } catch (err) {
      console.error("Failed to auto-schedule timetable notifications:", err);
    }
  }

  static async cancelAssignmentReminders(assignmentId: string): Promise<void> {
    if (!Capacitor.isNativePlatform() || !assignmentId) return;
    try {
      const idsToCancel = [0, 1, 2].map(idx => getAssignmentNotificationId(assignmentId, idx));
      await LocalNotifications.cancel({ notifications: idsToCancel.map(id => ({ id })) });
      try {
        const delivered = await LocalNotifications.getDeliveredNotifications();
        const deliveredToClear = delivered.notifications.filter(n => idsToCancel.includes(Number(n.id)));
        if (deliveredToClear.length > 0) {
          // @ts-ignore
          if (typeof LocalNotifications.removeDeliveredNotifications === 'function') {
            await LocalNotifications.removeDeliveredNotifications({ notifications: deliveredToClear });
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
      const toCancel = pending.notifications.filter(n => {
        const id = Number(n.id);
        return id >= ASSIGNMENT_REMINDERS_START_ID && id <= ASSIGNMENT_REMINDERS_END_ID;
      });
      if (toCancel.length > 0) {
        await LocalNotifications.cancel({ notifications: toCancel.map(n => ({ id: Number(n.id) })) });
      }

      // Read from local store first for instant, offline-safe state
      let assignments: any[] = useAssignmentStore.getState().assignments || [];
      if (assignments.length === 0) {
        try {
          const res = await api.get('/assignments');
          assignments = res.data || [];
        } catch {
          // Keep empty if offline
        }
      }

      const notifications = [];

      for (const assignment of assignments) {
        if (!assignment || (assignment.completions && assignment.completions.length > 0)) continue;
        
        const deadline = new Date(assignment.deadline);
        if (isNaN(deadline.getTime()) || deadline.getTime() <= Date.now()) continue;

        const cleanTitle = (assignment.title || "Assignment").trim();

        // Schedule cascade reminders
        const reminders = [
          { time: deadline.getTime() - 24 * 60 * 60 * 1000, title: "Assignment Due Tomorrow", text: "due tomorrow" },
          { time: deadline.getTime() - 2 * 60 * 60 * 1000, title: "Assignment Due in 2 Hours", text: "due in 2 hours" },
          { time: deadline.getTime() - 15 * 60 * 1000, title: "Assignment Due Soon", text: "due in 15 minutes!" }
        ];

        for (let remIdx = 0; remIdx < reminders.length; remIdx++) {
          const rem = reminders[remIdx];
          const remDate = new Date(rem.time);
          if (remDate.getTime() > Date.now()) {
            const notifId = getAssignmentNotificationId(assignment.id || cleanTitle, remIdx);
            notifications.push({
              id: notifId,
              title: rem.title,
              body: cleanTitle,
              largeBody: `\u23F0 Reminder: "${cleanTitle}" is ${rem.text} at ${deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
              channelId: "assignment_alerts",
              smallIcon: "ic_stat_attendx",
              largeIcon: "attendx_notification_icon",
              iconColor: "#EF4444",
              schedule: { at: remDate, allowWhileIdle: true }
            });
          }
        }
      }

      // Ensure zero internal ID collisions within the assignment batch via deterministic linear probing
      const usedAssignmentBatchIds = new Set<number>();
      const dedupedAssignmentBatch: any[] = [];
      const bandSize = ASSIGNMENT_REMINDERS_END_ID - ASSIGNMENT_REMINDERS_START_ID + 1;

      for (const notif of notifications) {
        let finalId = notif.id;
        while (usedAssignmentBatchIds.has(finalId)) {
          finalId = (((finalId - ASSIGNMENT_REMINDERS_START_ID + 1) % bandSize) + bandSize) % bandSize + ASSIGNMENT_REMINDERS_START_ID;
        }
        notif.id = finalId;
        usedAssignmentBatchIds.add(finalId);
        dedupedAssignmentBatch.push(notif);
      }

      if (dedupedAssignmentBatch.length > 0) {
        await LocalNotifications.schedule({ notifications: dedupedAssignmentBatch });
      }

      // Remove delivered notifications for assignments that are now completed or deleted
      try {
        const delivered = await LocalNotifications.getDeliveredNotifications();
        const deliveredAssignmentAlerts = delivered.notifications.filter(n => {
          const id = Number(n.id);
          return id >= ASSIGNMENT_REMINDERS_START_ID && id <= ASSIGNMENT_REMINDERS_END_ID;
        });

        if (deliveredAssignmentAlerts.length > 0) {
          const activeNotificationIds = new Set<number>();
          for (const a of assignments) {
            if (!a || (a.completions && a.completions.length > 0)) continue;
            for (let remIdx = 0; remIdx < 3; remIdx++) {
              activeNotificationIds.add(getAssignmentNotificationId(a.id || a.title, remIdx));
            }
          }

          const staleDelivered = deliveredAssignmentAlerts.filter(n => !activeNotificationIds.has(Number(n.id)));
          if (staleDelivered.length > 0) {
            // @ts-ignore
            if (typeof LocalNotifications.removeDeliveredNotifications === 'function') {
              await LocalNotifications.removeDeliveredNotifications({ notifications: staleDelivered });
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

  static async scheduleAcademicUpdates(frequency: { type: string; subValue?: string }): Promise<void> {
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
        await this._executeScheduleAcademicUpdates(this.lastAcademicFrequency || frequency);
      } while (this.hasQueuedAcademicRun);
    } finally {
      this.isSchedulingAcademic = false;
      this.hasQueuedAcademicRun = false;
    }
  }

  private static async _executeScheduleAcademicUpdates(frequency: { type: string; subValue?: string }): Promise<void> {
    try {
      const pending = await LocalNotifications.getPending();
      const toCancel = pending.notifications.filter(n => {
        const id = Number(n.id);
        return id >= ACADEMIC_UPDATES_START_ID && id <= ACADEMIC_UPDATES_END_ID;
      });
      if (toCancel.length > 0) {
        await LocalNotifications.cancel({ notifications: toCancel.map(n => ({ id: Number(n.id) })) });
      }

      const cacheState = useCacheStore.getState();
      const activeFreq = frequency || cacheState.reminderFrequency || { type: 'Weekly' };
      if (!activeFreq || activeFreq.type === 'Never') return;

      const memory = cacheState.frequencyMemory || {};
      const config = useNotificationStore.getState().config;
      const notificationsToSchedule = [];
      const now = new Date();

      let allEvents = useAttendanceStore.getState().events || [];
      const subjects = useAttendanceStore.getState().subjects || [];
      let attended = 0;
      let total = 0;
      subjects.forEach(s => { attended += (s.attended || 0); total += (s.total || 0); });
      const overallPct = total === 0 ? 100 : Math.round((attended / total) * 100);

            let cachedSlots: any[] = cacheState.timetable?.slots || [];

      // Proactively fetch events and slots if missing in memory so summaries have full context
      const activeSemId = useAttendanceStore.getState().activeSemesterId || cacheState.semester?.activeSemester?.id;
      if (activeSemId && (allEvents.length === 0 || cachedSlots.length === 0)) {
        try {
          const [evSettled, ttSettled] = await Promise.allSettled([
            allEvents.length === 0 ? api.get(`/events?semesterId=${activeSemId}`) : Promise.resolve(null),
            cachedSlots.length === 0 ? api.get(`/timetable/${activeSemId}`) : Promise.resolve(null),
          ]);
          if (evSettled.status === 'fulfilled' && evSettled.value?.data && Array.isArray(evSettled.value.data)) {
            allEvents = evSettled.value.data.map((ev: any) => ({
              title: ev.title || "Event",
              type: ev.eventType || "academic",
              date: ev.date ? ev.date.split('T')[0] + "T00:00:00" : "",
              endDate: ev.endDate ? ev.endDate.split('T')[0] + "T00:00:00" : undefined
            }));
            useAttendanceStore.setState({ events: allEvents });
          }
          if (ttSettled.status === 'fulfilled' && ttSettled.value?.data) {
            const raw = Array.isArray(ttSettled.value.data) ? ttSettled.value.data : (ttSettled.value.data?.slots || []);
            if (raw.length > 0) {
              cachedSlots = raw;
              useCacheStore.getState().setTimetable({ slots: raw });
            }
          }
        } catch (_) {}
      }

      // Independent, distinct delivery times for each summary tier
      const dailyTime = config?.dailySummaryTime || config?.summaryTime || "18:00";
      const weeklyTime = config?.weeklySummaryTime || "18:00";
      const monthlyTime = config?.monthlySummaryTime || "19:00";

      // 1. Daily Academic Briefings: scheduled for the next 7 days at dailyTime
      const dailyDates = calculateNextSummaryDates({ type: 'Daily' }, dailyTime, now);
      for (let i = 0; i < dailyDates.length; i++) {
        const notifyDate = dailyDates[i];
        const isMorningBriefing = notifyDate.getHours() < 14;
        const targetDay = isMorningBriefing ? notifyDate : addDays(notifyDate, 1);
        const dayLabel = isMorningBriefing ? "Today" : "Tomorrow";
        const dayLabelPossessive = isMorningBriefing ? "Today's" : "Tomorrow's";
        const dayLabelLower = isMorningBriefing ? "today" : "tomorrow";

        const targetEvents = allEvents.filter(e => isEventActiveOnDate(e, targetDay));
        let targetHolidayTitle: string | null = null;
        for (const e of targetEvents) {
          const lowerTitle = (e.title || "").toLowerCase();
          const typeLower = (e.type || e.eventType || "").toLowerCase();
          if (typeLower === 'holiday' || typeLower === 'exam' || lowerTitle.includes('holiday') || lowerTitle.includes('break') || lowerTitle.includes('vacation')) {
            if (typeLower !== 'restricted' && typeLower !== 'restricted_holiday' && !lowerTitle.includes('restricted')) {
              targetHolidayTitle = e.title;
              break;
            }
          }
        }

        let dbTargetDay = targetDay.getDay() === 0 ? 6 : targetDay.getDay() - 1;
        const targetSlots = cachedSlots.filter((s: any) => s.dayOfWeek === dbTargetDay);
        const targetHasClasses = targetSlots.length > 0 && !targetHolidayTitle;

        let title = "Tomorrow's Briefing";
        let body = "You have classes coming up tomorrow.";
        let largeBody = "🎒 Prepare for Tomorrow\n\nYou have classes scheduled. Tap to review your timetable, check for assignments, and pack your bag!";

        if (targetHolidayTitle) {
          title = `${dayLabel}: ${targetHolidayTitle}`;
          body = `No regular classes scheduled ${dayLabelLower} for ${targetHolidayTitle}. Enjoy your day off!`;
          largeBody = `✨ ${dayLabelPossessive} Briefing\n\n${dayLabel} is ${targetHolidayTitle}! No regular classes are scheduled. Enjoy your day!`;
        } else if (!targetHasClasses) {
          title = `${dayLabelPossessive} Briefing: Day Off`;
          body = `No classes scheduled for ${dayLabelLower}. Take some time to relax or catch up on studies!`;
          largeBody = `🎒 ${dayLabelPossessive} Briefing\n\nYou have no classes scheduled for ${dayLabelLower}. Enjoy your day off or review your coursework!`;
        } else {
          title = `${dayLabelPossessive} Briefing`;
          body = `You have ${targetSlots.length} class${targetSlots.length === 1 ? '' : 'es'} scheduled ${dayLabelLower}.`;
          largeBody = `🎒 Prepare for ${dayLabel}\n\nYou have ${targetSlots.length} class${targetSlots.length === 1 ? '' : 'es'} scheduled ${dayLabelLower}. Tap to review your schedule!`;
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
          schedule: { at: notifyDate, allowWhileIdle: true }
        });
      }

      // 2. Weekly Academic Review: scheduled for the next 4 weeks at weeklyTime on chosen weekly day
      const weeklyDay = memory.Weekly || (activeFreq.type === 'Weekly' ? activeFreq.subValue : 'Sun') || 'Sun';
      const weeklyDates = calculateNextSummaryDates({ type: 'Weekly', subValue: weeklyDay }, weeklyTime, now);
      for (let i = 0; i < weeklyDates.length; i++) {
        const notifyDate = weeklyDates[i];
        const endOfWeekDay = addDays(notifyDate, -1);
        const startOfWeekDay = addDays(endOfWeekDay, -6);
        const weekEvents = allEvents.filter(e => {
          if (!e.date) return false;
          const start = parseLocalDate(e.date);
          const end = e.endDate ? parseLocalDate(e.endDate) : start;
          return start.getTime() <= endOfWeekDay.getTime() && end.getTime() >= startOfWeekDay.getTime();
        });
        let largeBody = "📅 Weekly Review\n\nTake a look back at your attendance performance this week and plan ahead for the upcoming week.";
        if (weekEvents.some(e => (e.eventType || e.type || "").toLowerCase() === "holiday" || (e.title || "").toLowerCase().includes("holiday"))) {
          largeBody = "📅 Weekly Review\n\nIt was a short week with some holidays! Check how your attendance was impacted and review your targets.";
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
          schedule: { at: notifyDate, allowWhileIdle: true }
        });
      }

      // 3. Monthly Attendance Summary: scheduled for the next 3 months at monthlyTime on chosen monthly day
      const monthlyDay = memory.Monthly || (activeFreq.type === 'Monthly' ? activeFreq.subValue : '1') || '1';
      const monthlyDates = calculateNextSummaryDates({ type: 'Monthly', subValue: monthlyDay }, monthlyTime, now);
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
          schedule: { at: notifyDate, allowWhileIdle: true }
        });
      }

      if (notificationsToSchedule.length > 0) {
        await LocalNotifications.schedule({ notifications: notificationsToSchedule });
      }

    } catch (error) {
      console.error("Failed to schedule academic updates:", error);
    }
  }

  static async cancelAll(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      if (typeof LocalNotifications.cancelAll === 'function') {
        await LocalNotifications.cancelAll();
      } else {
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
          await LocalNotifications.cancel({
            notifications: pending.notifications.map(n => ({ id: Number(n.id) }))
          });
        }
      }
      try {
        if (typeof LocalNotifications.removeAllDeliveredNotifications === 'function') {
          await LocalNotifications.removeAllDeliveredNotifications();
        }
      } catch (e) {
        console.warn("Could not remove delivered notifications on cancelAll:", e);
      }
      setScheduledUnmuteTime(null);
      console.log("All local notifications and delivered alerts purged successfully.");
    } catch (e) {
      console.error("Failed to cancel all notifications:", e);
    }
  }

  static async triggerTestAcademicSummaryNotification(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      let perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        perm = await LocalNotifications.requestPermissions();
        if (perm.display !== 'granted') return false;
      }

      const subjects = useAttendanceStore.getState().subjects || [];
      let attended = 0;
      let total = 0;
      subjects.forEach(s => { attended += (s.attended || 0); total += (s.total || 0); });
      const overallPct = total === 0 ? 100 : Math.round((attended / total) * 100);

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
            schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true },
          }
        ]
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
      const { testMuteNotification } = await import('../lib/ringer');
      return await testMuteNotification();
    } catch (e) {
      console.error("Failed to trigger test mute notification", e);
      return false;
    }
  }
}




