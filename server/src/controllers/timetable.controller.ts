import { Request, Response } from "express";
import { TimetableService } from "../services/timetable.service";
import prisma from "../lib/prisma";
import { BRANCHES } from "../utils/subjectDictionary";

export class TimetableController {
  static async getTimetable(req: Request, res: Response) {
    const semesterId = req.params.semesterId;
    const slots = await TimetableService.getTimetable(semesterId);
    res.json(slots);
  }

  static async createSlot(req: Request, res: Response) {
    const slot = await TimetableService.createSlot(req.body);
    res.status(201).json(slot);
  }

  static async updateSlot(req: Request, res: Response) {
    const slot = await TimetableService.updateSlot(req.params.id, req.body);
    res.json(slot);
  }

  static async swapSlots(req: Request, res: Response) {
    const { slotAId, slotBId } = req.body;
    if (!slotAId || !slotBId) {
      return res.status(400).json({ error: "Missing slotAId or slotBId" });
    }
    const result = await TimetableService.swapSlots(slotAId, slotBId);
    res.json(result);
  }

  static async deleteSlot(req: Request, res: Response) {
    const preserveHistory = req.query.preserveHistory !== "false";
    await TimetableService.deleteSlot(req.params.id, preserveHistory);
    res.json({ message: "Slot deleted", preservedHistory: preserveHistory });
  }

  static async addExtraClass(req: Request, res: Response) {
    const extra = await TimetableService.addExtraClass(req.body);
    res.status(201).json(extra);
  }

  static async ocrImport(req: Request | any, res: Response) {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }
    const semesterId = req.body.semesterId;
    const userId = req.user?.userId;

    if (!semesterId || !userId) {
      return res.status(400).json({ error: "Missing semesterId or user context" });
    }

    try {
      // Prefer wizard-supplied fields (user explicitly confirmed these in the UI)
      // Fall back to DB profile values only if not provided
      let semesterName: string = req.body.semesterName || "";
      let branchCode: string   = req.body.branch       || "";
      const section: string    = req.body.section      || "";

      if (!semesterName || !branchCode) {
        // DB fallback
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { department: true, branch: true }
        });
        const semester = await prisma.semester.findUnique({
          where: { id: semesterId },
          select: { name: true }
        });
        if (!semesterName) semesterName = semester?.name || "Semester 5";
        if (!branchCode)   branchCode   = user?.branch  || "ECE";
      }

      // Map short branch code → full department name for the Gemini prompt
      const branchMeta = BRANCHES.find(b => b.code === branchCode);
      const userDepartment = branchMeta ? branchMeta.department : branchCode;

      const ocrResult = await TimetableService.processOcrImage(
        req.file.buffer,
        req.file.mimetype,
        semesterId,
        userId,
        semesterName,
        userDepartment
      );
      res.status(200).json(ocrResult);
    } catch (error: any) {
      console.error("OCR Import Error:", error);
      res.status(500).json({ error: "Failed to process timetable image" });
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
      res.status(201).json({ message: "Timetable generated successfully", slots });
    } catch (error: any) {
      console.error("Wizard Save Error:", error);
      res.status(500).json({ error: "Failed to save personalized timetable" });
    }
  }

  static async safeDeleteTimetable(req: Request | any, res: Response) {
    try {
      const { semesterId } = req.params;
      const userId = req.user?.userId;
      
      if (!semesterId || !userId) {
        return res.status(400).json({ error: "Missing semesterId or user context" });
      }

      await TimetableService.safeDeleteTimetable(userId, semesterId);
      res.status(200).json({ message: "Timetable cleared successfully" });
    } catch (error: any) {
      console.error("Safe Delete Error:", error);
      res.status(500).json({ error: "Failed to clear timetable" });
    }
  }
}
