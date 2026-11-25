import { isFirebaseInitialized } from '../lib/firebase';
import { getMessaging } from 'firebase-admin/messaging';
import { prisma } from '../lib/prisma';

export class PushNotificationService {
  private static sanitizeImageUrl(imageUrl?: string): string | undefined {
    let safeImageUrl = imageUrl ? imageUrl.trim() : undefined;
    if (safeImageUrl) {
      if (safeImageUrl.includes('/svg?')) {
        safeImageUrl = safeImageUrl.replace('/svg?', '/png?');
      } else if (safeImageUrl.endsWith('.svg')) {
        safeImageUrl = safeImageUrl.replace(/\.svg$/, '.png');
      }
    }
    return safeImageUrl;
  }

  private static serializeData(data?: any, safeImageUrl?: string): Record<string, string> {
    const stringifiedData: Record<string, string> = {};
    if (data) {
      for (const [key, val] of Object.entries(data)) {
        if (val !== undefined) {
          stringifiedData[key] = typeof val === 'string' ? val : JSON.stringify(val);
        }
      }
    }
    if (safeImageUrl) {
      stringifiedData.imageUrl = safeImageUrl;
      stringifiedData.avatarUrl = safeImageUrl;
    }
    return stringifiedData;
  }

  private static buildAndroidNotificationPayload(
    title: string,
    body: string,
    tag: string,
    safeImageUrl?: string
  ) {
    return {
      priority: 'high' as const,
      notification: {
        title,
        body,
        icon: 'ic_stat_attendx',
        color: '#10B981',
        channelId: 'class_alerts',
        tag,
        ...(safeImageUrl ? { imageUrl: safeImageUrl } : {}),
      },
    };
  }

  private static async purgeFailedTokens(tokens: string[], response: any) {
    if (!response || response.failureCount <= 0) return;
    const failedTokens: string[] = [];
    response.responses.forEach((resp: any, idx: number) => {
      if (!resp.success) {
        const errorCode = resp.error?.code;
        if (
          errorCode === 'messaging/invalid-registration-token' ||
          errorCode === 'messaging/registration-token-not-registered'
        ) {
          failedTokens.push(tokens[idx]);
        }
      }
    });
    if (failedTokens.length > 0) {
      await prisma.refreshToken.updateMany({
        where: { fcmToken: { in: failedTokens } },
        data: { fcmToken: null },
      }).catch(() => {});
      console.log(`[PushNotification] Purged ${failedTokens.length} dead token(s) from database.`);
    }
  }

