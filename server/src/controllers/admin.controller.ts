import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { prisma } from "../lib/prisma";
import { AcademicTemplateService } from "../services/academic_template.service";
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

  static async broadcastNotification(req: AuthenticatedRequest, res: Response) {
    try {
      const { title, body, data, imageUrl, targetCondition } = req.body;

      if (!title || !body) {
        return res.status(400).json({ message: "Title and body are required." });
      }

      // We dynamically import it to avoid circular deps
      const { PushNotificationService } = await import("../services/push_notification.service");

      if (targetCondition === 'missing_birthday' || targetCondition === 'missing_password') {
        await PushNotificationService.broadcastToTarget(targetCondition, title, body, data, imageUrl);
      } else {
        await PushNotificationService.broadcastMessage(title, body, data, imageUrl);
      }

      res.json({ message: "Broadcast dispatched successfully." });
    } catch (error: any) {
      console.error("AdminController.broadcastNotification Error:", error);
      res.status(500).json({ message: "Failed to broadcast notification." });
    }
  }

  static async listAcademicTemplates(req: AuthenticatedRequest, res: Response) {
    try {
      const summary = await AcademicTemplateService.listAllTemplates();
      res.json(summary);
    } catch (error: any) {
      console.error("AdminController.listAcademicTemplates Error:", error);
      res.status(500).json({ message: error.message || "Failed to list academic templates" });
    }
  }

  static async getHolidayTemplate(req: AuthenticatedRequest, res: Response) {
    try {
      const year = parseInt(String(req.params.year), 10);
      const data = await AcademicTemplateService.getHolidayList(year);
      res.json(data);
    } catch (error: any) {
      console.error("AdminController.getHolidayTemplate Error:", error);
      res.status(500).json({ message: error.message || "Failed to load holiday template" });
    }
  }

  static async updateHolidayTemplate(req: AuthenticatedRequest, res: Response) {
    try {
      const year = parseInt(String(req.params.year), 10);
      const { fixedHolidays, restrictedHolidays, rewriteActiveSemesters = true } = req.body;
      const result = await AcademicTemplateService.upsertHolidayTemplate(
        year,
        { year, fixedHolidays, restrictedHolidays },
        req.user?.userId,
        rewriteActiveSemesters !== false
      );
      res.json({
        message: `Holiday list for ${year} updated (v${result.version}) and active semesters refreshed.`,
        ...result,
      });
    } catch (error: any) {
      console.error("AdminController.updateHolidayTemplate Error:", error);
      res.status(400).json({ message: error.message || "Failed to update holiday template" });
    }
  }

  static async getAcademicCalendarTemplate(req: AuthenticatedRequest, res: Response) {
    try {
      const year = parseInt(String(req.params.year), 10);
      const semesterType = String(req.params.semesterType).toLowerCase() as "even" | "odd";
      const data = await AcademicTemplateService.getAcademicCalendar({ year, semesterType });
      res.json(data);
    } catch (error: any) {
      console.error("AdminController.getAcademicCalendarTemplate Error:", error);
      res.status(500).json({ message: error.message || "Failed to load academic calendar template" });
    }
  }

  static async updateAcademicCalendarTemplate(req: AuthenticatedRequest, res: Response) {
    try {
      const year = parseInt(String(req.params.year), 10);
      const semesterType = String(req.params.semesterType).toLowerCase() as "even" | "odd";
      const { academicYear, events, rewriteActiveSemesters = true } = req.body;
      const result = await AcademicTemplateService.upsertAcademicCalendarTemplate(
        year,
        semesterType,
        { academicYear, semesterType, year, events },
        req.user?.userId,
        rewriteActiveSemesters !== false
      );
      res.json({
        message: `Academic calendar ${year} (${semesterType}) updated (v${result.version}) and active semesters refreshed.`,
        ...result,
      });
    } catch (error: any) {
      console.error("AdminController.updateAcademicCalendarTemplate Error:", error);
      res.status(400).json({ message: error.message || "Failed to update academic calendar template" });
    }
  }

  static async propagateAcademicTemplates(req: AuthenticatedRequest, res: Response) {
    try {
      const { kind = "all", year, semesterType } = req.body || {};
      const result = await AcademicTemplateService.propagateToMatchingSemesters({
        kind,
        year: year ? parseInt(String(year), 10) : undefined,
        semesterType: semesterType ? (String(semesterType).toLowerCase() as "even" | "odd") : undefined,
      });
      res.json({
        message: `Propagated backend templates across ${result.updatedSemesters} active semester(s) and invalidated forecast caches.`,
        ...result,
      });
    } catch (error: any) {
      console.error("AdminController.propagateAcademicTemplates Error:", error);
      res.status(500).json({ message: error.message || "Failed to propagate templates" });
    }
  }
}
