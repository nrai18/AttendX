import { Request, Response } from "express";
import { TimetableService } from "../services/timetable.service";
import { prisma } from "../lib/prisma";
import { BRANCHES, COURSE_CURRICULUM } from "../utils/subjectDictionary";

export class TimetableController {
  static async getTimetable(req: Request, res: Response) {
    const semesterId = String(req.params.semesterId);
    const slots = await TimetableService.getTimetable(semesterId);
    res.json(slots);
  }

  static async createSlot(req: Request, res: Response) {
    const slot = await TimetableService.createSlot(req.body);
    res.status(201).json(slot);
  }

  static async updateSlot(req: Request, res: Response) {
    const slot = await TimetableService.updateSlot(
      String(req.params.id),
      req.body,
    );
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
    await TimetableService.deleteSlot(String(req.params.id), preserveHistory);
    res.json({ message: "Slot deleted", preservedHistory: preserveHistory });
  }

  static async addExtraClass(req: Request, res: Response) {
    const extra = await TimetableService.addExtraClass({
      ...req.body,
      userId: (req as any).user?.userId,
    });
    res.status(201).json(extra);
  }

  static async exportTimetable(req: Request | any, res: Response) {
    try {
      const userId = req.user?.userId;
      const semesterId = String(
        req.params.semesterId || req.query.semesterId || "",
      );
      if (!userId) {
        return res.status(401).json({ error: "Missing user context" });
      }

      const payload = await TimetableService.exportTimetable(
        userId,
        semesterId,
      );
      res.status(200).json(payload);
    } catch (error: any) {
      console.error("Export timetable error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to export timetable" });
    }
  }

  static async importTimetable(req: Request | any, res: Response) {
    try {
      const userId = req.user?.userId;
      const semesterId = String(req.params.semesterId);
      if (!userId || !semesterId) {
        return res
          .status(400)
          .json({ error: "Missing user or semester context" });
      }

      const payload = req.body;
      const slots = await TimetableService.importTimetable(
        userId,
        semesterId,
        payload,
      );
      res
        .status(200)
        .json({ message: "Timetable imported successfully", slots });
    } catch (error: any) {
      console.error("Import timetable error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to import timetable" });
    }
  }

  static async ocrImport(req: Request | any, res: Response) {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    // STRICT IMAGE-ONLY VALIDATION
    const validMimeTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!validMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        error: `Unsupported file type. Only JPG, JPEG, and PNG images are allowed to ensure accurate grid parsing.`,
      });
    }

    const semesterId = req.body.semesterId;
    const userId = req.user?.userId;

    if (!semesterId || !userId) {
      return res
        .status(400)
        .json({ error: "Missing semesterId or user context" });
    }

    try {
      let semesterName: string = req.body.semesterName || "";
      let branchCode: string = req.body.branch || "";

      if (!semesterName || !branchCode) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { department: true },
        });
        const semester = await prisma.semester.findUnique({
          where: { id: semesterId },
          select: { name: true },
        });
        if (!semesterName) semesterName = semester?.name || "Semester 5";
        if (!branchCode) branchCode = user?.department || "ECE";
      }

      const branchMeta = BRANCHES.find((b) => b.code === branchCode);
      const userDepartment = branchMeta ? branchMeta.department : branchCode;

      const ocrResult = await TimetableService.processOcrImage(
        req.file.buffer,
        req.file.mimetype,
        semesterId,
        userId,
        semesterName,
        userDepartment,
      );

      // DICTIONARY VERIFICATION INTERCEPTOR
      const uniqueRawCodes = new Set<string>();
      for (const slot of ocrResult.rawSlots || []) {
        // FIX: Looking for slot.code instead of slot.subject_code
        const cleanCode = String(slot.code || "")
          .replace(/\s*\([LPT]\)/gi, "")
          .trim();
        if (cleanCode) uniqueRawCodes.add(cleanCode);
      }

      const verifiedProgramElectives: { code: string; title: string }[] = [];
      const verifiedMinorElectives: { code: string; title: string }[] = [];

      uniqueRawCodes.forEach((code) => {
        if (COURSE_CURRICULUM[code]) {
          const title = COURSE_CURRICULUM[code];
          if (code.includes("SE")) {
            verifiedProgramElectives.push({ code, title });
          } else if (code.includes("MS")) {
            verifiedMinorElectives.push({ code, title });
          }
        }
      });

      // ENFORCE ELECTIVE SEMESTER CONSTRAINTS
      // Only students in the 5th to 8th semesters should have electives
      const semesterMatch = semesterName.match(/(?:semester|sem)\s*(\d+)/i) || semesterName.match(/(\d+)/);
      const semesterNumber = semesterMatch ? parseInt(semesterMatch[1], 10) : 5;
      const shouldHaveElectives = semesterNumber >= 5;

      ocrResult.programElectives =
        shouldHaveElectives && verifiedProgramElectives.length > 0
          ? [
              {
                id: "verified_pe",
                name: "Program Electives",
                options: verifiedProgramElectives,
              },
            ]
          : [];

      ocrResult.minorElectives =
        shouldHaveElectives && verifiedMinorElectives.length > 0
          ? [
              {
                id: "verified_me",
                name: "Minor / Open Electives",
                options: verifiedMinorElectives,
              },
            ]
          : [];

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

      // Pass directly to the service (which now handles filtering and LAB renaming)
      const slots = await TimetableService.saveWizardTimetable(
        userId,
        semesterId,
        selections,
        rawSlots,
      );
      res
        .status(201)
        .json({ message: "Timetable generated successfully", slots });
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
        return res
          .status(400)
          .json({ error: "Missing semesterId or user context" });
      }

      await TimetableService.safeDeleteTimetable(userId, semesterId);
      res.status(200).json({ message: "Timetable cleared successfully" });
    } catch (error: any) {
      console.error("Safe Delete Error:", error);
      res.status(500).json({ error: "Failed to clear timetable" });
    }
  }
}
