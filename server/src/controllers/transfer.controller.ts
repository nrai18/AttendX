import crypto from 'crypto';
import { Response, Request } from "express";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { prisma } from "../lib/prisma";
import { TransferService } from "../services/transfer.service";
import { PushNotificationService } from "../services/push_notification.service";

// In-memory cache to deduplicate rapid confirm-sync calls within a 2-minute window
const confirmedSyncTokens = new Map<string, number>();

function sanitizeAvatarUrl(url?: string | null, seedName?: string): string {
  if (url && typeof url === "string" && url.trim().length > 0) {
    let clean = url.trim();
    if (clean.includes("/svg?")) {
      return clean.replace("/svg?", "/png?");
    }
    if (clean.endsWith(".svg")) {
      return clean.replace(/\.svg$/, ".png");
    }
    return clean;
  }
  const name = seedName || "Student";
  return `https://api.dicebear.com/7.x/notionists/png?seed=${encodeURIComponent(name)}&size=256`;
}

export class TransferController {
  
  // POST /api/transfer/send
  static async sendTransfer(req: AuthenticatedRequest, res: Response) {
    const { contextType, dateRange } = req.body;
    let payload = req.body.payload;
    const senderUserId = req.user!.userId;

    try {
      if (!contextType) {
        return res.status(400).json({ message: "contextType is required." });
      }

      // If payload is not provided, build it automatically based on context
      if (!payload || Object.keys(payload).length === 0) {
        payload = await TransferService.buildPayload(senderUserId, contextType, dateRange);
      }

      // 1. Prevent spam/stale codes: Delete any existing active code for this user
      await prisma.shareTransfer.deleteMany({
        where: {
          senderUserId: senderUserId
        }
      });

      // 2. Generate cryptographically secure 6-digit code
      const generateCode = () => crypto.randomInt(100000, 1000000).toString();
      let code = generateCode();
      
      // Ensure it's unique
      while (await prisma.shareTransfer.findUnique({ where: { code } })) {
        code = generateCode();
      }
      
      // 3. Insert with 5-minute expiry
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5);

      await prisma.shareTransfer.create({
        data: {
          code,
          senderUserId,
          contextType,
          payload,
          expiresAt
        }
      });

      return res.status(200).json({ code, expiresIn: 300 });

    } catch (error: any) {
      console.error(error);
      const msg = error.message || "Failed to generate transfer code.";
      return res.status(500).json({ message: msg });
    }
  }

  // POST /api/transfer/retrieve
  static async retrieveTransfer(req: AuthenticatedRequest, res: Response) {
    const { code } = req.body;
    const receiverUserId = req.user!.userId;

    try {
      if (!code || code.length !== 6) {
        return res.status(400).json({ message: "Invalid 6-digit code." });
      }

      // 1. Find the code
      const transfer = await prisma.shareTransfer.findUnique({
        where: { code }
      });

      if (!transfer || transfer.expiresAt < new Date()) {
        if (transfer) {
          // Cleanup expired code lazily
          await prisma.shareTransfer.delete({ where: { code } });
        }
        return res.status(404).json({ message: "Code is invalid or has expired." });
      }

      // 2. Security Guardrail: Prevent self-retrieval
      if (transfer.senderUserId === receiverUserId) {
        return res.status(403).json({ message: "Cannot retrieve your own shared code." });
      }

      // 3. Atomically delete and return the row (Single-Use Guarantee)
      // Keep transfer active during its 5-minute TTL so preview cancel doesn't burn the code
      // and multi-peer group syncs can redeem it before expiry.

      const sender = await prisma.user.findUnique({
        where: { id: transfer.senderUserId },
        select: { name: true, email: true, avatarUrl: true }
      });

            const retriever = await prisma.user.findUnique({
        where: { id: receiverUserId },
        select: { name: true, email: true, avatarUrl: true }
      });

      const safeRetrieverAvatar = sanitizeAvatarUrl(retriever?.avatarUrl, retriever?.name || "Student");

      // Stash the senderUserId + retriever info in the response so the client
      // can call /transfer/confirm-sync AFTER the import succeeds.
      // We do NOT fire the push notification here to avoid duplicate / premature notifications.

      return res.status(200).json({
        contextType: transfer.contextType,
        payload: transfer.payload,
        sender,
        // Opaque token for confirm-sync: base64(senderUserId|retrieverName|retrieverAvatarUrl)
        _syncToken: Buffer.from(
          JSON.stringify({
            senderUserId: transfer.senderUserId,
            retrieverName: retriever?.name ?? null,
            retrieverEmail: retriever?.email ?? null,
            retrieverAvatarUrl: safeRetrieverAvatar,
          })
        ).toString("base64"),
      });

    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Failed to retrieve transfer." });
    }
  }

  // POST /api/transfer/confirm-sync
  // Called by the client AFTER a successful timetable import. Fires the push
  // notification to the original sender exactly once, with the retriever's avatar.
  static async confirmSync(req: AuthenticatedRequest, res: Response) {
    const { _syncToken } = req.body;
    if (!_syncToken) {
      return res.status(400).json({ message: "_syncToken is required." });
    }

    try {
      // 1. Deduplicate rapid repeated calls with the same token within 2 minutes
      const now = Date.now();
      for (const [key, timestamp] of confirmedSyncTokens.entries()) {
        if (now - timestamp > 120_000) confirmedSyncTokens.delete(key);
      }
      if (confirmedSyncTokens.has(_syncToken)) {
        console.log("[ConfirmSync] Dropped duplicate confirm-sync request.");
        return res.status(200).json({ ok: true, duplicate: true });
      }
      confirmedSyncTokens.set(_syncToken, now);

      let parsed: any;
      try {
        parsed = JSON.parse(Buffer.from(_syncToken, "base64").toString("utf8"));
      } catch {
        return res.status(400).json({ message: "Invalid _syncToken." });
      }

      const { senderUserId, retrieverName, retrieverEmail, retrieverAvatarUrl } = parsed;

      if (!senderUserId) {
        return res.status(400).json({ message: "Malformed _syncToken." });
      }

      const safeAvatar = sanitizeAvatarUrl(retrieverAvatarUrl, retrieverName);

      // Fire push notification to the sender — with retriever's avatar as the large icon
      await PushNotificationService.sendToUser(
        senderUserId,
        "Schedule Synced! 🎉",
        `${retrieverName || "A user"} just imported your Peer Sync schedule.`,
        {
          type: "PEER_SYNC_REDEEMED",
          retrieverName: retrieverName ?? "",
          retrieverEmail: retrieverEmail ?? "",
          avatarUrl: safeAvatar,
          imageUrl: safeAvatar,
        },
        safeAvatar   // imageUrl — shows retriever's photo in the notification
      ).catch((err) => console.error("[ConfirmSync] FCM error:", err));

      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error("[ConfirmSync] Error:", error);
      return res.status(500).json({ message: "Failed to send sync confirmation." });
    }
  }

  // GET /api/transfer/cron/cleanup
  static async cleanup(req: Request, res: Response) {
    try {
      await prisma.shareTransfer.deleteMany({
        where: {
          expiresAt: {
            lte: new Date()
          }
        }
      });
      return res.status(200).json({ status: "cleaned" });
    } catch (error) {
      return res.status(500).json({ error: "Cleanup failed" });
    }
  }
}
