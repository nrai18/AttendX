import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { mutePhone, unmutePhone } from '../lib/ringer';
import { useAttendanceStore } from '../stores/attendanceStore';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { differenceInDays, parse, addMinutes, setHours, setMinutes, startOfDay, addDays, isSameDay } from 'date-fns';

export class NotificationService {
  private static isInitialized = false;

  static async init() {
    if (!Capacitor.isNativePlatform() || this.isInitialized) return;
    
    // Request basic permissions
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }

    // Create premium notification channels
    await LocalNotifications.createChannel({
      id: 'class_alerts',
      name: 'Class Reminders',
      description: 'Heads-up alerts before your class begins.',
      importance: 5, // IMPORTANCE_MAX for heads up
      visibility: 1, // VISIBILITY_PUBLIC
      lights: true,
      lightColor: '#6366F1', // Indigo
      vibration: true,
    });

    await LocalNotifications.createChannel({
      id: 'silent_mode',
      name: 'Active Silent Mode',
      description: 'Pinned notification while class is actively running and phone is muted.',
      importance: 3, // IMPORTANCE_DEFAULT, no heads-up needed for ongoing
      visibility: 1,
      lights: false,
      vibration: false,
    });

    // Register action types for pinned notification and class reminders
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

    // Listen for unmute/mute actions
    LocalNotifications.addListener('localNotificationActionPerformed', async (action) => {
      if (action.actionId === 'UNMUTE_ACTION') {
        await unmutePhone();
        await LocalNotifications.cancel({ notifications: [{ id: 9999 }] });
        toast.success("Phone unmuted manually.");
      } else if (action.actionId === 'MUTE_ACTION') {
        const { classTitle, endTimeStr } = action.notification.extra || {};
        
        // Mute the phone
        await mutePhone();
        toast.success("Phone muted for class.");

        // Optionally, pin the in-session notification if we want
        // But we would need a Date object for endTime
        let endTime = new Date();
        if (endTimeStr) {
          const parsed = parse(endTimeStr, "HH:mm", new Date());
          endTime = setMinutes(setHours(new Date(), parsed.getHours()), parsed.getMinutes());
          if (endTime.getTime() < Date.now()) endTime = addDays(endTime, 1);
        } else {
          endTime = addMinutes(new Date(), 60); // Default 1 hr
        }
        
        await this.triggerPinnedClassMute(classTitle || "Class", endTime);
      }
    });

    this.isInitialized = true;
  }

  static async scheduleClassReminder(classTitle: string, startTime: Date, location?: string, endTimeStr?: string) {
    const timeStr = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 900000) + 100000,
          title: `Upcoming Class: ${classTitle}`,
          body: `Starts at ${timeStr}`,
          largeBody: `Your class "${classTitle}" is starting at ${timeStr}.${location ? `\nLocation: ${location}` : ''}\n\nTap the action button below to instantly mute your phone for this class.`,
          summaryText: "Class Reminder",
          iconColor: "#6366F1", // Indigo theme
          channelId: 'class_alerts',
          foreground: true,
          actionTypeId: 'CLASS_REMINDER_ACTIONS',
          extra: { classTitle, endTimeStr },
          schedule: { 
            at: startTime,
            allowWhileIdle: true
          },
        }
      ]
    });
  }

  static async triggerPinnedClassMute(className: string, endTime: Date) {
    const timeStr = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (!Capacitor.isNativePlatform()) {
      return;
    }

    // 1. Show ongoing notification
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 9999, // Static ID so we can cancel it later
          title: `Class in Session`,
          body: `Phone is silenced until ${timeStr}`,
          largeBody: `You are currently in "${className}".\n\nYour phone has been manually muted via AttendX. It will restore to normal volume automatically at ${timeStr} if the app is opened, or you can unmute manually below.`,
          summaryText: "Do Not Disturb Active",
          iconColor: "#F59E0B", // Amber warning color
          channelId: 'silent_mode',
          ongoing: true, // Android pinned
          autoCancel: false,
          actionTypeId: 'CLASS_SILENT_ACTIONS',
          schedule: { at: new Date() } // Trigger immediately
        }
      ]
    });

    // Automatically unmute when class ends (if app stays open/backgrounded)
    const timeUntilEnd = endTime.getTime() - Date.now();
    if (timeUntilEnd > 0) {
      setTimeout(async () => {
        await unmutePhone();
        await LocalNotifications.cancel({ notifications: [{ id: 9999 }] });
      }, timeUntilEnd);
    }
  }

  static async autoScheduleFromTimetable() {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const activeSemesterId = useAttendanceStore.getState().activeSemesterId;
      if (!activeSemesterId) return;

      console.log("Auto-scheduling local notifications for upcoming classes...");

      // 1. Fetch slots for active semester
      const res = await api.get(`/timetable/${activeSemesterId}`);
      const slots: any[] = res.data;
      if (!slots || slots.length === 0) return;

      // 2. Fetch events (to skip holidays)
      const events = useAttendanceStore.getState().events || [];
      const holidays = events.filter(e => e.type === 'HOLIDAY' || e.type === 'RESTRICTED');

      // 3. Clear existing scheduled notifications (excluding the pinned one 9999)
      const pending = await LocalNotifications.getPending();
      const toCancel = pending.notifications.filter(n => n.id !== 9999);
      if (toCancel.length > 0) {
        await LocalNotifications.cancel({ notifications: toCancel });
      }

      // 4. Schedule for the next 7 days
      const today = startOfDay(new Date());
      let scheduledCount = 0;

      for (let i = 0; i < 7; i++) {
        const currentDay = addDays(today, i);
        
        // Skip if this day is a holiday
        const isHoliday = holidays.some(h => {
          const hDate = startOfDay(new Date(h.date));
          return isSameDay(hDate, currentDay);
        });
        if (isHoliday) continue;

        // JS getDay(): 0 = Sun, 1 = Mon ... 6 = Sat
        // DB dayOfWeek: 0 = Mon, 1 = Tue ... 6 = Sun
        let dbDay = currentDay.getDay() - 1;
        if (dbDay === -1) dbDay = 6; // Sunday

        const daySlots = slots.filter(s => s.dayOfWeek === dbDay);
        
        for (const slot of daySlots) {
          const subjectName = slot.subject?.name || slot.subject?.code || "Class";
          const startTimeStr = slot.startTime; // "09:00"
          const endTimeStr = slot.endTime; // "10:00"

          const parsedStart = parse(startTimeStr, "HH:mm", new Date());
          let classStartObj = setMinutes(setHours(currentDay, parsedStart.getHours()), parsedStart.getMinutes());
          
          // Notification time: 10 mins before
          const notifyTime = addMinutes(classStartObj, -10);

          // Only schedule if it's in the future
          if (notifyTime.getTime() > Date.now()) {
            await this.scheduleClassReminder(subjectName, notifyTime, slot.room, endTimeStr);
            scheduledCount++;
          }
        }
      }
      
      console.log(`Successfully scheduled ${scheduledCount} class reminders for the next 7 days.`);
    } catch (err) {
      console.error("Failed to auto-schedule timetable notifications:", err);
    }
  }
}
