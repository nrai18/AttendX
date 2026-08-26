import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { DataService } from "../services/data.service";
import crypto from "crypto";
import fs from "fs";
import path from "path";

export class SupportController {
  static async submitFeedback(req: AuthenticatedRequest, res: Response) {
    try {
      const { type, issue, frequency, description, email, attachLogs } = req.body;
      const userId = req.user!.userId;

      let logFileBase64 = null;
      let logFileName = null;

      if (attachLogs) {
        // Get the zip buffer from DataService (the same one we use for export)
        const zipBuffer = await DataService.exportData(userId);
        
        // Encrypt the buffer to a .bin file
        const algorithm = "aes-256-cbc";
        // Use a secure key from env, fallback to static for demo
        const key = process.env.LOG_ENCRYPTION_KEY || "12345678901234567890123456789012"; 
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, Buffer.from(key), iv);
        
        const encrypted = Buffer.concat([iv, cipher.update(zipBuffer), cipher.final()]);
        
        logFileBase64 = encrypted.toString("base64");
        logFileName = `logs_${userId}_${Date.now()}.bin`;
      }

      // Here you would normally send an email via SendGrid, NodeMailer, etc.
      // For now, we will just log it and store it or return success.
      console.log(`[TICKET RAISED] By: ${email} | Type: ${type} | Issue: ${issue}`);
      if (attachLogs) {
        console.log(`[TICKET LOGS] Encrypted binary file generated: ${logFileName}`);
      }

      // For demonstration, we just return success
      res.json({ success: true, message: "Feedback submitted successfully." });
    } catch (error: any) {
      console.error("Support Error:", error);
      res.status(500).json({ error: error.message || "Failed to submit feedback" });
    }
  }
}