  /**
   * Send a push notification to a specific user across all active (non-expired) registered device tokens
   */
  static async sendToUser(userId: string, title: string, body: string, data?: any, imageUrl?: string) {
    if (!isFirebaseInitialized) return false;

    try {
      const sessions = await prisma.refreshToken.findMany({
        where: {
          userId,
          fcmToken: { not: null },
          expiresAt: { gt: new Date() },
        },
        select: { fcmToken: true, lastActive: true },
        orderBy: { lastActive: 'desc' },
      });

      const tokens = Array.from(
        new Set(
          sessions
            .map((s) => (s.fcmToken || '').trim())
            .filter((t) => t.length > 0)
        )
      );
      if (tokens.length === 0) return false;

      const safeImageUrl = this.sanitizeImageUrl(imageUrl);
      const stringifiedData = this.serializeData(data, safeImageUrl);
      const notificationPayload: any = { title, body, ...(safeImageUrl ? { imageUrl: safeImageUrl } : {}) };
      const uniqueTag = `${data?.type || 'attendx'}_${data?.id || data?.announcementId || Date.now()}`;
      const androidPayload = this.buildAndroidNotificationPayload(title, body, uniqueTag, safeImageUrl);

      if (tokens.length === 1) {
        try {
          await getMessaging().send({
            token: tokens[0],
            notification: notificationPayload,
            android: androidPayload,
            data: stringifiedData,
          });
        } catch (err: any) {
          if (
            err.code === 'messaging/invalid-registration-token' ||
            err.code === 'messaging/registration-token-not-registered'
          ) {
            await prisma.refreshToken.updateMany({
              where: { fcmToken: tokens[0] },
              data: { fcmToken: null },
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
        await this.purgeFailedTokens(tokens, response);
        if (response.successCount === 0) return false;
      }
      return true;
    } catch (error) {
      console.error("[PushNotification] Failed to send to user:", error);
      return false;
    }
  }

  /**
   * Broadcast a notification to all users with an active FCM token
   */
  static async broadcastMessage(title: string, body: string, data?: any, imageUrl?: string) {
    if (!isFirebaseInitialized) return false;

    try {
      const sessions = await prisma.refreshToken.findMany({
        where: {
          fcmToken: { not: null },
          expiresAt: { gt: new Date() },
        },
        select: { fcmToken: true },
      });

      const tokens = Array.from(
        new Set(sessions.map((s) => (s.fcmToken || '').trim()).filter((t) => t.length > 0))
      );
      if (tokens.length === 0) return true;

      const BATCH_SIZE = 500;
      let successCount = 0;
      let failureCount = 0;

      const safeImageUrl = this.sanitizeImageUrl(imageUrl);
      const stringifiedData = this.serializeData(data, safeImageUrl);
      const notificationPayload: any = { title, body, ...(safeImageUrl ? { imageUrl: safeImageUrl } : {}) };
      const uniqueTag = `${data?.type || 'broadcast'}_${data?.version || data?.id || Date.now()}`;
      const androidPayload = this.buildAndroidNotificationPayload(title, body, uniqueTag, safeImageUrl);

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
        await this.purgeFailedTokens(batch, response);
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
      const userQuery = targetCondition === 'missing_birthday'
        ? { birthday: null }
        : targetCondition === 'missing_password'
          ? { passwordHash: null }
          : {};

      const users = await prisma.user.findMany({
        where: userQuery,
        select: { id: true },
      });
      const userIds = users.map((u) => u.id);
      if (userIds.length === 0) return true;

      const sessions = await prisma.refreshToken.findMany({
        where: {
          userId: { in: userIds },
          fcmToken: { not: null },
          expiresAt: { gt: new Date() },
        },
        select: { fcmToken: true },
      });

      const tokens = Array.from(
        new Set(sessions.map((s) => (s.fcmToken || '').trim()).filter((t) => t.length > 0))
      );
      if (tokens.length === 0) return true;

      const BATCH_SIZE = 500;
      let successCount = 0;
      let failureCount = 0;

      const safeImageUrl = this.sanitizeImageUrl(imageUrl);
      const stringifiedData = this.serializeData(data, safeImageUrl);
      const notificationPayload: any = { title, body, ...(safeImageUrl ? { imageUrl: safeImageUrl } : {}) };
      const uniqueTag = `${data?.type || targetCondition}_${Date.now()}`;
      const androidPayload = this.buildAndroidNotificationPayload(title, body, uniqueTag, safeImageUrl);

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
        await this.purgeFailedTokens(batch, response);
      }

      console.log(`[PushNotification] Targeted Broadcast (${targetCondition}) sent to ${successCount} devices, ${failureCount} failed.`);
      return true;
    } catch (error) {
      console.error("[PushNotification] Targeted Broadcast failed:", error);
      return false;
    }
  }

  /**
   * Broadcast an FCM notification to all enrolled members of a classroom (excluding sender).
   * Announcements are sent as high-priority data-only payloads so AttendXMessagingService always runs
   * in background/killed states to pre-buffer feeds and render unique non-overwriting tray alerts.
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

      const userIds = members.map((m) => m.userId);

      const sessions = await prisma.refreshToken.findMany({
        where: {
          userId: { in: userIds },
          fcmToken: { not: null },
          expiresAt: { gt: new Date() },
        },
        select: { fcmToken: true },
      });

      const tokens = Array.from(
        new Set(sessions.map((s) => (s.fcmToken || '').trim()).filter((t) => t.length > 0))
      );
      if (tokens.length === 0) return true;

      const stringifiedData = this.serializeData({
        route: `/classrooms/${classroomId}`,
        url: `/classrooms/${classroomId}`,
        classroomId,
        pushTitle: title,
        pushBody: body,
        ...(data || {}),
      });

      const msgType = String(data?.type || '').toLowerCase();
      const isAnnouncement =
        msgType === 'classroom_announcement' ||
        msgType === 'classroom_broadcast' ||
        msgType === 'announcement' ||
        msgType === 'classroom_poll_created' ||
        msgType === 'classroom_poll_closed' ||
        msgType === 'classroom_poll_stopped';

      const uniqueTag = `classroom_${classroomId}_${data?.announcementId || data?.pollId || data?.id || msgType || 'update'}_${Date.now()}`;
      const BATCH_SIZE = 500;
      for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
        const batch = tokens.slice(i, i + BATCH_SIZE);
        const payload: any = isAnnouncement
          ? {
              tokens: batch,
              android: { priority: 'high' as const },
              data: stringifiedData,
            }
          : {
              tokens: batch,
              notification: { title, body },
              android: this.buildAndroidNotificationPayload(title, body, uniqueTag),
              data: stringifiedData,
            };

        const response = await getMessaging().sendEachForMulticast(payload);
        await this.purgeFailedTokens(batch, response);
      }

      console.log(`[PushNotification] Broadcasted classroom notification to ${tokens.length} member device(s).`);
      return true;
    } catch (error) {
      console.error("[PushNotification] Failed to send classroom broadcast:", error);
      return false;
    }
  }
}
