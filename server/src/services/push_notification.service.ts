import { isFirebaseInitialized } from '../lib/firebase';
import { getMessaging } from 'firebase-admin/messaging';
import { prisma } from '../lib/prisma';

export class PushNotificationService {
  /**
   * Send a push notification to a specific user
   */
  static async sendToUser(userId: string, title: string, body: string, data?: any) {
    if (!isFirebaseInitialized) return false;
    
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { fcmToken: true }
      });

      if (!user || !user.fcmToken) return false;

      await getMessaging().send({
        token: user.fcmToken,
        notification: { title, body },
        data: data || {},
      });
      
      return true;
    } catch (error) {
      console.error("[PushNotification] Failed to send to user:", error);
      return false;
    }
  }

  /**
   * Broadcast a notification to all users with an FCM token
   */
  static async broadcastMessage(title: string, body: string, data?: any) {
    if (!isFirebaseInitialized) return false;

    try {
      const users = await prisma.user.findMany({
        where: { fcmToken: { not: null } },
        select: { fcmToken: true }
      });

      const rawTokens = users.map(u => u.fcmToken as string).filter(t => t.trim() !== '');
      const tokens = Array.from(new Set(rawTokens));
      if (tokens.length === 0) return true;

      const BATCH_SIZE = 500;
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
        const batch = tokens.slice(i, i + BATCH_SIZE);
        const response = await getMessaging().sendEachForMulticast({
          tokens: batch,
          notification: { title, body },
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
            await prisma.user.updateMany({
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
}
