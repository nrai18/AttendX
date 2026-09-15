import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { prisma } from "../lib/prisma";
import crypto from "crypto";

export class AdminController {
  static async getFeedbackLogs(req: AuthenticatedRequest, res: Response) {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      const [feedbacks, total] = await Promise.all([
        prisma.feedback.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: { name: true, email: true, rollNumber: true, role: true }
            }
          }
        }),
        prisma.feedback.count()
      ]);

      // Strip out the heavy encryptedDbDump from the listing to save bandwidth
      const sanitizedFeedbacks = feedbacks.map(f => {
        const { encryptedDbDump, ...rest } = f;
        return {
          ...rest,
          hasDbDump: !!encryptedDbDump
        };
      });

      res.json({
        feedbacks: sanitizedFeedbacks,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error: any) {
      console.error("AdminController.getFeedbackLogs Error:", error);
      res.status(500).json({ message: "Failed to fetch feedback logs" });
    }
  }

  static async downloadDecryptedLog(req: AuthenticatedRequest, res: Response) {
    try {
      const id = req.params.id as string;
      
      const feedback = await prisma.feedback.findUnique({
        where: { id }
      });

      if (!feedback) {
        return res.status(404).json({ message: "Feedback not found" });
      }

      if (!feedback.encryptedDbDump) {
        return res.status(404).json({ message: "No encrypted logs attached to this feedback" });
      }

      const key = process.env.LOG_ENCRYPTION_KEY;
      if (!key || key.length !== 32) {
        throw new Error("Server configuration error: LOG_ENCRYPTION_KEY is missing or invalid.");
      }

      const encryptedBuffer = Buffer.from(feedback.encryptedDbDump, "base64");
      
      // The first 16 bytes are the IV
      const iv = encryptedBuffer.slice(0, 16);
      const encryptedData = encryptedBuffer.slice(16);
      
      const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(key), iv);
      const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="logs_${feedback.id}.zip"`);
      res.send(decrypted);

    } catch (error: any) {
      console.error("AdminController.downloadDecryptedLog Error:", error);
      res.status(500).json({ message: "Failed to decrypt and download logs" });
    }
  }
}
