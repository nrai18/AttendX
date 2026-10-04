import { isFirebaseInitialized } from '../lib/firebase';
import { getMessaging } from 'firebase-admin/messaging';
import { prisma } from '../lib/prisma';

export class PushNotificationService {
  /**
   * Send a push notification to a specific user
   */
  static async sendToUser(userId: string, title: string, body: string, data?: any, imageUrl?: string) {
    if (!isFirebaseInitialized) return false;
    
    try {
      const sessions = await prisma.refreshToken.findMany({
        where: { userId: userId, fcmToken: { not: null } },
        select: { fcmToken: true }
      });

      if (sessions.length === 0) return false;

      const rawTokens = sessions.map(s => s.fcmToken as string).filter(t => t.trim() !== '');
      const tokens = Array.from(new Set(rawTokens));
      
      if (tokens.length === 0) return false;

      const notificationPayload: any = { title, body };
      if (imageUrl) notificationPayload.imageUrl = imageUrl;

      if (tokens.length === 1) {
        try {
          await getMessaging().send({
            token: tokens[0],
            notification: notificationPayload,
            data: data || {},
          });
        } catch (err: any) {
          if (err.code === 'messaging/invalid-registration-token' || err.code === 'messaging/registration-token-not-registered') {
            await prisma.refreshToken.updateMany({
              where: { fcmToken: tokens[0] },
              data: { fcmToken: null }
            });
            console.log(`[PushNotification] Purged 1 dead token from database.`);
          }
          throw err;
        }
      } else {
        const response = await getMessaging().sendEachForMulticast({
          tokens,
          notification: notificationPayload,
          data: data || {},
        });

        if (response.failureCount > 0) {
          const failedTokens: string[] = [];
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              const errorCode = resp.error?.code;
              if (errorCode === 'messaging/invalid-registration-token' || 
                  errorCode === 'messaging/registration-token-not-registered') {
                failedTokens.push(tokens[idx]);
              }
            }
          });

          if (failedTokens.length > 0) {
            await prisma.refreshToken.updateMany({
              where: { fcmToken: { in: failedTokens } },
              data: { fcmToken: null }
            });
            console.log(`[PushNotification] Purged ${failedTokens.length} dead token(s) from database for user ${userId}.`);
          }
        }

        if (response.successCount === 0) {
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error("[PushNotification] Failed to send to user:", error);
      return false;
    }
  }

  /**
   * Broadcast a notification to all users with an FCM token
   */
  static async broadcastMessage(title: string, body: string, data?: any, imageUrl?: string) {
    if (!isFirebaseInitialized) return false;

    try {
      const sessions = await prisma.refreshToken.findMany({
        where: { fcmToken: { not: null } },
        select: { fcmToken: true }
      });

      const rawTokens = sessions.map(s => s.fcmToken as string).filter(t => t.trim() !== '');
      const tokens = Array.from(new Set(rawTokens));
      if (tokens.length === 0) return true;

      const BATCH_SIZE = 500;
      let successCount = 0;
      let failureCount = 0;

      const notificationPayload: any = { title, body };
      if (imageUrl) notificationPayload.imageUrl = imageUrl;

      for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
        const batch = tokens.slice(i, i + BATCH_SIZE);
        const response = await getMessaging().sendEachForMulticast({
          tokens: batch,
          notification: notificationPayload,
          data: data || {},
        });
        
        successCount += response.successCount;
        failureCount += response.failureCount;

        // Clean up invalid tokens from the database
        if (response.failureCount > 0) {
          const failedTokens: string[] = [];
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              const errorCode = resp.error?.code;
              if (errorCode === 'messaging/invalid-registration-token' || 
                  errorCode === 'messaging/registration-token-not-registered') {
                failedTokens.push(batch[idx]);
              }
            }
          });
          
          if (failedTokens.length > 0) {
            await prisma.refreshToken.updateMany({
              where: { fcmToken: { in: failedTokens } },
              data: { fcmToken: null }
            });
            console.log(`[PushNotification] Purged ${failedTokens.length} dead tokens from database.`);
          }
        }
      }

      console.log(`[PushNotification] Broadcasted to ${successCount} devices, ${failureCount} failed.`);
      return true;
    } catch (error) {
      console.error("[PushNotification] Broadcast failed:", error);
      return false;
    }
  }

  /**
   * Broadcast a notification to users matching a specific condition
   */
  static async broadcastToTarget(targetCondition: 'missing_birthday' | 'missing_password', title: string, body: string, data?: any, imageUrl?: string) {
    if (!isFirebaseInitialized) return false;

    try {
      let userQuery = {};
      if (targetCondition === 'missing_birthday') {
        userQuery = { birthday: null };
      } else if (targetCondition === 'missing_password') {
        userQuery = { passwordHash: null };
      }

      const users = await prisma.user.findMany({
        where: userQuery,
        select: { id: true }
      });

      const userIds = users.map(u => u.id);
      if (userIds.length === 0) return true;

      const sessions = await prisma.refreshToken.findMany({
        where: { 
          userId: { in: userIds },
          fcmToken: { not: null } 
        },
        select: { fcmToken: true }
      });

      const rawTokens = sessions.map(s => s.fcmToken as string).filter(t => t.trim() !== '');
      const tokens = Array.from(new Set(rawTokens));
      if (tokens.length === 0) return true;

      const BATCH_SIZE = 500;
      let successCount = 0;
      let failureCount = 0;

      const notificationPayload: any = { title, body };
      if (imageUrl) notificationPayload.imageUrl = imageUrl;

      for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
        const batch = tokens.slice(i, i + BATCH_SIZE);
        const response = await getMessaging().sendEachForMulticast({
          tokens: batch,
          notification: notificationPayload,
          data: data || {},
        });
        
        successCount += response.successCount;
        failureCount += response.failureCount;

        if (response.failureCount > 0) {
          const failedTokens: string[] = [];
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              const errorCode = resp.error?.code;
              if (errorCode === 'messaging/invalid-registration-token' || 
                  errorCode === 'messaging/registration-token-not-registered') {
                failedTokens.push(batch[idx]);
              }
            }
          });
          
          if (failedTokens.length > 0) {
            await prisma.refreshToken.updateMany({
              where: { fcmToken: { in: failedTokens } },
              data: { fcmToken: null }
            });
          }
        }
      }

      console.log(`[PushNotification] Targeted Broadcast (${targetCondition}) sent to ${successCount} devices, ${failureCount} failed.`);
      return true;
    } catch (error) {
      console.error("[PushNotification] Targeted Broadcast failed:", error);
      return false;
    }
  }
}
