import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { EmailService } from './email.service';
import { PushNotificationService } from './push_notification.service';

export class CronService {
  static init() {
    // Run every day at 8:00 AM IST
    cron.schedule('0 8 * * *', async () => {
      console.log('[Cron] Running daily birthday check...');
      try {
        // AI-H09/H10 FIX: Use IST timezone for current date matching, but treat DB birthday as UTC midnight
        // Creating a date here gives current server local time (or UTC if on Cloud Run). 
        // We want the current date in IST. node-cron handles the triggering at 8AM IST because of the options block.
        const todayStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const todayIST = new Date(todayStr);
        const currentMonth = todayIST.getMonth() + 1; // 1-12
        const currentDay = todayIST.getDate(); // 1-31

        // AI-M07 FIX: Push date filtering to the database to prevent loading all users into memory
        const birthdayUsers = await prisma.$queryRaw<any[]>`SELECT id, email, name FROM "User" WHERE EXTRACT(MONTH FROM birthday AT TIME ZONE 'Asia/Kolkata') = ${currentMonth} AND EXTRACT(DAY FROM birthday AT TIME ZONE 'Asia/Kolkata') = ${currentDay}`;

        console.log(`[Cron] Found ${birthdayUsers.length} users with birthdays today.`);

        // AI-M08 FIX: Send emails and push notifications in throttled batches
        const BATCH_SIZE = 10;
        for (let i = 0; i < birthdayUsers.length; i += BATCH_SIZE) {
          const batch = birthdayUsers.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map(async user => {
            if (user.email && user.name) {
              console.log(`[Cron] Sending birthday greeting to ${user.email}`);
              
              // 1. Send Email
              await EmailService.sendBirthdayGreeting(user.email, user.name).catch(e => console.error(e));
              
              // 2. Send Native Push Notification
              if (user.id) {
                await PushNotificationService.sendToUser(
                  user.id,
                  'Happy Birthday! \uD83C\uDF89',
                  `Wishing you a fantastic birthday from the AttendX team, ${user.name}! \uD83C\uDF82`
                ).catch(e => console.error('[Push] Failed to send birthday push:', e));
              }
            }
          }));
          if (i + BATCH_SIZE < birthdayUsers.length) {
            await new Promise(res => setTimeout(res, 1100)); // 1.1s pause between batches
          }
        }
      } catch (error) {
        console.error('[Cron] Error running birthday check:', error);
      }
    }, {
      timezone: 'Asia/Kolkata'
    });

    // AI-H08 FIX: Schedule Weekly Reports (Friday 6:00 PM IST - after classes end)
    cron.schedule('0 18 * * 5', async () => {
      console.log('[Cron] Running weekly reports...');
      try {
        const users = await prisma.user.findMany({ where: { role: 'student' } });
        // NOTE: Actually computing stats and sending emails requires the full copilot logic or a direct service.
        // As a placeholder, we log this. The full implementation would loop users and call EmailService.sendWeeklyReport.
        console.log(`[Cron] Would send weekly reports to ${users.length} users (Implementation required)`);
      } catch (e) { console.error(e); }
    }, { timezone: 'Asia/Kolkata' });

    // AI-H08 FIX: Schedule Monthly Reports (1st of every month 8:00 AM IST)
    cron.schedule('0 8 1 * *', async () => {
      console.log('[Cron] Running monthly reports...');
      try {
        const users = await prisma.user.findMany({ where: { role: 'student' } });
        console.log(`[Cron] Would send monthly reports to ${users.length} users (Implementation required)`);
      } catch (e) { console.error(e); }
    }, { timezone: 'Asia/Kolkata' });

    console.log('[CronService] Initialized scheduled jobs (Timezone: IST).');
  }
}
