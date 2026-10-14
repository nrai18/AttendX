import cron from 'node-cron';
import { BirthdayService } from './birthday.service';
import { prisma } from '../lib/prisma';
import { EmailService } from './email.service';
import { PushNotificationService } from './push_notification.service';

export class CronService {
  static init() {
    // Run every day at 8:00 AM IST
    cron.schedule('0 8 * * *', async () => {
      console.log('[Cron] Running daily birthday check...');
      try {
        const result = await BirthdayService.ensureBirthdaySentForAll();
        console.log(`[Cron] Birthday check complete. Sent ${result.sentCount} greeting(s):`, result.recipients);
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
