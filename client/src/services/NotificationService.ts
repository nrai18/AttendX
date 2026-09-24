import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { mutePhone, unmutePhone, checkAndReconcileRinger, setScheduledUnmuteTime, PERMISSION_WARNING_NOTIF_ID } from '../lib/ringer';
import { useAttendanceStore } from '../stores/attendanceStore';
import { useAssignmentStore } from '../stores/assignmentStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useCacheStore } from '../stores/cacheStore';
import { api } from '../lib/api';
import { toast } from 'sonner';
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
      const candidate = setMinutes(setHours(addDays(today, i), summaryHour), summaryMinute);
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

    const todayCandidate = setMinutes(setHours(firstTargetDay, summaryHour), summaryMinute);
    if (todayCandidate.getTime() <= now.getTime()) {
      firstTargetDay = addDays(firstTargetDay, 7);
    }

    for (let i = 0; i < 4; i++) {
      const weeklyDate = setMinutes(setHours(addDays(firstTargetDay, i * 7), summaryHour), summaryMinute);
      results.push(weeklyDate);
    }
  } else if (frequency.type === 'Monthly') {
    const rawTargetDay = parseInt(frequency.subValue || "1", 10);
    const targetDay = isNaN(rawTargetDay) ? 1 : rawTargetDay;
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const currentMonthClamped = clampDateToMonth(currentYear, currentMonth, targetDay);
    const currentCandidate = setMinutes(setHours(currentMonthClamped, summaryHour), summaryMinute);

    const startMonthOffset = currentCandidate.getTime() > now.getTime() ? 0 : 1;

    for (let i = 0; i < 3; i++) {
      const targetMonthIndex = currentMonth + startMonthOffset + i;
      const monthRef = new Date(currentYear, targetMonthIndex, 1);
      const year = monthRef.getFullYear();
      const month = monthRef.getMonth();
      const clampedDate = clampDateToMonth(year, month, targetDay);
      results.push(setMinutes(setHours(clampedDate, summaryHour), summaryMinute));
    }
  } else if (frequency.type === 'Yearly') {
    const monthNames: Record<string, number> = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };
    const targetMonth = (frequency.subValue && monthNames[frequency.subValue] !== undefined)
      ? monthNames[frequency.subValue]
      : 0;
    const targetDay = 1;
    const currentYear = now.getFullYear();
    const clampedDate = clampDateToMonth(currentYear, targetMonth, targetDay);
    const candidate = setMinutes(setHours(clampedDate, summaryHour), summaryMinute);
    if (candidate.getTime() > now.getTime()) {
      results.push(candidate);
    } else {
      const nextYearClamped = clampDateToMonth(currentYear + 1, targetMonth, targetDay);
      results.push(setMinutes(setHours(nextYearClamped, summaryHour), summaryMinute));
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

  static async checkPermissions(): Promise<'prompt' | 'prompt-with-rationale' | 'granted' | 'denied'> {
    if (!Capacitor.isNativePlatform()) return 'granted';
    try {
      const perm = await LocalNotifications.checkPermissions();
      return perm.display;
    } catch {
      return 'denied';
    }
  }

  static async requestPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return true;
    try {
      let perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        perm = await LocalNotifications.requestPermissions();
      }
      return perm.display === 'granted';
    } catch (e) {
      console.warn("Failed to request notification permissions:", e);
      return false;
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
        importance: 2, // Low importance: strictly silent, no audio chime when phone goes on silent
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
                title: '🔊 Unmute Phone',
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
                title: '🔕 Mute Phone for Class',
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
          try {
            const perm = await LocalNotifications.checkPermissions();
            if (perm.display === 'granted') {
              this.autoScheduleFromTimetable().catch(() => {});
              this.scheduleAssignmentReminders().catch(() => {});
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
              toast.success("Phone unmuted manually.");
            }
          } else if (action.actionId === 'MUTE_ACTION') {
            const { classTitle, endTimeStr, startTimeStr } = action.notification.extra || {};
            
            let endTime = new Date();
            let classEnded = false;

            if (endTimeStr) {
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
              toast.info("This class has already ended.");
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
            const success = await mutePhone(endTime.getTime());
            if (!success) {
              toast.error("Failed to mute phone. DND Permission missing.");
              return;
            }

            toast.success("Phone muted for class.");
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

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title: type === 'headsup' ? `Upcoming (Heads Up): ${cleanTitle}` : `Upcoming: ${cleanTitle}`,
            body: `Starts at ${timeStr} ${location ? `| ${location.trim()}` : ''}`,
            largeBody: `📚 Class: ${cleanTitle}\n⏰ Time: ${timeStr} - ${endTimeStr || 'TBD'}\n📍 Room: ${location ? location.trim() : 'N/A'}\n\nTap the action button below to instantly mute your phone for the duration of this class.`,
            summaryText: "Class Reminder",
            smallIcon: "ic_stat_adobe",
            iconColor: "#6366F1", 
            channelId: 'class_alerts',
            foreground: true,
            actionTypeId: 'CLASS_REMINDER_ACTIONS',
            extra: { classTitle: cleanTitle, endTimeStr, startTimeStr: timeStr },
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

      await LocalNotifications.schedule({
        notifications: [
          {
            id: PINNED_MUTE_NOTIF_ID,
            title: `Class in Session`,
            body: `Phone is silenced until ${timeStr}`,
            largeBody: `🔕 Current Class: ${cleanClassName}\n\nYour phone has been manually muted via AttendX. It will restore to normal volume automatically at ${timeStr}, or you can unmute manually below.`,
            summaryText: "Do Not Disturb Active",
            smallIcon: "ic_stat_adobe",
            iconColor: "#EF4444", 
            channelId: 'silent_mode',
            ongoing: true,
            autoCancel: false,
            actionTypeId: 'CLASS_SILENT_ACTIONS',
            schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true }
          }
        ]
      });

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
            largeBody: "✨ " + cleanHolidayName + "\n\n" + customMessage,
            summaryText: "Holiday Event",
            smallIcon: "ic_stat_adobe",
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
            largeBody: `🎂 It's ${cleanName}'s birthday today!\n\nDon't forget to send them your best wishes and make their day special!`,
            summaryText: "Birthday Event",
            smallIcon: "ic_stat_adobe",
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
      if (!activeSemesterId) return;

      console.log("Auto-scheduling local notifications for upcoming classes and events...");

      let rawSlots: any = useCacheStore.getState().timetable?.slots;
      if (!rawSlots) {
        try {
          const res = await api.get(`/timetable/${activeSemesterId}`);
          rawSlots = res.data;
        } catch (e) {
          console.error("Failed to fetch timetable for auto-scheduling", e);
        }
      }
      const slots: any[] = Array.isArray(rawSlots) ? rawSlots : (rawSlots?.slots || []);
      if (slots.length === 0) return;

      const events = useAttendanceStore.getState().events || [];
      const allEvents = [...events];
      
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

      for (let i = 0; i < 7; i++) {
        const currentDay = addDays(today, i);
        
        // Multi-day event support: check if currentDay falls anywhere within event date range
        const dayEvents = allEvents.filter(e => isEventActiveOnDate(e, currentDay));

        let isClassOff = false;
        let specialTitle: string | undefined = undefined;
        let specialMessage: string | undefined = undefined;
        
        for (const e of dayEvents) {
          const lowerTitle = (e.title || "").toLowerCase();
          const typeLower = (e.type || e.eventType || "").toLowerCase();
          
          if (typeLower === 'holiday' || lowerTitle.includes('holiday')) {
            if (typeLower !== 'restricted' && typeLower !== 'restricted_holiday' && !lowerTitle.includes('restricted')) {
              isClassOff = true;
              specialTitle = e.title;
              specialMessage = "No classes scheduled! Enjoy your day off.";
            }
          } else if (
            typeLower === 'exam' || 
            lowerTitle.includes('midsem') || lowerTitle.includes('mid sem') || lowerTitle.includes('mid-sem') || lowerTitle.includes('midterm') || lowerTitle.includes('mid term') ||
            lowerTitle.includes('endsem') || lowerTitle.includes('end sem') || lowerTitle.includes('end-sem') ||
            lowerTitle.includes('exam')
          ) {
            isClassOff = true;
            specialTitle = e.title;
            specialMessage = "All the best for your exams!";
          } else if (lowerTitle.includes('vacation') || lowerTitle.includes('break')) {
            isClassOff = true;
            specialTitle = e.title;
            specialMessage = "Enjoy your midsem/endsem vacation!";
          }
        }

        const birthdayEvent = dayEvents.find(e => (e.title || "").toLowerCase().includes("birthday"));

        if (isClassOff && specialTitle) {
          const notifyTime = setHours(currentDay, 8);
          if (notifyTime.getTime() > Date.now()) {
            const cleanHolidayName = (specialTitle || "Holiday").trim();
            const notifId = getHolidayNotificationId(formatLocalDate(currentDay));
            notificationsToSchedule.push({
              id: notifId,
              title: cleanHolidayName.toLowerCase().includes("holiday") ? "Holiday Today: " + cleanHolidayName : "Event Today: " + cleanHolidayName,
              body: specialMessage || "No classes scheduled! Enjoy your day off.",
              largeBody: "✨ " + cleanHolidayName + "\n\n" + (specialMessage || "No classes scheduled! Enjoy your day off."),
              summaryText: "Holiday Event",
              smallIcon: "ic_stat_adobe",
              iconColor: "#10B981", 
              channelId: "class_alerts",
              schedule: { at: notifyTime, allowWhileIdle: true }
            });
            scheduledCount++;
          }
          continue; 
        }

        if (birthdayEvent) {
          const notifyTime = setHours(currentDay, 9);
          if (notifyTime.getTime() > Date.now()) {
            let cleanName = (birthdayEvent.title || "Friend").trim();
            cleanName = cleanName
              .replace(/^(?:happy\s+)?birthday\s+of\s+/i, '')
              .replace(/^(?:happy\s+)?birthday\s+/i, '')
              .replace(/(?:'s|s)?\s*birthday.*$/i, '')
              .replace(/^(?:of\s+)/i, '')
              .trim();
            if (!cleanName) cleanName = "Friend";
            const notifId = getBirthdayNotificationId(cleanName, formatLocalDate(currentDay));
            notificationsToSchedule.push({
              id: notifId,
              title: "Happy Birthday!",
              body: `Wish ${cleanName} a great birthday today!`,
              largeBody: `🎂 It's ${cleanName}'s birthday today!\n\nDon't forget to send them your best wishes and make their day special!`,
              summaryText: "Birthday Event",
              smallIcon: "ic_stat_adobe",
              iconColor: "#F59E0B", 
              channelId: "class_alerts",
              schedule: { at: notifyTime, allowWhileIdle: true }
            });
            scheduledCount++;
          }
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
              if (prevEndObj.getTime() >= (classStartObj.getTime() - 60 * 60 * 1000) && prevEndObj.getTime() <= (standardNotifyTime.getTime() - 5 * 60 * 1000)) {
                headsUpTime = prevEndObj;
              }
            }
          }

          const timeStr = classStartObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const roomStr = (config?.showLocation && slot.room) ? slot.room.trim() : '';

          if (headsUpTime && headsUpTime.getTime() > Date.now()) {
            const headsUpId = getNotificationIdForSlot(slotId, formatLocalDate(currentDay), 'headsup');
            notificationsToSchedule.push({
              id: headsUpId,
              title: `Upcoming (Heads Up): ${subjectName}`,
              body: `Starts at ${timeStr} ${roomStr ? `| ${roomStr}` : ''}`,
              largeBody: `📚 Class: ${subjectName}\n⏰ Time: ${timeStr} - ${endTimeStr || 'TBD'}\n📍 Room: ${roomStr || 'N/A'}\n\nTap the action button below to instantly mute your phone for the duration of this class.`,
              summaryText: "Class Reminder",
              smallIcon: "ic_stat_adobe",
              iconColor: "#6366F1", 
              channelId: 'class_alerts',
              foreground: true,
              actionTypeId: 'CLASS_REMINDER_ACTIONS',
              extra: { classTitle: subjectName, endTimeStr, startTimeStr },
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
              largeBody: `📚 Class: ${subjectName}\n⏰ Time: ${timeStr} - ${endTimeStr || 'TBD'}\n📍 Room: ${roomStr || 'N/A'}\n\nTap the action button below to instantly mute your phone for the duration of this class.`,
              summaryText: "Class Reminder",
              smallIcon: "ic_stat_adobe",
              iconColor: "#6366F1", 
              channelId: 'class_alerts',
              foreground: true,
              actionTypeId: 'CLASS_REMINDER_ACTIONS',
              extra: { classTitle: subjectName, endTimeStr, startTimeStr },
              schedule: { at: standardNotifyTime, allowWhileIdle: true }
            });
            scheduledCount++;
          }
          
          if (endTimeStr) {
            const classEndObj = parseTimeOnDate(currentDay, endTimeStr);
            if (classEndObj && (!maxEndTimeObj || classEndObj > maxEndTimeObj)) {
              maxEndTimeObj = classEndObj;
            }
          }
        }

        if (config?.endOfDaySummary && maxEndTimeObj && daySlots.length > 0) {
          if (maxEndTimeObj.getTime() > Date.now()) {
            let endOfDayTitle = "Done for the day!";
            let endOfDayBody = "All classes have ended. Enjoy your evening!";
            let endOfDayLargeBody = "🌙 All classes for today have concluded. You can pack up and enjoy the rest of your day. See you tomorrow!";

            const tomorrow = addDays(currentDay, 1);
            const tomorrowEvents = allEvents.filter(e => isEventActiveOnDate(e, tomorrow));
            
            let tomorrowHolidayTitle: string | null = null;
            for (const e of tomorrowEvents) {
              const lowerTitle = (e.title || "").toLowerCase();
              const typeLower = (e.type || e.eventType || "").toLowerCase();
              if (typeLower === 'holiday' || typeLower === 'exam' || lowerTitle.includes('holiday') || lowerTitle.includes('exam') || lowerTitle.includes('fest') || lowerTitle.includes('break') || lowerTitle.includes('vacation')) {
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
              endOfDayLargeBody = `✨ All classes for today have concluded. Prepare for the upcoming ${tomorrowHolidayTitle} tomorrow!`;
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
                endOfDayLargeBody = `🎉 All classes for the week have concluded. Pack up and enjoy your weekend!`;
                endOfDayBody = `All classes ended. Enjoy the weekend!`;
              }
            } else if (currentDay.getDay() === 6 && tomorrowIsOff) { // Saturday
              endOfDayLargeBody = `🎉 All classes for today have concluded. Pack up and enjoy your Sunday off!`;
              endOfDayBody = `All classes ended. Enjoy your day off tomorrow!`;
            } else if (tomorrowIsOff) {
              endOfDayLargeBody = `🌙 All classes for today have concluded. Enjoy your day off tomorrow!`;
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
              smallIcon: "ic_stat_adobe",
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
              largeBody: `⏰ Reminder: "${cleanTitle}" is ${rem.text} at ${deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
              channelId: "assignment_alerts",
              smallIcon: "ic_stat_adobe",
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

      if (!frequency || frequency.type === 'Never') return;

      const config = useNotificationStore.getState().config;
      const scheduledDates = calculateNextSummaryDates(frequency, config?.summaryTime || "18:00", new Date());
      const notificationsToSchedule = [];

      const allEvents = useAttendanceStore.getState().events || [];
      const subjects = useAttendanceStore.getState().subjects || [];
      let attended = 0;
      let total = 0;
      subjects.forEach(s => { attended += (s.attended || 0); total += (s.total || 0); });
      const overallPct = total === 0 ? 100 : Math.round((attended / total) * 100);

      const cachedSlots: any[] = useCacheStore.getState().timetable?.slots || [];

      for (let i = 0; i < scheduledDates.length; i++) {
        const notifyDate = scheduledDates[i];
        let id = ACADEMIC_UPDATES_START_ID + i;
        let title = "Tomorrow's Briefing";
        let body = "You have classes coming up tomorrow.";
        let largeBody = "🎒 Prepare for Tomorrow\n\nYou have classes scheduled. Tap to review your timetable, check for assignments, and pack your bag!";

        if (frequency.type === 'Daily') {
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
            if (typeLower === 'holiday' || typeLower === 'exam' || lowerTitle.includes('holiday') || lowerTitle.includes('fest') || lowerTitle.includes('break') || lowerTitle.includes('vacation')) {
              if (typeLower !== 'restricted' && typeLower !== 'restricted_holiday' && !lowerTitle.includes('restricted')) {
                targetHolidayTitle = e.title;
                break;
              }
            }
          }

          let dbTargetDay = targetDay.getDay() === 0 ? 6 : targetDay.getDay() - 1;
          const targetSlots = cachedSlots.filter((s: any) => s.dayOfWeek === dbTargetDay);
          const targetHasClasses = targetSlots.length > 0 && !targetHolidayTitle;

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
        } else if (frequency.type === 'Weekly') {
          id = 8810 + i;
          title = "Weekly Summary";
          body = "Weekly Review: See how you did this past week!";
          const endOfWeekDay = addDays(notifyDate, -1);
          const startOfWeekDay = addDays(endOfWeekDay, -6);
          const weekEvents = allEvents.filter(e => {
            if (!e.date) return false;
            const start = parseLocalDate(e.date);
            const end = e.endDate ? parseLocalDate(e.endDate) : start;
            return start.getTime() <= endOfWeekDay.getTime() && end.getTime() >= startOfWeekDay.getTime();
          });
          largeBody = "📅 Weekly Review\n\nTake a look back at your attendance performance this week and plan ahead for the upcoming week.";
          if (weekEvents.some(e => (e.eventType || e.type || "").toLowerCase() === "holiday" || (e.title || "").toLowerCase().includes("holiday"))) {
            largeBody = "📅 Weekly Review\n\nIt was a short week with some holidays! Check how your attendance was impacted and review your targets.";
          }
        } else if (frequency.type === 'Monthly') {
          id = 8820 + i;
          title = "Monthly Attendance Summary";
          body = "Your monthly review is ready! See how well you did this month.";
          largeBody = `📈 Monthly Summary\n\nYour overall attendance is currently at ${overallPct}%. Tap to see your detailed breakdown and performance across all subjects.`;
        } else if (frequency.type === 'Yearly') {
          id = 8830 + i;
          title = "Yearly Attendance Summary";
          body = "Your annual academic attendance recap is ready.";
          largeBody = `🎓 Yearly Summary\n\nYour overall cumulative attendance is at ${overallPct}%. Tap to review your attendance performance across all semesters.`;
        }

        notificationsToSchedule.push({
          id,
          title,
          body,
          largeBody,
          summaryText: "Academic Update",
          smallIcon: "ic_stat_adobe",
          iconColor: "#3B82F6",
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
}



