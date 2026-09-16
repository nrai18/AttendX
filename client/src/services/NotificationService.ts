import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { mutePhone, unmutePhone, checkAndReconcileRinger, setScheduledUnmuteTime } from '../lib/ringer';
import { useAttendanceStore } from '../stores/attendanceStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useCacheStore } from '../stores/cacheStore';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { parse, addMinutes, setHours, setMinutes, startOfDay, addDays, isSameDay } from 'date-fns';

/**
 * Clamps a target day-of-month to the maximum number of days in the specified month,
 * preventing month rollover bugs (e.g. Feb 31 -> Feb 28/29, Apr 31 -> Apr 30).
 */
export function clampDateToMonth(year: number, monthIndex: number, targetDay: number): Date {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const clampedDay = Math.min(Math.max(1, targetDay), daysInMonth);
  return new Date(year, monthIndex, clampedDay);
}

/**
 * Deterministic string-to-positive-integer hash function.
 */
export function hashStringToNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Deterministic notification ID generator for timetable slots.
 * Guaranteed in band: 100000..899999.
 */
export function getNotificationIdForSlot(
  slotId: string,
  dayOrDate: string | number,
  type: 'standard' | 'headsup' | 'endofday' = 'standard'
): number {
  const hash = hashStringToNumber(`${slotId}_${dayOrDate}_${type}`);
  return 100000 + (hash % 800000);
}

/**
 * Deterministic notification ID generator by band category.
 */
export function getNotificationIdBand(
  type: 'timetable' | 'summary' | 'morning' | 'threshold' | 'pinned' | 'holiday' | 'birthday' | 'assignment' | 'permission',
  key?: string
): number {
  switch (type) {
    case 'permission':
      return 8080;
    case 'morning':
      return 8800;
    case 'pinned':
      return 8888;
    case 'threshold':
      return 8900;
    case 'assignment':
      return 9000 + (key ? hashStringToNumber(key) % 1000 : 0);
    case 'holiday':
      return 70000 + (key ? hashStringToNumber(key) % 1000 : 0);
    case 'birthday':
      return 71000 + (key ? hashStringToNumber(key) % 1000 : 0);
    case 'summary':
      return 90000 + (key ? hashStringToNumber(key) % 1000 : 0);
    case 'timetable':
    default:
      return 100000 + (key ? hashStringToNumber(key) % 800000 : 0);
  }
}

/**
 * Identifies whether a notification ID belongs to the managed set that
 * autoScheduleFromTimetable() is responsible for re-synchronizing.
 */
export function isManagedNotificationId(id: number): boolean {
  return (
    id >= 100000 ||
    (id >= 70000 && id <= 71999) ||
    id === 8800 ||
    id === 8900
  );
}

/**
 * Pure calculation for academic summary dates across Daily, Weekly, and Monthly frequencies.
 * Fixes the week 0 skip bug and the 31st month overflow bug.
 */
