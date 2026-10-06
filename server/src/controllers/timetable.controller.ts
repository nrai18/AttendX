import { Request, Response } from "express";
import { TimetableService } from "../services/timetable.service";
import { DocumentService } from "../services/document.service";
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
      () => TimetableService.getTimetable(userId, semesterId, group)
    );
    res.json(slots);
  }

  static async getArchivedTimetables(req: Request | any, res: Response) {
    const semesterId = String(req.params.semesterId);
    const userId = req.user?.userId || "anonymous";
    const archivedSlots = await TimetableService.getArchivedTimetables(userId, semesterId);
    res.json(archivedSlots);
  }

  static async createSlot(req: AuthenticatedRequest, res: Response) {
    const slot = await TimetableService.createSlot(req.body);
    await CacheService.invalidateUser(req.user!.userId);
    res.status(201).json(slot);
  }

  static async updateSlot(req: AuthenticatedRequest, res: Response) {
    const slotId = String(req.params.id);
    const slot = await TimetableService.updateSlot(req.user!.userId, slotId, req.body);
    await CacheService.invalidateUser(req.user!.userId);
    res.json(slot);
  }


  static async swapDays(req: AuthenticatedRequest, res: Response) {
    const { semesterId, dayA, dayB } = req.body;
    if (dayA === undefined || dayB === undefined || !semesterId) {
      return res.status(400).json({ error: "Missing semesterId, dayA, or dayB" });
    }
    
    const parseDay = (day: any): number => {
      if (typeof day === 'number' && !isNaN(day)) return day;
      const d = String(day).toLowerCase();
      if (d.startsWith('mon')) return 0;
      if (d.startsWith('tue')) return 1;
      if (d.startsWith('wed')) return 2;
      if (d.startsWith('thu')) return 3;
      if (d.startsWith('fri')) return 4;
      if (d.startsWith('sat')) return 5;
      if (d.startsWith('sun')) return 6;
      return Number(day);
    };

    const parsedA = parseDay(dayA);
    const parsedB = parseDay(dayB);

    if (isNaN(parsedA) || isNaN(parsedB)) {
      return res.status(400).json({ error: "Invalid day values provided." });
    }

    const result = await TimetableService.swapDays(req.user!.userId, semesterId, parsedA, parsedB);
    await CacheService.invalidateUser(req.user!.userId);
    res.json(result);
  }

  static async shiftDay(req: AuthenticatedRequest, res: Response) {
    const { semesterId, sourceDay, targetDay } = req.body;
    if (sourceDay === undefined || targetDay === undefined || !semesterId) {
      return res.status(400).json({ error: "Missing semesterId, sourceDay, or targetDay" });
    }
    
    const parseDay = (day: any): number => {
      if (typeof day === 'number' && !isNaN(day)) return day;
      const d = String(day).toLowerCase();
      if (d.startsWith('mon')) return 0;
      if (d.startsWith('tue')) return 1;
      if (d.startsWith('wed')) return 2;
      if (d.startsWith('thu')) return 3;
      if (d.startsWith('fri')) return 4;
      if (d.startsWith('sat')) return 5;
      if (d.startsWith('sun')) return 6;
      return Number(day);
    };

    const parsedSource = parseDay(sourceDay);
    const parsedTarget = parseDay(targetDay);

    if (isNaN(parsedSource) || isNaN(parsedTarget)) {
      return res.status(400).json({ error: "Invalid day values provided." });
    }

    const result = await TimetableService.shiftDay(req.user!.userId, semesterId, parsedSource, parsedTarget);
    await CacheService.invalidateUser(req.user!.userId);
    res.json(result);
  }

  static async swapSlots(req: AuthenticatedRequest, res: Response) {
    const { slotAId, slotBId } = req.body;
    if (!slotAId || !slotBId) {
      return res.status(400).json({ error: "Missing slotAId or slotBId" });
    }
    // SEC-M03 FIX: Validate types to prevent NoSQL/MongoDB style object injection if the ORM allows it, or general bad input crashes
    if (typeof slotAId !== 'string' || typeof slotBId !== 'string') {
      return res.status(400).json({ error: "Invalid slot ID format" });
    }
    
    const result = await TimetableService.swapSlots(req.user!.userId, slotAId, slotBId);
    await CacheService.invalidateUser(req.user!.userId);
    res.json(result);
  }

  static async deleteSlot(req: AuthenticatedRequest, res: Response) {
    const slotId = String(req.params.id);
    const preserveHistory = req.query.preserveHistory !== "false";
    await TimetableService.deleteSlot(req.user!.userId, slotId, preserveHistory);
    await CacheService.invalidateUser(req.user!.userId);
    res.json({ message: "Slot deleted", preservedHistory: preserveHistory });
  }

  static async deleteSlotsBatch(req: AuthenticatedRequest, res: Response) {
    const { slotIds, preserveHistory = true } = req.body;
    if (!Array.isArray(slotIds)) {
      return res.status(400).json({ error: "slotIds array is required" });
    }
    const result = await TimetableService.deleteSlotsBatch(req.user!.userId, slotIds, preserveHistory);
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
    const result = await TimetableService.deleteSubjectSlots(req.user!.userId, semesterId, subjectId, preserveHistory);
    await CacheService.invalidateUser(req.user!.userId);
    res.json({ message: "Subject slots deleted", count: result.count, preservedHistory: preserveHistory });
  }

  static async addExtraClass(req: AuthenticatedRequest, res: Response) {
    req.body.userId = req.user!.userId;
    const extra = await TimetableService.addExtraClass(req.body);
    await CacheService.invalidateUser(req.user!.userId);
    res.status(201).json(extra);
  }

  static async deleteExtraClass(req: AuthenticatedRequest, res: Response) {
    const id = String(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "id is required" });
    }
    await TimetableService.deleteExtraClass(req.user!.userId, id);
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
      // SEC-M07 FIX: Do not trust client-supplied MIME type, check magic bytes
      const header = file.buffer.subarray(0, 4).toString("hex").toUpperCase();
      let verifiedMime = "";
      if (header.startsWith("25504446")) verifiedMime = "application/pdf";
      else if (header.startsWith("89504E47")) verifiedMime = "image/png";
      else if (header.startsWith("FFD8FF")) verifiedMime = "image/jpeg";
      
      if (!verifiedMime) {
        return res.status(400).json({ error: "Invalid file type. Only PDF, PNG, and JPEG are allowed." });
      }

      const fileName = file.originalname || "timetable.pdf";
      const ocrResult = await TimetableService.processOcrImage(file.buffer, verifiedMime, fileName, semesterId, userId);
      
      // Store document
      try {
        await DocumentService.storeDocument(userId, file.buffer, fileName, verifiedMime, "TIMETABLE");
      } catch (e) {
        console.error("Failed to store timetable document", e);
      }
      
      
