import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { mutePhone, unmutePhone } from '../lib/ringer';
import { useAttendanceStore } from '../stores/attendanceStore';
import { toast } from 'sonner';

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

    // Register action types for pinned notification
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
        }
      ]
    });

    // Listen for unmute action
    LocalNotifications.addListener('localNotificationActionPerformed', async (action) => {
      if (action.actionId === 'UNMUTE_ACTION') {
        console.log('User clicked Unmute');
        await unmutePhone();
        await LocalNotifications.cancel({ notifications: [{ id: 9999 }] });
        toast.success("Phone unmuted manually.");
      }
    });

    this.isInitialized = true;
  }

  static async scheduleClassReminder(classTitle: string, startTime: Date, location?: string) {
    const timeStr = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (!Capacitor.isNativePlatform()) {
      toast("📚 Upcoming Class: " + classTitle, { 
        description: "Starts at " + timeStr + (location ? " in " + location : ""),
        style: { borderLeft: "4px solid #6366F1" }
      });
      return;
    }
    
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 10000),
          title: `Upcoming Class: ${classTitle}`,
          body: `Starts at ${timeStr}`,
          largeBody: `Your class "${classTitle}" is starting at ${timeStr}.${location ? `\nLocation: ${location}` : ''}\n\nYour phone will be automatically silenced when the class begins.`,
          summaryText: "Class Reminder",
          iconColor: "#6366F1", // Indigo theme
          channelId: 'class_alerts',
          foreground: true,
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
      toast("🔕 Class in Session: " + className, { 
        description: "Phone silenced until " + timeStr + " (Pinned Overlay Mock)",
        style: { borderLeft: "4px solid #F59E0B" }
      });
      return;
    }

    // 1. Mute the phone natively
    await mutePhone();

    // 2. Show ongoing notification with premium styling
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 9999, // Static ID so we can cancel it later
          title: `Class in Session`,
          body: `Phone is silenced until ${timeStr}`,
          largeBody: `You are currently in "${className}".\n\nYour phone has been automatically muted. It will restore to normal volume automatically at ${timeStr}.`,
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
    
    toast.success("Class started. Phone silenced.");

    // Automatically unmute when class ends
    const timeUntilEnd = endTime.getTime() - Date.now();
    if (timeUntilEnd > 0) {
      setTimeout(async () => {
        await unmutePhone();
        await LocalNotifications.cancel({ notifications: [{ id: 9999 }] });
        toast.info("Class ended. Phone volume restored.");
      }, timeUntilEnd);
    }
  }

  static async scheduleHolidayNotification(holidayName: string, date: Date) {
    if (!Capacitor.isNativePlatform()) {
      toast("🌴 Holiday Tomorrow: " + holidayName, { 
        description: "No classes scheduled! Enjoy your day off.",
        style: { borderLeft: "4px solid #10B981" }
      });
      return;
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 10000),
          title: "Holiday Tomorrow: " + holidayName,
          body: "No classes scheduled! Enjoy your day off.",
          summaryText: "Holiday Event",
          iconColor: "#10B981", // Emerald
          channelId: "class_alerts",
          schedule: { at: date, allowWhileIdle: true }
        }
      ]
    });
  }

  static async scheduleBirthdayNotification(userName: string, date: Date) {
    if (!Capacitor.isNativePlatform()) {
      toast("🎉 Happy Birthday " + userName + "!", { 
        description: "Have a fantastic day from the AttendX team.",
        style: { borderLeft: "4px solid #EC4899" }
      });
      return;
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 10000),
          title: "Happy Birthday " + userName + "!",
          body: "Have a fantastic day from the AttendX team.",
          summaryText: "Birthday",
          iconColor: "#EC4899", // Pink
          channelId: "class_alerts",
          schedule: { at: date, allowWhileIdle: true }
        }
      ]
    });
  }

  static async autoScheduleFromTimetable() {
    if (!Capacitor.isNativePlatform()) return;

    // A real implementation would parse useAttendanceStore().timetable 
    // and useAttendanceStore().events (Academic Calendar) 
    // to schedule LocalNotifications for the next 7 days.
    // We can call LocalNotifications.cancelAll() before rescheduling.
    
    // For demonstration purposes, we schedule a single fake upcoming class
    // in the real implementation this loops over the DB rows.
    console.log("Auto-scheduling local notifications for upcoming classes...");
  }
}
