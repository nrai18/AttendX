import { Request, Response } from "express";
import { TimetableService } from "../services/timetable.service";
import { SemesterService } from "../services/semester.service";
import { UserService } from "../services/user.service";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { CacheService } from "../services/cache.service";

export class TimetableController {
  static async getTimetable(req: Request | any, res: Response) {
    const semesterId = String(req.params.semesterId);
    const group = (req.query.group as string) || undefined;
    const userId = req.user?.userId || "anonymous";
    const slots = await CacheService.getOrSet(
      userId,
      `timetable:${semesterId}:${group || "all"}`,
      () => TimetableService.getTimetable(semesterId, group)
    );
    res.json(slots);
  }

  static async createSlot(req: AuthenticatedRequest, res: Response) {
    const slot = await TimetableService.createSlot(req.body);
    await CacheService.invalidateUser(req.user!.userId);
    res.status(201).json(slot);
  }

  static async updateSlot(req: AuthenticatedRequest, res: Response) {
    const slotId = String(req.params.id);
    const slot = await TimetableService.updateSlot(slotId, req.body);
    await CacheService.invalidateUser(req.user!.userId);
    res.json(slot);
  }

  static async swapSlots(req: AuthenticatedRequest, res: Response) {
    const { slotAId, slotBId } = req.body;
    if (!slotAId || !slotBId) {
      return res.status(400).json({ error: "Missing slotAId or slotBId" });
    }
    const result = await TimetableService.swapSlots(slotAId, slotBId);
    await CacheService.invalidateUser(req.user!.userId);
    res.json(result);
  }

  static async deleteSlot(req: AuthenticatedRequest, res: Response) {
    const slotId = String(req.params.id);
    const preserveHistory = req.query.preserveHistory !== "false";
    await TimetableService.deleteSlot(slotId, preserveHistory);
    await CacheService.invalidateUser(req.user!.userId);
    res.json({ message: "Slot deleted", preservedHistory: preserveHistory });
  }

  static async deleteSlotsBatch(req: AuthenticatedRequest, res: Response) {
    const { slotIds, preserveHistory = true } = req.body;
    if (!Array.isArray(slotIds)) {
      return res.status(400).json({ error: "slotIds array is required" });
    }
    const result = await TimetableService.deleteSlotsBatch(slotIds, preserveHistory);
    await CacheService.invalidateUser(req.user!.userId);
    res.json({ message: "Slots deleted", count: result.count, preservedHistory: preserveHistory });
  }

  static async deleteSubjectSlots(req: AuthenticatedRequest, res: Response) {
    const semesterId = String(req.params.semesterId);
    const subjectId = String(req.params.subjectId);
    const preserveHistory = req.query.preserveHistory !== "false";
    if (!semesterId || !subjectId) {
      return res.status(400).json({ error: "semesterId and subjectId are required" });
    }
    const result = await TimetableService.deleteSubjectSlots(semesterId, subjectId, preserveHistory);
    await CacheService.invalidateUser(req.user!.userId);
    res.json({ message: "Subject slots deleted", count: result.count, preservedHistory: preserveHistory });
  }

  static async addExtraClass(req: AuthenticatedRequest, res: Response) {
    const extra = await TimetableService.addExtraClass(req.body);
    await CacheService.invalidateUser(req.user!.userId);
    res.status(201).json(extra);
  }

  static async deleteExtraClass(req: AuthenticatedRequest, res: Response) {
    const id = String(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "id is required" });
    }
    await TimetableService.deleteExtraClass(id);
    await CacheService.invalidateUser(req.user!.userId);
    res.json({ message: "Extra class deleted" });
  }

  static async ocrImport(req: Request | any, res: Response) {
    const file = req.file || (req.files && req.files[0]);
    if (!file) {
      return res.status(400).json({ error: "No timetable PDF or image file provided" });
    }
    const semesterId = req.body.semesterId;
    const userId = req.user?.userId;

    if (!semesterId || !userId) {
      return res.status(400).json({ error: "Missing semesterId or user context" });
    }

    try {
      const mimeType = file.mimetype || "application/pdf";
      const fileName = file.originalname || "timetable.pdf";
      const ocrResult = await TimetableService.processOcrImage(file.buffer, mimeType, fileName, semesterId, userId);
      res.status(200).json(ocrResult);
    } catch (error: any) {
      console.error("OCR Import Error:", error);
      res.status(500).json({ error: "Failed to process timetable file" });
    }
  }

  static async saveWizard(req: Request | any, res: Response) {
    try {
      const { semesterId, selections, rawSlots } = req.body;
      const userId = req.user?.userId;

      if (!semesterId || !userId || !selections || !rawSlots) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const slots = await TimetableService.saveWizardTimetable(userId, semesterId, selections, rawSlots);
      await CacheService.invalidateUser(userId);
      res.status(201).json({ message: "Timetable generated successfully", slots });
    } catch (error: any) {
      console.error("Wizard Save Error:", error);
      res.status(500).json({ error: "Failed to save personalized timetable" });
    }
  }

  static async safeDeleteTimetable(req: Request | any, res: Response) {
    try {
      let semesterId = req.params.semesterId ? String(req.params.semesterId) : undefined;
      const userId = req.user?.userId;
      
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!semesterId || semesterId === "undefined" || semesterId === "null" || semesterId === "active") {
        const activeSem = await SemesterService.getActiveSemester(userId);
        if (activeSem) {
          semesterId = activeSem.id;
        }
      }

      if (semesterId && semesterId !== "undefined" && semesterId !== "null" && semesterId !== "active") {
        await TimetableService.safeDeleteTimetable(userId, semesterId);
      } else {
        await UserService.resetTimetable(userId);
      }

      await CacheService.invalidateUser(userId);
      res.status(200).json({ message: "Timetable cleared successfully" });
    } catch (error: any) {
      console.error("Safe Delete Error:", error);
      res.status(500).json({ error: error.message || "Failed to clear timetable" });
    }
  }

  static async exportTimetable(req: Request | any, res: Response) {
    try {
      const semesterId = String(req.params.semesterId);
      const userId = req.user?.userId;

      if (!semesterId || !userId) {
        return res.status(400).json({ error: "Missing semesterId or user context" });
      }

      const exportData = await TimetableService.exportTimetable(userId, semesterId);
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename=schedule_${semesterId}.json`);
      res.status(200).json(exportData);
    } catch (error: any) {
      console.error("Export Error:", error);
      res.status(500).json({ error: error.message || "Failed to export timetable" });
    }
  }

  static async importTimetable(req: Request | any, res: Response) {
    try {
      const semesterId = String(req.params.semesterId);
      const userId = req.user?.userId;
      const payload = req.body;

      if (!semesterId || !userId) {
        return res.status(400).json({ error: "Missing semesterId or user context" });
      }

      const result = await TimetableService.importTimetable(userId, semesterId, payload);
      await CacheService.invalidateUser(userId);
      res.status(200).json({ message: "Timetable imported successfully", result });
    } catch (error: any) {
      console.error("Import Error:", error);
      res.status(400).json({ error: error.message || "Failed to import timetable" });
    }
  }
}
