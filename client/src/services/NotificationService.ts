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

    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: 'CLASS_SILENT_ACTIONS',
          actions: [
            {
              id: 'UNMUTE_ACTION',
              title: '???? Unmute Phone',
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
              title: '???? Mute Phone for Class',
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
        const success = await unmutePhone();
        if (success) {
           await LocalNotifications.cancel({ notifications: [{ id: 9999 }] });
           toast.success("Phone unmuted manually.");
        }
      } else if (action.actionId === 'MUTE_ACTION') {
        const { classTitle, endTimeStr } = action.notification.extra || {};
        
        // Try muting
        const success = await mutePhone();
        if (!success) {
           toast.error("Failed to mute phone. DND Permission missing.");
           return;
        }

        toast.success("Phone muted for class.");

        let endTime = new Date();
        if (endTimeStr) {
          const parsed = parse(endTimeStr, "HH:mm", new Date());
          endTime = setMinutes(setHours(new Date(), parsed.getHours()), parsed.getMinutes());
          if (endTime.getTime() < Date.now()) endTime = addDays(endTime, 1);
        } else {
          endTime = addMinutes(new Date(), 60);
        }
        
        await this.triggerPinnedClassMute(classTitle || "Class", endTime);
      }
    });

    this.isInitialized = true;
  }

  static async scheduleClassReminder(classTitle: string, actualStartTime: Date, notifyTime: Date, location?: string, endTimeStr?: string) {
    const timeStr = actualStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (!Capacitor.isNativePlatform()) return;
    
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 900000) + 100000,
          title: `Upcoming: ${classTitle}`,
          body: `Starts at ${timeStr} ${location ? `| ${location}` : ''}`,
          largeBody: `???? Class: ${classTitle}\n⏰ Time: ${timeStr} - ${endTimeStr || 'TBD'}\n???? Room: ${location || 'N/A'}\n\nTap the action button below to instantly mute your phone for the duration of this class.`,
          summaryText: "Class Reminder",
          smallIcon: "ic_stat_attendx",
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
    if (!Capacitor.isNativePlatform()) return;
    
    const timeStr = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    await LocalNotifications.schedule({
      notifications: [
        {
          id: 9999,
          title: `Class in Session`,
          body: `Phone is silenced until ${timeStr}`,
          largeBody: `???? Current Class: ${className}\n\nYour phone has been manually muted via AttendX. It will restore to normal volume automatically at ${timeStr}, or you can unmute manually below.`,
          summaryText: "Do Not Disturb Active",
          smallIcon: "ic_stat_attendx",
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
        await LocalNotifications.cancel({ notifications: [{ id: 9999 }] });
      }, timeUntilEnd);
    }
  }

  static async scheduleHolidayNotification(holidayName: string, date: Date) {
    if (!Capacitor.isNativePlatform()) return;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 10000),
          title: "Holiday Today: " + holidayName,
          body: "No classes scheduled! Enjoy your day off.",
          largeBody: `???? Holiday: ${holidayName}\n\nThere are no classes scheduled for today. Take a break, relax, and enjoy your time off!`,
          summaryText: "Holiday Event",
          smallIcon: "ic_stat_attendx",
          iconColor: "#10B981", 
          channelId: "class_alerts",
          schedule: { at: date, allowWhileIdle: true }
        }
      ]
    });
  }

  static async scheduleBirthdayNotification(name: string, date: Date) {
    if (!Capacitor.isNativePlatform()) return;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 10000),
          title: "Happy Birthday!",
          body: `Wish ${name} a great birthday today!`,
          largeBody: `???? It's ${name}'s birthday today!\n\nDon't forget to send them your best wishes and make their day special!`,
          summaryText: "Birthday Event",
          smallIcon: "ic_stat_attendx",
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
      const activeSemesterId = useAttendanceStore.getState().activeSemesterId;
      if (!activeSemesterId) return;

      console.log("Auto-scheduling local notifications for upcoming classes and events...");

      const res = await api.get(`/timetable/${activeSemesterId}`);
      const slots: any[] = res.data;
      if (!slots) return;

      const events = useAttendanceStore.getState().events || [];
      const allEvents = [...events];
      
      const pending = await LocalNotifications.getPending();
      const toCancel = pending.notifications.filter(n => n.id !== 9999);
      if (toCancel.length > 0) {
        await LocalNotifications.cancel({ notifications: toCancel });
      }

      const today = startOfDay(new Date());
      let scheduledCount = 0;

      for (let i = 0; i < 7; i++) {
        const currentDay = addDays(today, i);
        
        const dayEvents = allEvents.filter(e => {
          const eDate = startOfDay(new Date(e.date));
          return isSameDay(eDate, currentDay);
        });

        const holidayEvent = dayEvents.find(e => e.type === 'HOLIDAY' || e.type === 'RESTRICTED' || e.title?.toLowerCase().includes("holiday"));
        const birthdayEvent = dayEvents.find(e => e.title?.toLowerCase().includes("birthday"));

        if (holidayEvent) {
          const notifyTime = setHours(currentDay, 8);
          if (notifyTime.getTime() > Date.now()) {
            await this.scheduleHolidayNotification(holidayEvent.title, notifyTime);
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
        
        for (const slot of daySlots) {
          const subjectName = slot.subject?.name || slot.subject?.code || "Class";
          const startTimeStr = slot.startTime; 
          const endTimeStr = slot.endTime; 

          const parsedStart = parse(startTimeStr, "HH:mm", new Date());
          let classStartObj = setMinutes(setHours(currentDay, parsedStart.getHours()), parsedStart.getMinutes());
          
          const notifyTime = addMinutes(classStartObj, -10);

          if (notifyTime.getTime() > Date.now()) {
            // FIX: Pass actual classStartObj AND notifyTime
            await this.scheduleClassReminder(subjectName, classStartObj, notifyTime, slot.room, endTimeStr);
            scheduledCount++;
          }
        }
      }
      
      console.log(`Successfully scheduled ${scheduledCount} notifications for the next 7 days.`);
    } catch (err) {
      console.error("Failed to auto-schedule timetable notifications:", err);
    }
  }

  static async scheduleAcademicUpdates(frequency: { type: string, subValue?: string }) {
    if (!Capacitor.isNativePlatform()) return;

    try {
      await LocalNotifications.cancel({ notifications: [{ id: 8888 }] });

      if (!frequency || frequency.type === 'Never') return;

      let title = "Daily Briefing";
      let body = "Ready for tomorrow? Tap to check your upcoming schedule and assignments!";
      let largeBody = "???? Ready for tomorrow?\n\nTap to check your upcoming schedule and ensure you're prepared for all classes!";
      let every: 'day' | 'week' | 'month' | 'year' | undefined = 'day';
      let on: any = undefined;

      const scheduleDate = new Date();

      if (frequency.type === 'Daily') {
        title = "Tomorrow's Briefing";
        body = "You have classes coming up tomorrow.";
        largeBody = `???? Prepare for Tomorrow\n\nYou have classes scheduled. Tap to review your timetable, check for assignments, and pack your bag!`;
        every = 'day';
      } else if (frequency.type === 'Weekly') {
        title = "Attendance Health Check";
        body = "Weekly Review: Check your attendance health!";
        largeBody = `???? Weekly Attendance Review\n\nTake a moment to check your attendance health to ensure you stay above your target percentage. Let's keep those numbers green!`;
        every = 'week';
        
        const daysMap: Record<string, number> = { Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6, Sat: 7 };
        if (frequency.subValue && daysMap[frequency.subValue]) {
          on = { weekday: daysMap[frequency.subValue], hour: 18, minute: 0 };
        }
      } else if (frequency.type === 'Monthly') {
        title = "Monthly Attendance Summary";
        body = "Your monthly review is ready! See how well you did this month.";
        largeBody = `???? Monthly Summary\n\nYour attendance review for the past month is ready. Tap to see your detailed breakdown and performance across all subjects.`;
        every = 'month';
        on = { day: 1, hour: 18, minute: 0 };
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            id: 8888,
            title,
            body,
            largeBody,
            summaryText: "Academic Update",
            smallIcon: "ic_stat_attendx",
            iconColor: "#8B5CF6", 
            channelId: "class_alerts",
            actionTypeId: 'ACADEMIC_UPDATE_OPEN',
            schedule: on ? { on, repeats: true, allowWhileIdle: true } : { every, repeats: true, allowWhileIdle: true }
          }
        ]
      });

    } catch (error) {
      console.error("Failed to schedule academic updates:", error);
    }
  }
}