const mappedSchedules: any = {};
        if (Array.isArray(ocrResult.schedules)) {
            ocrResult.schedules.forEach((s: any) => {
                const branch = s.branch;
                let semNumber = s.semester;
                if (typeof semNumber === 'string') {
                    const match = semNumber.match(/\d+/);
                    if (match) semNumber = parseInt(match[0], 10);
                }
                if (!mappedSchedules[branch]) mappedSchedules[branch] = {};
                
                let rawSlots = (s.slots || s.rawSlots || []).map((slot: any) => {
                    let code = slot.code || slot.subjectCode || "";
                    let name = slot.name || slot.subjectName || "";
                    
                    if (code.includes("/")) code = code.split("/")[0].trim();
                    if (name.includes("/")) name = "";
                    if (name.toUpperCase() === code.toUpperCase()) name = "";
                    
                    let slotType = (slot.type || slot.slotType || "lecture").toLowerCase();
                    if (slotType === "theory" || slotType === "l" || slotType === "(l)") slotType = "lecture";
                    if (slotType === "practical" || slotType === "lab" || slotType === "p" || slotType === "(p)") slotType = "practical";
                    
                    return {
                        ...slot,
                        code,
                        name,
                        type: slotType, // for frontend preview pill
                        slotType, // for backend db insertion
                        group: slot.group || slot.labGroup || "ALL",
                        isElective: code.toUpperCase().includes("SE3") || code.toUpperCase().includes("SE4") || code.toUpperCase().startsWith("SCMS") || code.toUpperCase().startsWith("SEMS"),
                          isProgramElective: code.toUpperCase().includes("SE3") || code.toUpperCase().includes("SE4"),
                          isMinorElective: code.toUpperCase().startsWith("SCMS") || code.toUpperCase().startsWith("SEMS")

                    };
                });
                
                // Merge consecutive practical slots (100 mins)
                const mergedSlots: any[] = [];
                // Sort by day and start time to reliably find consecutive slots
                rawSlots.sort((a: any, b: any) => {
                    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
                    return a.startTime.localeCompare(b.startTime);
                });
                
                for (const slot of rawSlots) {
                    if (mergedSlots.length > 0) {
                        const last = mergedSlots[mergedSlots.length - 1];
                        if (
                            last.dayOfWeek === slot.dayOfWeek &&
                            last.code === slot.code &&
                            last.slotType === "practical" &&
                            slot.slotType === "practical" &&
                            last.group === slot.group &&
                            last.section === slot.section &&
                            last.endTime === slot.startTime
                        ) {
                            // Merge!
                            last.endTime = slot.endTime;
                            continue;
                        }
                    }
                    mergedSlots.push(slot);
                }
                
                rawSlots = mergedSlots;
                
                // If semester >= 5, wipe out sections completely because they don't exist.
                // Any '3ITA1' found by AI is actually a lab group, not a section.
                if (semNumber >= 5) {
                    rawSlots.forEach((slot: any) => {
                        slot.section = "ALL";
                    });
                }
                

                const uniqueSections = Array.from(new Set(rawSlots.map((slot: any) => slot.section).filter((sec: any) => sec && sec !== "ALL")));
                
                mappedSchedules[branch][semNumber] = {
                    ...s,
                    rawSlots,
                    sections: uniqueSections,
                    hasSections: uniqueSections.length > 0 || semNumber <= 4
                };
            });
            ocrResult.schedules = mappedSchedules;
        }

        if (Array.isArray(ocrResult.detectedSemesters)) {
            ocrResult.detectedSemesters = ocrResult.detectedSemesters.map((ds: any) => {
                if (typeof ds === 'string') {
                    const match = ds.match(/\d+/);
                    return match ? parseInt(match[0], 10) : ds;
                }
                return ds;
            }).filter((n: any) => typeof n === 'number' && !isNaN(n));
        }

        res.status(200).json({ status: "needs_setup", ...ocrResult });

    } catch (error: any) {
      console.error("OCR Import Error:", error);
      res.status(500).json({ error: "Failed to process timetable file" });
    }
  }

  static async saveWizard(req: Request | any, res: Response) {
    try {
      const { semesterId, selections, rawSlots, startDate } = req.body;
      const userId = req.user?.userId;

      if (!semesterId || !userId || !selections || !rawSlots) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const { slots, newSubjectIds, existingSubjectIds } = await TimetableService.saveWizardTimetable(userId, semesterId, selections, rawSlots, startDate);
      await CacheService.invalidateUser(userId);
      res.status(201).json({ message: "Timetable generated successfully", slots, newSubjectIds, existingSubjectIds });
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
