import { prisma } from '../lib/prisma';
import { EmailService } from './email.service';
import { PushNotificationService } from './push_notification.service';

/**
 * Service handling birthday email logic.
 * Ensures that each user receives a birthday greeting exactly once per day.
 * Uses robust EXTRACT queries comparing current IST month & day with stored birthday.
 */
export class BirthdayService {
  /**
   * Checks if the given user has a birthday today (IST) and whether the email
   * has already been sent. If not, sends the greeting and updates the tracking field.
   */
  static async ensureBirthdaySent(userId: string): Promise<void> {
    // Get current date in IST
    const todayStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const todayIST = new Date(todayStr);
    const month = todayIST.getMonth() + 1; // 1-12
    const day = todayIST.getDate(); // 1-31
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayIstIso = `${todayIST.getFullYear()}-${pad(month)}-${pad(day)}`;

    // Raw query to find the user whose birthday matches today and hasn't been sent yet
    // Note: Prisma maps model "User" to table "users" (@@map("users"))
    // Stored birthday is a date/timestamp without timezone representing the calendar birthday.
    // Do NOT apply 'AT TIME ZONE' on the birthday column, which shifts UTC midnight backwards to previous day.
    const users = await prisma.$queryRaw<any[]>`
      SELECT id, email, name
      FROM "users"
      WHERE id = ${userId}
        AND birthday IS NOT NULL
        AND EXTRACT(MONTH FROM birthday) = ${month}
        AND EXTRACT(DAY FROM birthday) = ${day}
        AND ("lastBirthdayEmailSentAt" IS NULL OR DATE(("lastBirthdayEmailSentAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata') <> ${todayIstIso}::date)
    `;

    if (users.length === 0) {
      return; // Not birthday today or already sent
    }

    const user = users[0];
    if (user.email && user.name) {
      // 1. Send Email Greeting
      await EmailService.sendBirthdayGreeting(user.email, user.name).catch(e => console.error(e));

      // 2. Send Native Push Notification
      if (user.id) {
        await PushNotificationService.sendToUser(
          user.id,
          'Happy Birthday! 🎉',
          `Wishing you a fantastic birthday from the AttendX team, ${user.name}! 🎂`
        ).catch(e => console.error('[Push] Failed to send birthday push:', e));
      }

      // 3. Update tracking field
      await prisma.user.update({
        where: { id: user.id },
        data: { lastBirthdayEmailSentAt: new Date() },
      });
    }
  }

  /**
   * Checks all users for birthdays today (IST) and sends greetings if not already sent.
   */
  static async ensureBirthdaySentForAll(): Promise<{ sentCount: number; recipients: string[] }> {
    const todayStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const todayIST = new Date(todayStr);
    const month = todayIST.getMonth() + 1;
    const day = todayIST.getDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayIstIso = `${todayIST.getFullYear()}-${pad(month)}-${pad(day)}`;

    // Query users with birthday today and not yet sent today (or never sent)
    const users = await prisma.$queryRaw<any[]>`
      SELECT id, email, name
      FROM "users"
      WHERE birthday IS NOT NULL
        AND EXTRACT(MONTH FROM birthday) = ${month}
        AND EXTRACT(DAY FROM birthday) = ${day}
        AND ("lastBirthdayEmailSentAt" IS NULL OR DATE(("lastBirthdayEmailSentAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata') <> ${todayIstIso}::date)
    `;

    const recipients: string[] = [];
    for (const user of users) {
      if (user.email && user.name) {
        console.log(`[BirthdayService] Sending birthday greeting to ${user.email} (${user.name})`);
        await EmailService.sendBirthdayGreeting(user.email, user.name).catch(e => console.error(e));

        if (user.id) {
          await PushNotificationService.sendToUser(
            user.id,
            'Happy Birthday! 🎉',
            `Wishing you a fantastic birthday from the AttendX team, ${user.name}! 🎂`
          ).catch(e => console.error('[Push] Failed to send birthday push:', e));
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastBirthdayEmailSentAt: new Date() },
        });

        recipients.push(user.email);
      }
    }

    return { sentCount: recipients.length, recipients };
  }
}