export function calculateNextSummaryDates(
  frequency: { type: string; subValue?: string },
  summaryTimeStr: string = "18:00",
  now: Date = new Date()
): Date[] {
  let [summaryHour, summaryMinute] = [18, 0];
  if (summaryTimeStr) {
    const parts = summaryTimeStr.split(":");
    summaryHour = parseInt(parts[0], 10) || 18;
    summaryMinute = parseInt(parts[1], 10) || 0;
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
    const targetDay = frequency.subValue && daysMap[frequency.subValue] !== undefined ? daysMap[frequency.subValue] : 1;

    let firstTargetDay = today;
    while (firstTargetDay.getDay() !== targetDay) {
      firstTargetDay = addDays(firstTargetDay, 1);
    }

    // If target day is today but the notification time has already elapsed,
    // advance firstTargetDay to next week (strictly 7 days later).
    const todayCandidate = setMinutes(setHours(firstTargetDay, summaryHour), summaryMinute);
    if (todayCandidate.getTime() <= now.getTime()) {
      firstTargetDay = addDays(firstTargetDay, 7);
    }

    // Schedule next 4 consecutive weekly summaries spaced by exactly 7 days
    for (let i = 0; i < 4; i++) {
      const weeklyDate = setMinutes(setHours(addDays(firstTargetDay, i * 7), summaryHour), summaryMinute);
      results.push(weeklyDate);
    }
  } else if (frequency.type === 'Monthly') {
    const targetDay = parseInt(frequency.subValue || "1", 10);
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Check if the current month's occurrence has already passed
    const currentMonthClamped = clampDateToMonth(currentYear, currentMonth, targetDay);
    const currentMonthCandidate = setMinutes(setHours(currentMonthClamped, summaryHour), summaryMinute);

    const startMonthOffset = currentMonthCandidate.getTime() > now.getTime() ? 0 : 1;

    for (let i = 0; i < 3; i++) {
      const targetMonthIndex = currentMonth + startMonthOffset + i;
      const monthRef = new Date(currentYear, targetMonthIndex, 1);
      const year = monthRef.getFullYear();
      const month = monthRef.getMonth();
      const clampedDate = clampDateToMonth(year, month, targetDay);
      results.push(setMinutes(setHours(clampedDate, summaryHour), summaryMinute));
    }
  } else if (frequency.type === 'Yearly') {
    const targetDay = parseInt(frequency.subValue || "1", 10);
    const currentYear = now.getFullYear();
    const clampedDate = clampDateToMonth(currentYear, 0, targetDay);
    const candidate = setMinutes(setHours(clampedDate, summaryHour), summaryMinute);
    if (candidate.getTime() > now.getTime()) {
      results.push(candidate);
    } else {
      const nextYearClamped = clampDateToMonth(currentYear + 1, 0, targetDay);
      results.push(setMinutes(setHours(nextYearClamped, summaryHour), summaryMinute));
    }
  }

  return results;
}

export class NotificationService {
  private static isInitialized = false;

  static async init() {
    if (!Capacitor.isNativePlatform() || this.isInitialized) return;
    
    // Request basic permissions and inspect result
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      perm = await LocalNotifications.requestPermissions();
    }
    if (perm.display !== 'granted') {
      console.warn("LocalNotifications display permission is not granted:", perm.display);
    }

    // Check exact alarm permission on Android 12+
    try {
      if (typeof (LocalNotifications as any).checkExactNotificationSetting === 'function') {
        const exactSetting = await (LocalNotifications as any).checkExactNotificationSetting();
        if (exactSetting && exactSetting.exact_alarm === 'denied') {
          console.warn("Exact notification alarms are disabled. Alarms may be delayed in Doze mode.");
        }
      }
    } catch (err) {
      console.warn("Unable to check exact notification setting:", err);
    }

