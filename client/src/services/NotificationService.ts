import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { mutePhone, unmutePhone } from '../lib/ringer';
import { useAttendanceStore } from '../stores/attendanceStore';
import { useNotificationStore } from '../stores/notificationStore';
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
      // Tap on the notification body itself (or if it's explicitly the update open action)
      if (action.actionId === 'tap' || action.actionId === 'ACADEMIC_UPDATE_OPEN') {
        const id = action.notification.id;
        // 8800 series is used for daily/weekly/monthly summaries
        if (id >= 8800 && id < 8900) {
           window.location.href = '/report';
           return;
        }
      }
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
    if (!Capacitor.isNativePlatform()) return;
    
    const timeStr = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    await LocalNotifications.schedule({
      notifications: [
        {
          id: 9999,
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
          largeBody: `🎉 Holiday: ${holidayName}\n\nThere are no classes scheduled for today. Take a break, relax, and enjoy your time off!`,
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

    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 10000),
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

      const config = useNotificationStore.getState().config;

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
          
          let notifyTime = addMinutes(classStartObj, -config.classReminderOffset);

          if (config.notifyNextClassOnEnd && prevSlot && prevSlot.endTime) {
            const prevParsedEnd = parse(prevSlot.endTime, "HH:mm", new Date());
            const prevEndObj = setMinutes(setHours(currentDay, prevParsedEnd.getHours()), prevParsedEnd.getMinutes());
            if (prevEndObj.getTime() >= (classStartObj.getTime() - 60*60*1000) && prevEndObj.getTime() <= classStartObj.getTime()) {
               notifyTime = prevEndObj;
            }
          }

          if (notifyTime.getTime() > Date.now()) {
            await this.scheduleClassReminder(subjectName, classStartObj, notifyTime, config.showLocation ? slot.room : undefined, endTimeStr);
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
              await LocalNotifications.schedule({
                notifications: [{
                  id: Math.floor(Math.random() * 900000) + 100000,
                  title: "Done for the day!",
                  body: "All classes have ended. Enjoy your evening!",
                  largeBody: "🎉 All classes for today have concluded. You can pack up and enjoy the rest of your day. See you tomorrow!",
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
        await LocalNotifications.cancel({ notifications: toCancel });
      }

      const { api } = await import('../lib/api');
      const res = await api.get('/assignments');
      const assignments = res.data || [];
      const notifications = [];

      let idCounter = 9000;
      for (const assignment of assignments) {
        if (assignment.completions?.length > 0) continue;
        
        const deadline = new Date(assignment.deadline);
        if (deadline.getTime() < Date.now()) continue;

        // Reminder 1 day before
        const oneDayBefore = new Date(deadline.getTime() - 24 * 60 * 60 * 1000);
        if (oneDayBefore.getTime() > Date.now()) {
          notifications.push({
            id: idCounter++,
            title: "Assignment Due Tomorrow",
            body: assignment.title,
            largeBody: `?? Reminder: "${assignment.title}" is due tomorrow at ${deadline.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}.`,
            channelId: "class_alerts",
            smallIcon: "ic_stat_adobe",
            iconColor: "#FF0000",
            actionTypeId: 'ACADEMIC_UPDATE_OPEN',
            schedule: { at: oneDayBefore, allowWhileIdle: true }
          });
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
      const toCancel = pending.notifications.filter(n => n.id >= 8800 && n.id <= 8899 || n.id === 8888);
      if (toCancel.length > 0) {
        await LocalNotifications.cancel({ notifications: toCancel });
      }

      if (!frequency || frequency.type === 'Never') return;

      const config = useNotificationStore.getState().config;
      let [summaryHour, summaryMinute] = [18, 0];
      if (config.summaryTime) {
         const parts = config.summaryTime.split(":");
         summaryHour = parseInt(parts[0], 10);
         summaryMinute = parseInt(parts[1], 10);
      }

      const today = startOfDay(new Date());
      const notificationsToSchedule = [];

      if (frequency.type === 'Daily') {
        for (let i = 1; i <= 7; i++) {
           const notifyDate = setMinutes(setHours(addDays(today, i), summaryHour), summaryMinute);
           if (notifyDate.getTime() > Date.now()) {
             notificationsToSchedule.push({
                id: 8800 + i,
                title: "Tomorrow's Briefing",
                body: "You have classes coming up tomorrow.",
                largeBody: "🎒 Prepare for Tomorrow\n\nYou have classes scheduled. Tap to review your timetable, check for assignments, and pack your bag!",
                summaryText: "Academic Update",
                smallIcon: "ic_stat_adobe",
            iconColor: "#FF0000",
            channelId: "class_alerts",
                actionTypeId: 'ACADEMIC_UPDATE_OPEN',
                schedule: { at: notifyDate, allowWhileIdle: true }
             });
           }
        }
      } else if (frequency.type === 'Weekly') {
        const daysMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
        const targetDay = (frequency.subValue && daysMap[frequency.subValue] !== undefined) ? daysMap[frequency.subValue] : 1;
        
        const allEvents = useAttendanceStore.getState().events || [];
        
        let nextTargetDay = today;
        while (nextTargetDay.getDay() !== targetDay) {
           nextTargetDay = addDays(nextTargetDay, 1);
        }

        for (let i = 0; i < 4; i++) {
           let notifyDate = setMinutes(setHours(addDays(nextTargetDay, i * 7), summaryHour), summaryMinute);
           
           if (notifyDate.getTime() <= Date.now()) {
              notifyDate = setMinutes(setHours(addDays(nextTargetDay, (i+4) * 7), summaryHour), summaryMinute); 
           }

           const weekEvents = allEvents.filter(e => {
             const eDate = startOfDay(new Date(e.date));
             return eDate >= notifyDate && eDate < addDays(notifyDate, 7);
           });

           let dynamicText = "?? Weekly Attendance Review\n\nTap to see how you performed this past week and check your overall attendance health.";
           if (weekEvents.length > 0) {
              const eventTitles = weekEvents.slice(0, 3).map(e => "� " + e.title).join("\n");
              dynamicText = "?? Weekly Review:\n\nTap to see how you did this past week, and prepare for upcoming events like:\n" + eventTitles;
           }

           notificationsToSchedule.push({
              id: 8810 + i,
              title: "Weekly Summary",
              body: "Weekly Review: See how you did this past week!",
              largeBody: dynamicText,
              summaryText: "Academic Update",
              smallIcon: "ic_stat_adobe",
            iconColor: "#FF0000",
            channelId: "class_alerts",
              actionTypeId: 'ACADEMIC_UPDATE_OPEN',
              schedule: { at: notifyDate, allowWhileIdle: true }
           });
        }
      } else if (frequency.type === 'Monthly') {
        const subjects = useAttendanceStore.getState().subjects || [];
        let attended = 0;
        let total = 0;
        subjects.forEach(s => { attended += s.attended; total += s.total; });
        const overallPct = total === 0 ? 100 : Math.round((attended / total) * 100);

        for (let i = 0; i < 3; i++) {
           let notifyDate = setMinutes(setHours(new Date(today.getFullYear(), today.getMonth() + i, 1), summaryHour), summaryMinute);
           if (notifyDate.getTime() <= Date.now()) {
              notifyDate = setMinutes(setHours(new Date(today.getFullYear(), today.getMonth() + i + 3, 1), summaryHour), summaryMinute);
           }
           
           notificationsToSchedule.push({
              id: 8820 + i,
              title: "Monthly Attendance Summary",
              body: "Your monthly review is ready! See how well you did this month.",
              largeBody: "📈 Monthly Summary\n\nYour overall attendance is currently at " + overallPct + "%. Tap to see your detailed breakdown and performance across all subjects.",
              summaryText: "Academic Update",
              smallIcon: "ic_stat_adobe",
            iconColor: "#FF0000",
            channelId: "class_alerts",
              actionTypeId: 'ACADEMIC_UPDATE_OPEN',
              schedule: { at: notifyDate, allowWhileIdle: true }
           });
        }
      }

      if (notificationsToSchedule.length > 0) {
         await LocalNotifications.schedule({ notifications: notificationsToSchedule });
      }

    } catch (error) {
      console.error("Failed to schedule academic updates:", error);
    }
  }
}
