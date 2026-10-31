import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { DataService } from "../services/data.service";
import { prisma } from "../lib/prisma";
import crypto from "crypto";
import { FailureLogRecorder } from "../utils/failureLogRecorder";
import { EmailService } from "../services/email.service";

export class SupportController {
  static async submitFeedback(req: AuthenticatedRequest, res: Response) {
    try {
      const { type, issue, frequency, description, email, attachLogs, screenshot, deviceLogs } = req.body;
      const userId = req.user!.userId;

      // Extract recent server errors for diagnostics
      const recentServerLogs = FailureLogRecorder.getRecentLogs({ userId, email, limit: 30 });
      const enrichedDeviceLogs = {
        ...(deviceLogs || {}),
        recentServerErrors: recentServerLogs.slice(0, 10),
        submittedAt: new Date().toISOString()
      };

      let encryptedDbDump = null;

      if (attachLogs) {
        try {
          const zipBuffer = await DataService.exportData(userId, {
            deviceLogs: enrichedDeviceLogs,
            userEmail: email,
            forTicket: true
          });
          const algorithm = "aes-256-cbc";
          const key = process.env.LOG_ENCRYPTION_KEY;
          if (!key || key.length !== 32) {
            console.error("LOG_ENCRYPTION_KEY is missing or invalid in production.");
            throw new Error("Failed to encrypt logs");
          }
          const iv = crypto.randomBytes(16);
          const cipher = crypto.createCipheriv(algorithm, Buffer.from(key), iv);
          const encrypted = Buffer.concat([iv, cipher.update(zipBuffer), cipher.final()]);
          encryptedDbDump = encrypted.toString("base64");
        } catch (err) {
          console.error("Failed to generate encrypted DB dump", err);
        }
      }

      const feedback = await prisma.feedback.create({
        data: {
          userId,
          type: type || "feedback",
          issue: issue || "general",
          frequency: frequency || "once",
          description,
          email,
          screenshotUrl: screenshot, // In a real app, upload base64 to Cloudinary and store URL
          deviceLogs: enrichedDeviceLogs,
          encryptedDbDump
        }
      });

      console.log(`[TICKET RAISED] By: ${email} | Type: ${type} | Issue: ${issue} | ID: ${feedback.id}`);

      // Dispatch official feedback confirmation email receipt in background
      if (email) {
        prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
          .then((u) => {
            const userName = u?.name || "Student";
            EmailService.sendFeedbackReceipt(email, userName, {
              type,
              issue: issue || type,
              description
            }).catch((err) => console.error("Failed to send feedback receipt email:", err));
          })
          .catch((err) => console.error("Failed to look up user for feedback email:", err));
      }

      res.json({ success: true, message: "Feedback submitted successfully." });
    } catch (error: any) {
      console.error("Support Error:", error);
      res.status(500).json({ error: error.message || "Failed to submit feedback" });
    }
  }
}
