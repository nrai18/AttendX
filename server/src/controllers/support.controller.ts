import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { DataService } from "../services/data.service";
import { prisma } from "../lib/prisma";
import crypto from "crypto";

export class SupportController {
  static async submitFeedback(req: AuthenticatedRequest, res: Response) {
    try {
      const { type, issue, frequency, description, email, attachLogs, screenshot, deviceLogs } = req.body;
      const userId = req.user!.userId;

      let encryptedDbDump = null;

      if (attachLogs) {
        try {
          const zipBuffer = await DataService.exportData(userId);
          const algorithm = "aes-256-cbc";
          const key = process.env.LOG_ENCRYPTION_KEY || "12345678901234567890123456789012"; 
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
          type,
          issue,
          frequency,
          description,
          email,
          screenshotUrl: screenshot, // In a real app, upload base64 to Cloudinary and store URL
          deviceLogs: deviceLogs ? deviceLogs : null,
          encryptedDbDump
        }
      });

      console.log(`[TICKET RAISED] By: ${email} | Type: ${type} | Issue: ${issue} | ID: ${feedback.id}`);

      res.json({ success: true, message: "Feedback submitted successfully." });
    } catch (error: any) {
      console.error("Support Error:", error);
      res.status(500).json({ error: error.message || "Failed to submit feedback" });
    }
  }
}