    // Create premium notification channels
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
      importance: 3, 
      visibility: 1, 
      lights: false,
      vibration: false,
    });

    await LocalNotifications.createChannel({
      id: 'academic_briefings',
      name: 'Academic Summaries',
      description: 'Daily and weekly briefing summaries and schedules.',
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
      description: 'Administrative warnings and missing device permission prompts.',
      importance: 4,
      visibility: 1,
      lights: true,
      lightColor: '#F59E0B',
      vibration: true,
    });

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

    // Reconcile ringer on startup
    await checkAndReconcileRinger();

    // Reconcile ringer when app returns to foreground from background
    try {
      CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
        if (isActive) {
          await checkAndReconcileRinger();
        }
      });
    } catch (e) {
      console.warn("Could not register appStateChange listener:", e);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        checkAndReconcileRinger().catch(() => {});
      });
    }

    // Listen for unmute/mute actions and notification taps
    LocalNotifications.addListener('localNotificationActionPerformed', async (action) => {
      // Tap on the notification body itself (or if it's explicitly the update open action)
      if (action.actionId === 'tap' || action.actionId === 'ACADEMIC_UPDATE_OPEN') {
        const id = Number(action.notification.id);
        // Summary series (90000..90999 or legacy 8800..8829) and threshold alert (8900)
        if ((id >= 90000 && id <= 90999) || (id >= 8801 && id < 8900) || id === 8900) {
           window.location.href = '/report';
           return;
        }
        // Timetable classes (>= 100000) or morning agenda (8800)
        if (id >= 100000 || id === 8800) {
           window.location.href = '/today';
           return;
        }
        // Assignment reminders
        if (id >= 9000 && id <= 9999) {
           window.location.href = '/assignments';
           return;
        }
      }
      if (action.actionId === 'UNMUTE_ACTION') {
        const success = await unmutePhone();
        if (success) {
           await LocalNotifications.cancel({ notifications: [{ id: 8888 }] });
           toast.success("Phone unmuted manually.");
        }
      } else if (action.actionId === 'MUTE_ACTION') {
        const { classTitle, endTimeStr } = action.notification.extra || {};
        
        let endTime = new Date();
        if (endTimeStr) {
          const parsed = parse(endTimeStr, "HH:mm", new Date());
          endTime = setMinutes(setHours(new Date(), parsed.getHours()), parsed.getMinutes());
          if (endTime.getTime() <= Date.now()) {
            endTime = addMinutes(new Date(), 30);
          }
        } else {
          endTime = addMinutes(new Date(), 60);
        }

        // Try muting
        const success = await mutePhone(endTime.getTime());
        if (!success) {
           toast.error("Failed to mute phone. DND Permission missing.");
           return;
        }

        toast.success("Phone muted for class.");
        await this.triggerPinnedClassMute(classTitle || "Class", endTime);
      }
    });

    this.isInitialized = true;
  }

  static async checkPermissionStatus(): Promise<{ display: boolean; exactAlarm: boolean }> {
    if (!Capacitor.isNativePlatform()) {
      return { display: true, exactAlarm: true };
    }
    try {
      const perm = await LocalNotifications.checkPermissions();
      let exactAlarm = true;
      if (typeof (LocalNotifications as any).checkExactNotificationSetting === 'function') {
        const exactSetting = await (LocalNotifications as any).checkExactNotificationSetting();
        exactAlarm = exactSetting?.exact_alarm !== 'denied';
      }
      return {
        display: perm.display === 'granted',
        exactAlarm,
      };
    } catch (err) {
      console.error("Failed to check permission status:", err);
      return { display: false, exactAlarm: false };
    }
  }

  static async waitForStoreHydration(timeoutMs: number = 2000): Promise<boolean> {
    if (useAttendanceStore.getState()._hasHydrated) return true;

    return new Promise<boolean>((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          unsub();
          resolve(useAttendanceStore.getState()._hasHydrated);
        }
      }, timeoutMs);

      const unsub = useAttendanceStore.subscribe((state) => {
        if (state._hasHydrated && !resolved) {
          resolved = true;
          clearTimeout(timer);
          unsub();
          resolve(true);
        }
      });
    });
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
    const timeStr = actualStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (!Capacitor.isNativePlatform()) return;
    const notifId = getNotificationIdForSlot(slotId, actualStartTime.toISOString().slice(0, 10), type);
    
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notifId,
          title: `Upcoming: ${classTitle}`,
          body: `Starts at ${timeStr} ${location ? `| ${location}` : ''}`,
          largeBody: `📚 Class: ${classTitle}\n⏰ Time: ${timeStr} - ${endTimeStr || 'TBD'}\n📍 Room: ${location || 'N/A'}\n\nTap the action button below to instantly mute your phone for the duration of this class.`,
          summaryText: "Class Reminder",
          smallIcon: "ic_stat_adobe",
          iconColor: "#6366F1", 
          channelId: 'class_alerts',
          foreground: true,
          actionTypeId: 'CLASS_REMINDER_ACTIONS',
          extra: { classTitle, endTimeStr },
          schedule: { 
            at: notifyTime,
            allowWhileIdle: true
          },
        }
      ]
    });
  }

  static async triggerPinnedClassMute(className: string, endTime: Date) {
    setScheduledUnmuteTime(endTime.getTime());

    if (!Capacitor.isNativePlatform()) return;
    
    const timeStr = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    await LocalNotifications.schedule({
      notifications: [
        {
          id: 8888,
          title: `Class in Session`,
          body: `Phone is silenced until ${timeStr}`,
          largeBody: `🔕 Current Class: ${className}\n\nYour phone has been manually muted via AttendX. It will restore to normal volume automatically at ${timeStr}, or you can unmute manually below.`,
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

    const timeUntilEnd = endTime.getTime() - Date.now();
    if (timeUntilEnd > 0) {
      setTimeout(async () => {
        await unmutePhone();
        await LocalNotifications.cancel({ notifications: [{ id: 8888 }] });
      }, timeUntilEnd);
    }
  }

  static async scheduleHolidayNotification(holidayName: string | undefined, date: Date, customMessage: string = "No classes scheduled! Enjoy your day off.") {
    if (!Capacitor.isNativePlatform()) return;
    const notifId = getNotificationIdBand('holiday', `${holidayName || 'holiday'}_${date.toISOString()}`);

    await LocalNotifications.schedule({
      notifications: [
        {
          id: notifId,
          title: (holidayName || "").toLowerCase().includes("holiday") ? "Holiday Today: " + holidayName : "Event Today: " + holidayName,
          body: customMessage,
          largeBody: "✨ " + holidayName + "\n\n" + customMessage,
          summaryText: "Holiday Event",
          smallIcon: "ic_stat_adobe",
          iconColor: "#10B981", 
          channelId: "class_alerts",
          schedule: { at: date, allowWhileIdle: true }
        }
      ]
    });
  }

  static async scheduleBirthdayNotification(name: string, date: Date) {
    if (!Capacitor.isNativePlatform()) return;
    const notifId = getNotificationIdBand('birthday', `${name}_${date.toISOString()}`);

    await LocalNotifications.schedule({
      notifications: [
        {
          id: notifId,
          title: "Happy Birthday!",
          body: `Wish ${name} a great birthday today!`,
          largeBody: `🎂 It's ${name}'s birthday today!\n\nDon't forget to send them your best wishes and make their day special!`,
          summaryText: "Birthday Event",
          smallIcon: "ic_stat_adobe",
          iconColor: "#F59E0B", 
          channelId: "class_alerts",
          schedule: { at: date, allowWhileIdle: true }
        }
      ]
    });
  }

  static async autoScheduleFromTimetable() {
    if (!Capacitor.isNativePlatform()) return;

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
        console.log("No active semester found after store hydration; skipping timetable scheduling.");
        return;
      }

      console.log("Auto-scheduling local notifications for upcoming classes and events...");

      let slots: any[] = useCacheStore.getState().timetable?.slots;
      if (!slots) {
         try {
            const res = await api.get(`/timetable/${activeSemesterId}`);
            slots = res.data;
         } catch(e) {
            console.error("Failed to fetch timetable for auto-scheduling", e);
         }
      }
      if (!slots) return;

      const events = useAttendanceStore.getState().events || [];
      const allEvents = [...events];
      
      const pending = await LocalNotifications.getPending();
      const toCancel = pending.notifications.filter(n => isManagedNotificationId(Number(n.id)));
      if (toCancel.length > 0) {
        await LocalNotifications.cancel({ notifications: toCancel.map(n => ({ id: Number(n.id) })) });
      }

      const today = startOfDay(new Date());
      let scheduledCount = 0;

      const config = useNotificationStore.getState().config;

      for (let i = 0; i < 7; i++) {
        const currentDay = addDays(today, i);
        
        const dayEvents = allEvents.filter(e => {
          const eDate = startOfDay(new Date(e.date));
          return isSameDay(eDate, currentDay);
        });

        let isClassOff = false;
        let specialTitle: string | undefined = undefined;
        let specialMessage: string | undefined = undefined;
        
        for (const e of dayEvents) {
          const lowerTitle = e.title?.toLowerCase() || "";
          
          if (e.type === 'HOLIDAY' || lowerTitle.includes('holiday')) {
            if (e.type !== 'RESTRICTED' && !lowerTitle.includes('restricted')) {
              isClassOff = true;
              specialTitle = e.title;
              specialMessage = "No classes scheduled! Enjoy your day off.";
            }
          } else if (lowerTitle.includes('midsem') && lowerTitle.includes('exam')) {
            isClassOff = true;
            specialTitle = e.title;
            specialMessage = "All the best for your exams!";
          } else if (lowerTitle.includes('endsem') && lowerTitle.includes('exam')) {
            isClassOff = true;
            specialTitle = e.title;
            specialMessage = "All the best for your exams!";
          } else if (lowerTitle.includes('vacation')) {
            isClassOff = true;
            specialTitle = e.title;
            specialMessage = "Enjoy your midsem/endsem vacation!";
          }
        }

        const birthdayEvent = dayEvents.find(e => e.title?.toLowerCase().includes("birthday"));

        if (isClassOff && specialTitle) {
          const notifyTime = setHours(currentDay, 8);
          if (notifyTime.getTime() > Date.now()) {
            await this.scheduleHolidayNotification(specialTitle, notifyTime, specialMessage);
            scheduledCount++;
          }
          continue; 
        }

        if (birthdayEvent) {
          const notifyTime = setHours(currentDay, 9);
          if (notifyTime.getTime() > Date.now()) {
            const nameMatch = birthdayEvent.title.match(/(?:'s|s)?\s*birthday/i);
            const name = nameMatch ? birthdayEvent.title.replace(/(?:'s|s)?\s*birthday/i, '').trim() : birthdayEvent.title;
            await this.scheduleBirthdayNotification(name, notifyTime);
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
          const prevSlot = j > 0 ? daySlots[j-1] : null;

          const subjectName = slot.subject?.name || slot.subject?.code || "Class";
          const startTimeStr = slot.startTime; 
          const endTimeStr = slot.endTime; 

          const parsedStart = parse(startTimeStr, "HH:mm", new Date());
          let classStartObj = setMinutes(setHours(currentDay, parsedStart.getHours()), parsedStart.getMinutes());
          
          const standardNotifyTime = addMinutes(classStartObj, -config.classReminderOffset);
          let headsUpTime: Date | null = null;

          if (config.notifyNextClassOnEnd && prevSlot && prevSlot.endTime) {
            const prevParsedEnd = parse(prevSlot.endTime, "HH:mm", new Date());
            const prevEndObj = setMinutes(setHours(currentDay, prevParsedEnd.getHours()), prevParsedEnd.getMinutes());
            // Only schedule Heads Up if it's within 1 hour, and at least 5 minutes before the standard reminder
            if (prevEndObj.getTime() >= (classStartObj.getTime() - 60*60*1000) && prevEndObj.getTime() <= (standardNotifyTime.getTime() - 5*60*1000)) {
               headsUpTime = prevEndObj;
            }
          }

          if (headsUpTime && headsUpTime.getTime() > Date.now()) {
            await this.scheduleClassReminder(subjectName + " (Heads Up)", classStartObj, headsUpTime, config.showLocation ? slot.room : undefined, endTimeStr, slot.id || `slot_${j}`, 'headsup');
            scheduledCount++;
          }

          if (standardNotifyTime.getTime() > Date.now()) {
            await this.scheduleClassReminder(subjectName, classStartObj, standardNotifyTime, config.showLocation ? slot.room : undefined, endTimeStr, slot.id || `slot_${j}`, 'standard');
            scheduledCount++;
          }
          
          if (endTimeStr) {
            const parsedEnd = parse(endTimeStr, "HH:mm", new Date());
            const classEndObj = setMinutes(setHours(currentDay, parsedEnd.getHours()), parsedEnd.getMinutes());
            if (!maxEndTimeObj || classEndObj > maxEndTimeObj) {
              maxEndTimeObj = classEndObj;
            }
          }
        }

        if (config.endOfDaySummary && maxEndTimeObj && daySlots.length > 0) {
           if (maxEndTimeObj.getTime() > Date.now()) {
              
              let endOfDayTitle = "Done for the day!";
              let endOfDayBody = "All classes have ended. Enjoy your evening!";
              let endOfDayLargeBody = "🎉 All classes for today have concluded. You can pack up and enjoy the rest of your day. See you tomorrow!";

              const tomorrow = addDays(currentDay, 1);
              const tomorrowEvents = allEvents.filter(e => isSameDay(startOfDay(new Date(e.date)), tomorrow));
              
              let tomorrowHolidayTitle: string | null = null;
              for (const e of tomorrowEvents) {
                const lowerTitle = (e.title || "").toLowerCase();
                if (e.type === 'HOLIDAY' || lowerTitle.includes('holiday') || lowerTitle.includes('exam') || lowerTitle.includes('fest') || lowerTitle.includes('break') || lowerTitle.includes('vacation')) {
                  if (e.type !== 'RESTRICTED' && !lowerTitle.includes('restricted')) {
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
                 endOfDayLargeBody = `🎉 All classes for today have concluded. Prepare for the upcoming ${tomorrowHolidayTitle} tomorrow!`;
                 endOfDayBody = `Classes ended. Enjoy ${tomorrowHolidayTitle} tomorrow!`;
              } else if (currentDay.getDay() === 5) { // Friday
                 const saturdaySlots = tomorrowSlots;
                 const sunday = addDays(currentDay, 2);
                 const sundaySlots = getSlotsForDay(sunday);
                 const sundayEvents = allEvents.filter(e => isSameDay(startOfDay(new Date(e.date)), sunday));
                 let sundayHoliday = false;
                 for (const e of sundayEvents) {
                    const lowerTitle = (e.title || "").toLowerCase();
                    if (e.type === 'HOLIDAY' || lowerTitle.includes('holiday')) {
                       if (e.type !== 'RESTRICTED') sundayHoliday = true;
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
                 endOfDayLargeBody = `🎉 All classes for today have concluded. Enjoy your day off tomorrow!`;
                 endOfDayBody = `All classes ended. Enjoy your day off tomorrow!`;
              }

              await LocalNotifications.schedule({
                notifications: [{
                  id: getNotificationIdForSlot('endofday', currentDay.toISOString().slice(0, 10), 'endofday'),
                  title: endOfDayTitle,
                  body: endOfDayBody,
                  largeBody: endOfDayLargeBody,
                  schedule: { at: maxEndTimeObj, allowWhileIdle: true },
                  summaryText: "End of Day",
                  smallIcon: "ic_stat_adobe",
                  iconColor: "#3B82F6",
                }]
              });
              scheduledCount++;
           }
        }
      }

      // Morning Class Summary (8800): Schedule daily agenda if today has classes
      let todayDbDay = today.getDay() - 1;
      if (todayDbDay === -1) todayDbDay = 6;
      const todaySlots = slots.filter(s => s.dayOfWeek === todayDbDay).sort((a, b) => a.startTime.localeCompare(b.startTime));
      const todayMorningTime = setMinutes(setHours(today, 7), 30);
      if (todaySlots.length > 0 && todayMorningTime.getTime() > Date.now()) {
        const firstClass = todaySlots[0];
        const subjectName = firstClass.subject?.name || firstClass.subject?.code || "Class";
        await LocalNotifications.schedule({
          notifications: [{
            id: 8800,
            title: "Today's Schedule",
            body: `You have ${todaySlots.length} lecture${todaySlots.length > 1 ? 's' : ''} today. First: ${subjectName} at ${firstClass.startTime}.`,
            largeBody: `🌅 Today's Agenda\n\nYou have ${todaySlots.length} lecture${todaySlots.length > 1 ? 's' : ''} scheduled for today.\nFirst class: ${subjectName} at ${firstClass.startTime}${firstClass.room ? ` in ${firstClass.room}` : ''}.\n\nTap to review your full schedule.`,
            summaryText: "Daily Agenda",
            smallIcon: "ic_stat_adobe",
            iconColor: "#3B82F6",
            channelId: 'academic_briefings',
            actionTypeId: 'ACADEMIC_UPDATE_OPEN',
            schedule: { at: todayMorningTime, allowWhileIdle: true }
          }]
        });
        scheduledCount++;
      }

      // Low Attendance Threshold Warning (8900)
      const subjects = useAttendanceStore.getState().subjects || [];
      const targetPct = useAttendanceStore.getState().targetPercentage || 75;
      const lowSubjects = subjects.filter(s => s.total > 0 && s.percentage < targetPct);
      if (lowSubjects.length > 0) {
        const worstSubject = [...lowSubjects].sort((a, b) => a.percentage - b.percentage)[0];
        await LocalNotifications.schedule({
          notifications: [{
            id: 8900,
            title: "Attendance Warning",
            body: `${worstSubject.name} is at ${Math.round(worstSubject.percentage)}% (target: ${targetPct}%). Attend upcoming lectures to stay safe.`,
            largeBody: `⚠️ Attendance Threshold Warning\n\nYour attendance in ${worstSubject.name} has dropped to ${Math.round(worstSubject.percentage)}%, below your goal of ${targetPct}%.\n\nTap to open your attendance report and simulate your recovery.`,
            summaryText: "Attendance Alert",
            smallIcon: "ic_stat_adobe",
            iconColor: "#EF4444",
            channelId: 'class_alerts',
            actionTypeId: 'ACADEMIC_UPDATE_OPEN',
            schedule: { at: new Date(Date.now() + 10000), allowWhileIdle: true }
          }]
        });
        scheduledCount++;
      }
      
      console.log(`Successfully scheduled ${scheduledCount} notifications for the next 7 days.`);
    } catch (err) {
      console.error("Failed to auto-schedule timetable notifications:", err);
    }
  }

  static async scheduleAssignmentReminders() {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      const pending = await LocalNotifications.getPending();
      const toCancel = pending.notifications.filter(n => n.id >= 9000 && n.id <= 9999);
      if (toCancel.length > 0) {
        await LocalNotifications.cancel({ notifications: toCancel.map(n => ({ id: Number(n.id) })) });
      }

      let assignments: any[] = [];
      try {
        const { api } = await import('../lib/api');
        const res = await api.get('/assignments');
        assignments = res.data || [];
      } catch {
        // Fallback to local offline cache in assignmentStore
        const { useAssignmentStore } = await import('../stores/assignmentStore');
        assignments = useAssignmentStore.getState().assignments || [];
      }

      const notifications = [];

      let idCounter = 9000;
      for (const assignment of assignments) {
        if (assignment.completions?.length > 0) continue;
        
        const deadline = new Date(assignment.deadline);
        if (deadline.getTime() < Date.now()) continue;

        // Schedule multiple cascade reminders
        const reminders = [
          { time: deadline.getTime() - 24 * 60 * 60 * 1000, title: "Assignment Due Tomorrow", text: "due tomorrow" },
          { time: deadline.getTime() - 2 * 60 * 60 * 1000, title: "Assignment Due in 2 Hours", text: "due in 2 hours" },
          { time: deadline.getTime() - 15 * 60 * 1000, title: "Assignment Due Soon", text: "due in 15 minutes!" }
        ];

        for (const rem of reminders) {
          const remDate = new Date(rem.time);
          if (remDate.getTime() > Date.now() && idCounter <= 9999) {
            notifications.push({
              id: idCounter++,
              title: rem.title,
              body: assignment.title,
              largeBody: `⏰ Reminder: "${assignment.title}" is ${rem.text} at ${deadline.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}.`,
              channelId: "assignment_alerts",
              smallIcon: "ic_stat_adobe",
              iconColor: "#EF4444",
              actionTypeId: 'ACADEMIC_UPDATE_OPEN',
              schedule: { at: remDate, allowWhileIdle: true }
            });
          }
        }
      }

      if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications });
      }
    } catch (error) {
      console.error("Failed to schedule assignment reminders", error);
    }
  }

  static async scheduleAcademicUpdates(frequency: { type: string, subValue?: string }) {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const pending = await LocalNotifications.getPending();
      const toCancel = pending.notifications.filter(n => (n.id >= 90000 && n.id <= 90999) || (n.id >= 8801 && n.id <= 8830) || n.id === 8888);
      if (toCancel.length > 0) {
        await LocalNotifications.cancel({ notifications: toCancel.map(n => ({ id: Number(n.id) })) });
      }

      if (!frequency || frequency.type === 'Never') return;

      const config = useNotificationStore.getState().config;
      const timeStr = config.summaryTimes?.[frequency.type] || config.summaryTime || "18:00";
      const scheduledDates = calculateNextSummaryDates(frequency, timeStr, new Date());
      const notificationsToSchedule = [];

      const allEvents = useAttendanceStore.getState().events || [];
      const subjects = useAttendanceStore.getState().subjects || [];
      let attended = 0;
      let total = 0;
      subjects.forEach(s => { attended += s.attended || 0; total += s.total || 0; });
      const overallPct = total === 0 ? 100 : Math.round((attended / total) * 100);

      for (let i = 0; i < scheduledDates.length; i++) {
        const notifyDate = scheduledDates[i];
        let id = 90000 + i;
        let title = "Tomorrow's Briefing";
        let body = "You have classes coming up tomorrow.";
        let largeBody = "🎒 Prepare for Tomorrow\n\nYou have classes scheduled. Tap to review your timetable, check for assignments, and pack your bag!";

        if (frequency.type === 'Weekly') {
          id = 90010 + i;
          title = "Weekly Summary";
          body = "Weekly Review: See how you did this past week!";
          const weekEvents = allEvents.filter(e => {
            const eDate = startOfDay(new Date(e.date));
            return eDate >= notifyDate && eDate < addDays(notifyDate, 7);
          });
          largeBody = "📈 Weekly Attendance Review\n\nTap to see how you performed this past week and check your overall attendance health.";
          if (weekEvents.length > 0) {
            const eventTitles = weekEvents.slice(0, 3).map(e => "📅 " + e.title).join("\n");
            largeBody = "📅 Weekly Review:\n\nTap to see how you did this past week, and prepare for upcoming events like:\n" + eventTitles;
          }
        } else if (frequency.type === 'Monthly') {
          id = 90020 + i;
          title = "Monthly Attendance Summary";
          body = "Your monthly review is ready! See how well you did this month.";
          largeBody = `📈 Monthly Summary\n\nYour overall attendance is currently at ${overallPct}%. Tap to see your detailed breakdown and performance across all subjects.`;
        } else if (frequency.type === 'Yearly') {
          id = 90030;
          title = "Yearly Attendance Summary";
          body = "Your annual academic attendance recap is ready.";
          largeBody = "🎓 Yearly Summary\n\nTap to review your attendance performance across all semesters.";
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
          actionTypeId: 'ACADEMIC_UPDATE_OPEN',
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

  static async cancelAll() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({
          notifications: pending.notifications.map(n => ({ id: Number(n.id) }))
        });
      }
      console.log("Cancelled all pending local notifications.");
    } catch (err) {
      console.error("Failed to cancel all notifications:", err);
    }
  }
}


