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
        select: { id: true, fcmToken: true, os: true, lastActive: true },
        orderBy: { lastActive: 'desc' }
      });

      if (sessions.length === 0) return false;

      // Group by OS/device type and keep only the most recently active session's token per device
      // to avoid delivering duplicate pushes to multiple/stale sessions for the same physical device.
      const tokensMap = new Map<string, string>();
      for (const s of sessions) {
        if (!s.fcmToken || !s.fcmToken.trim()) continue;
        const key = s.os ? s.os.toLowerCase() : s.fcmToken.trim();
        if (!tokensMap.has(key)) {
          tokensMap.set(key, s.fcmToken.trim());
        }
      }
      const tokens = Array.from(new Set(tokensMap.values()));
      
      if (tokens.length === 0) return false;

      // Clean image URL so Android BitmapFactory can decode it (must be PNG/JPEG, not SVG)
      let safeImageUrl: string | undefined = imageUrl ? imageUrl.trim() : undefined;
      if (safeImageUrl) {
        if (safeImageUrl.includes('/svg?')) {
          safeImageUrl = safeImageUrl.replace('/svg?', '/png?');
        } else if (safeImageUrl.endsWith('.svg')) {
          safeImageUrl = safeImageUrl.replace(/\.svg$/, '.png');
        }
      }

      const stringifiedData: Record<string, string> = {};
      if (data) {
        for (const [key, val] of Object.entries(data)) {
          stringifiedData[key] = typeof val === 'string' ? val : JSON.stringify(val);
        }
      }
      if (safeImageUrl) {
        stringifiedData.imageUrl = safeImageUrl;
        stringifiedData.avatarUrl = safeImageUrl;
      }

      const notificationPayload: any = { title, body };
      if (safeImageUrl) notificationPayload.imageUrl = safeImageUrl;

      const androidPayload: any = {
        priority: 'high',
        collapseKey: data?.type || 'attendx_notification',
        notification: {
          title,
          body,
          icon: 'ic_stat_attendx',
          color: '#10B981',
          channelId: 'class_alerts',
          tag: data?.type || 'attendx_notification',
          ...(safeImageUrl ? { imageUrl: safeImageUrl } : {})
        }
      };

      if (tokens.length === 1) {
        try {
          await getMessaging().send({
            token: tokens[0],
            notification: notificationPayload,
            android: androidPayload,
            data: stringifiedData,
          });
        } catch (err: any) {
          if (err.code === 'messaging/invalid-registration-token' || err.code === 'messaging/registration-token-not-registered') {
            await prisma.refreshToken.updateMany({
              where: { fcmToken: tokens[0] },
              data: { fcmToken: null }
            });
            console.log(`[PushNotification] Purged 1 dead token from database.`);
            return false;
          }
          throw err;
        }
      } else {
        const response = await getMessaging().sendEachForMulticast({
          tokens,
          notification: notificationPayload,
          android: androidPayload,
          data: stringifiedData,
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

      let safeImageUrl: string | undefined = imageUrl ? imageUrl.trim() : undefined;
      if (safeImageUrl) {
        if (safeImageUrl.includes('/svg?')) {
          safeImageUrl = safeImageUrl.replace('/svg?', '/png?');
        } else if (safeImageUrl.endsWith('.svg')) {
          safeImageUrl = safeImageUrl.replace(/\.svg$/, '.png');
        }
      }

      const stringifiedData: Record<string, string> = {};
      if (data) {
        for (const [key, val] of Object.entries(data)) {
          stringifiedData[key] = typeof val === 'string' ? val : JSON.stringify(val);
        }
      }
      if (safeImageUrl) {
        stringifiedData.imageUrl = safeImageUrl;
        stringifiedData.avatarUrl = safeImageUrl;
      }

      const notificationPayload: any = { title, body };
      if (safeImageUrl) notificationPayload.imageUrl = safeImageUrl;

      const androidPayload: any = {
        priority: 'high',
        collapseKey: data?.type || 'attendx_notification',
        notification: {
          title,
          body,
          icon: 'ic_stat_attendx',
          color: '#10B981',
          channelId: 'class_alerts',
          tag: data?.type || 'attendx_notification',
          ...(safeImageUrl ? { imageUrl: safeImageUrl } : {})
        }
      };

      for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
        const batch = tokens.slice(i, i + BATCH_SIZE);
        const response = await getMessaging().sendEachForMulticast({
          tokens: batch,
          notification: notificationPayload,
          android: androidPayload,
          data: stringifiedData,
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

      let safeImageUrl: string | undefined = imageUrl ? imageUrl.trim() : undefined;
      if (safeImageUrl) {
        if (safeImageUrl.includes('/svg?')) {
          safeImageUrl = safeImageUrl.replace('/svg?', '/png?');
        } else if (safeImageUrl.endsWith('.svg')) {
          safeImageUrl = safeImageUrl.replace(/\.svg$/, '.png');
        }
      }

      const stringifiedData: Record<string, string> = {};
      if (data) {
        for (const [key, val] of Object.entries(data)) {
          stringifiedData[key] = typeof val === 'string' ? val : JSON.stringify(val);
        }
      }
      if (safeImageUrl) {
        stringifiedData.imageUrl = safeImageUrl;
        stringifiedData.avatarUrl = safeImageUrl;
      }

      const notificationPayload: any = { title, body };
      if (safeImageUrl) notificationPayload.imageUrl = safeImageUrl;

      const androidPayload: any = {
        priority: 'high',
        collapseKey: data?.type || 'attendx_notification',
        notification: {
          title,
          body,
          icon: 'ic_stat_attendx',
          color: '#10B981',
          channelId: 'class_alerts',
          tag: data?.type || 'attendx_notification',
          ...(safeImageUrl ? { imageUrl: safeImageUrl } : {})
        }
      };

      for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
        const batch = tokens.slice(i, i + BATCH_SIZE);
        const response = await getMessaging().sendEachForMulticast({
          tokens: batch,
          notification: notificationPayload,
          android: androidPayload,
          data: stringifiedData,
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

  /**
   * Broadcast an FCM notification to all enrolled members of a classroom (excluding sender)
   */
  static async sendToClassroomMembers(classroomId: string, excludeUserId: string, title: string, body: string, data?: any) {
    if (!isFirebaseInitialized) return false;

    try {
      const members = await prisma.classroomMember.findMany({
        where: {
          classroomId,
          userId: { not: excludeUserId },
        },
        select: { userId: true },
      });

      if (members.length === 0) return true;

      const userIds = members.map(m => m.userId);

      const sessions = await prisma.refreshToken.findMany({
        where: {
          userId: { in: userIds },
          fcmToken: { not: null },
        },
        select: { fcmToken: true },
      });

      const rawTokens = sessions.map(s => s.fcmToken as string).filter(t => t && t.trim() !== '');
      const tokens = Array.from(new Set(rawTokens));
      if (tokens.length === 0) return true;

      const stringifiedData: Record<string, string> = {
        route: `/classrooms/${classroomId}`,
        url: `/classrooms/${classroomId}`,
        classroomId,
      };
      if (data) {
        for (const [key, val] of Object.entries(data)) {
          stringifiedData[key] = typeof val === 'string' ? val : JSON.stringify(val);
        }
      }

      const notificationPayload: any = { title, body };
      const androidPayload: any = {
        priority: 'high',
        collapseKey: `classroom_${classroomId}`,
        notification: {
          title,
          body,
          icon: 'ic_stat_attendx',
          color: '#10B981',
          channelId: 'class_alerts',
          tag: `classroom_${classroomId}`,
        },
      };

      const BATCH_SIZE = 500;
      for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
        const batch = tokens.slice(i, i + BATCH_SIZE);
        const response = await getMessaging().sendEachForMulticast({
          tokens: batch,
          notification: notificationPayload,
          android: androidPayload,
          data: stringifiedData,
        });

        // Prune stale or uninstalled tokens automatically to protect FCM quotas
        if (response.failureCount > 0) {
          const failedTokens: string[] = [];
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              const errorCode = resp.error?.code;
              if (
                errorCode === 'messaging/invalid-registration-token' ||
                errorCode === 'messaging/registration-token-not-registered'
              ) {
                failedTokens.push(batch[idx]);
              }
            }
          });

          if (failedTokens.length > 0) {
            await prisma.refreshToken.updateMany({
              where: { fcmToken: { in: failedTokens } },
              data: { fcmToken: null },
            }).catch(() => {});
          }
        }
      }

      console.log(`[PushNotification] Broadcasted classroom announcement to ${tokens.length} member device(s).`);
      return true;
    } catch (error) {
      console.error("[PushNotification] Failed to send classroom broadcast:", error);
      return false;
    }
  }
}
