import { prisma } from "../lib/prisma";


// pdf-parse is loaded lazily inside processOcrImage to avoid startup crashes in production
// (pdf-parse tries to load test files from disk at module init time)
import { COURSE_CURRICULUM, resolveSubjectName, SUBJECT_DICTIONARY, BRANCH_NAMES } from "../utils/subjectDictionary";
import { normalizeTimeString } from "../utils/timeUtils";

export class TimetableService {
  
  static async getArchivedTimetables(userId: string, semesterId: string) {
    const allSlots = await prisma.timetableSlot.findMany({
      where: { 
        semesterId,
        semester: { userId }
      },
      include: { subject: true }
    });
    
    // Find all distinct mutation timestamps (when slots were archived)
    const rawMutationTimes = Array.from(new Set(
      allSlots
        .filter(s => s.validUntil !== null)
        .map(s => s.validUntil!.getTime())
    )).sort((a, b) => a - b); // Ascending order for clustering
    
    // Cluster mutations that occur within 24 hours of each other to avoid 
    // flooding the archive with micro-versions from a single editing session.
    // We keep the EARLIEST mutation in each cluster (which gives us the stable state BEFORE the edits began).
    const CLUSTER_WINDOW_MS = 24 * 60 * 60 * 1000;
    const mutationTimes: number[] = [];
    
    let currentClusterStart = -1;
    for (const time of rawMutationTimes) {
      if (currentClusterStart === -1 || time - currentClusterStart > CLUSTER_WINDOW_MS) {
        currentClusterStart = time;
        mutationTimes.push(time);
      }
    }
    
    // Sort descending for UI (newest archives first)
    mutationTimes.sort((a, b) => b - a);
    
    const versions = mutationTimes.map(time => {
      // Reconstruct timetable exactly as it existed right before this mutation
      const activeSlotsAtTime = allSlots.filter(s => {
        const from = s.validFrom.getTime();
        const until = s.validUntil ? s.validUntil.getTime() : Infinity;
        // The slot must have been created strictly before this mutation time, 
        // and must not have been deleted strictly before this mutation time.
        return from < time && until >= time;
      });
      
      // Sort slots cleanly
      activeSlotsAtTime.sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
        return a.startTime.localeCompare(b.startTime);
      });

      return {
        id: `version_${time}`,
        archivedAt: new Date(time),
        validFrom: new Date(time), // Kept for backwards compatibility with UI
        validUntil: new Date(time), // Kept for backwards compatibility with UI
        slots: activeSlotsAtTime
      };
    });
    
    return versions;
  }

  static async getTimetable(userId: string, semesterId: string, group?: string) {
    const slots = await prisma.timetableSlot.findMany({
      where: { 
        semesterId,
        semester: { userId }, // SEC-H04 FIX: Ensure semester belongs to the requester
        validUntil: null 
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
            faculty: true,
            colorHex: true,
          },
        },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    const normalized = slots.map(slot => ({
      ...slot,
      startTime: normalizeTimeString(slot.startTime, "09:00"),
      endTime: normalizeTimeString(slot.endTime, "10:00"),
    }));

    if (!group || group.toUpperCase() === "ALL") {
      return normalized;
    }

    const normTarget = group.toUpperCase().trim();
    return normalized.filter(slot => {
      const rawSlotGroup = (slot as any).group || "";
      const room = slot.room || "";
      const name = slot.subject?.name || "";
      const faculty = slot.subject?.faculty || "";
      const code = slot.subject?.code || "";
      const combined = `${rawSlotGroup} ${room} ${name} ${faculty} ${code}`.toUpperCase();

      const hasG1 = /\b(G1|GROUP\s*1|BATCH\s*1|G-1)\b/i.test(combined);
      const hasG2 = /\b(G2|GROUP\s*2|BATCH\s*2|G-2)\b/i.test(combined);
      const isShared = /\b(G1\/G2|G1,G2|G1&G2|BOTH|ALL)\b/i.test(combined) || (hasG1 && hasG2);

      if (!hasG1 && !hasG2) return true;
      if (isShared) return true;
      if (normTarget === "G1") return hasG1 && !hasG2;
      if (normTarget === "G2") return hasG2 && !hasG1;
      return true;
    });
  }

  static async createSlot(data: any) {
    return prisma.timetableSlot.create({
      data: {
        semesterId: data.semesterId,
        subjectId: data.subjectId,
        dayOfWeek: Number(data.dayOfWeek),
        startTime: normalizeTimeString(data.startTime, "09:00"),
        endTime: normalizeTimeString(data.endTime, "10:00"),
        room: data.room,
        slotType: data.slotType ? data.slotType.toLowerCase() : "lecture",
      },
      include: { subject: true },
    });
  }

  // SEC-04 FIX: Helper to verify slot ownership
  static async verifySlotOwnership(userId: string, slotId: string) {
    const slot = await prisma.timetableSlot.findUnique({
      where: { id: slotId },
      include: { semester: true }
    });
    if (!slot) throw new Error("Slot not found");
    if (slot.semester.userId !== userId) throw new Error("Forbidden: Slot does not belong to user");
    return slot;
  }

  static async updateSlot(userId: string, slotId: string, data: any) {
    const oldSlot = await this.verifySlotOwnership(userId, slotId);
    const now = new Date();
    
    return prisma.$transaction(async (tx) => {
      await tx.timetableSlot.update({
        where: { id: slotId },
        data: { validUntil: now }
      });
      
      return tx.timetableSlot.create({
        data: {
          semesterId: oldSlot.semesterId,
          subjectId: data.subjectId !== undefined ? data.subjectId : oldSlot.subjectId,
          dayOfWeek: data.dayOfWeek !== undefined ? Number(data.dayOfWeek) : oldSlot.dayOfWeek,
          startTime: data.startTime !== undefined ? normalizeTimeString(data.startTime, oldSlot.startTime) : oldSlot.startTime,
          endTime: data.endTime !== undefined ? normalizeTimeString(data.endTime, oldSlot.endTime) : oldSlot.endTime,
          room: data.room !== undefined ? data.room : oldSlot.room,
          slotType: data.slotType !== undefined ? data.slotType : oldSlot.slotType,
          validFrom: now
        },
        include: { subject: true }
      });
    });
  }


  static async swapDays(userId: string, semesterId: string, dayA: number, dayB: number) {
    const semester = await prisma.semester.findFirst({ where: { id: semesterId, userId } });
    if (!semester) throw new Error("Semester not found or unauthorized");

    const slotsA = await prisma.timetableSlot.findMany({ where: { semesterId, dayOfWeek: dayA, validUntil: null } });
    const slotsB = await prisma.timetableSlot.findMany({ where: { semesterId, dayOfWeek: dayB, validUntil: null } });
    
    const operations = [];
    const now = new Date();

    for (const slot of slotsA) {
      operations.push(prisma.timetableSlot.update({ where: { id: slot.id }, data: { validUntil: now } }));
      operations.push(prisma.timetableSlot.create({
        data: {
          semesterId: slot.semesterId,
          subjectId: slot.subjectId,
          dayOfWeek: dayB,
          startTime: slot.startTime,
          endTime: slot.endTime,
          room: slot.room,
          slotType: slot.slotType,
          validFrom: now
        }
      }));
    }
    for (const slot of slotsB) {
      operations.push(prisma.timetableSlot.update({ where: { id: slot.id }, data: { validUntil: now } }));
      operations.push(prisma.timetableSlot.create({
        data: {
          semesterId: slot.semesterId,
          subjectId: slot.subjectId,
          dayOfWeek: dayA,
          startTime: slot.startTime,
          endTime: slot.endTime,
          room: slot.room,
          slotType: slot.slotType,
          validFrom: now
        }
      }));
    }
    
    await prisma.$transaction(operations);
    
    return { success: true, swapped: slotsA.length + slotsB.length };
  }

  static async shiftDay(userId: string, semesterId: string, sourceDay: number, targetDay: number) {
    const semester = await prisma.semester.findFirst({ where: { id: semesterId, userId } });
    if (!semester) throw new Error("Semester not found or unauthorized");

    const slotsToShift = await prisma.timetableSlot.findMany({ where: { semesterId, dayOfWeek: sourceDay, validUntil: null } });
    
    const operations = [];
    const now = new Date();

    for (const slot of slotsToShift) {
      operations.push(prisma.timetableSlot.update({ where: { id: slot.id }, data: { validUntil: now } }));
      operations.push(prisma.timetableSlot.create({
        data: {
          semesterId: slot.semesterId,
          subjectId: slot.subjectId,
          dayOfWeek: targetDay,
          startTime: slot.startTime,
          endTime: slot.endTime,
          room: slot.room,
          slotType: slot.slotType,
          validFrom: now
        }
      }));
    }

    await prisma.$transaction(operations);
    return { success: true, shifted: slotsToShift.length };
  }

  static async swapSlots(userId: string, slotAId: string, slotBId: string) {
    const slotA = await this.verifySlotOwnership(userId, slotAId);
    const slotB = await this.verifySlotOwnership(userId, slotBId);

    const now = new Date();

    return prisma.$transaction([
      prisma.timetableSlot.update({
        where: { id: slotAId },
        data: { validUntil: now }
      }),
      prisma.timetableSlot.create({
        data: {
          semesterId: slotA.semesterId,
          subjectId: slotA.subjectId,
          dayOfWeek: slotA.dayOfWeek, // keeps original day
          startTime: slotB.startTime, // gets new time
          endTime: slotB.endTime, // gets new time
          room: slotA.room,
          slotType: slotA.slotType,
          validFrom: now
        }
      }),
      prisma.timetableSlot.update({
        where: { id: slotBId },
        data: { validUntil: now }
      }),
      prisma.timetableSlot.create({
        data: {
          semesterId: slotB.semesterId,
          subjectId: slotB.subjectId,
          dayOfWeek: slotB.dayOfWeek, // keeps original day
          startTime: slotA.startTime, // gets new time
          endTime: slotA.endTime, // gets new time
          room: slotB.room,
          slotType: slotB.slotType,
          validFrom: now
        }
      })
    ]);
  }

  static async deleteSlot(userId: string, slotId: string, preserveHistory = true) {
    await this.verifySlotOwnership(userId, slotId);
    
    // Always use validUntil for soft delete so we preserve history 
    // unless explicitly told otherwise.
    if (preserveHistory) {
      return prisma.timetableSlot.update({
        where: { id: slotId },
        data: { validUntil: new Date() }
      });
    }

    // Hard delete fallback (if needed for cleanup tasks)
    await prisma.attendance.updateMany({
      where: { timetableSlotId: slotId, userId },
      data: { timetableSlotId: null },
    });
    return prisma.timetableSlot.delete({
      where: { id: slotId },
    });
  }

  static async deleteSlotsBatch(userId: string, slotIds: string[], preserveHistory = true) {
    if (!slotIds || slotIds.length === 0) return { count: 0 };
    
    // SEC-04: Verify all slots belong to the user
    const slots = await prisma.timetableSlot.findMany({
      where: { id: { in: slotIds } },
      include: { semester: true }
    });
    for (const slot of slots) {
      if (slot.semester.userId !== userId) throw new Error("Forbidden: Cannot batch delete another user's slots");
    }

    if (preserveHistory) {
      return prisma.timetableSlot.updateMany({
        where: { id: { in: slotIds } },
        data: { validUntil: new Date() }
      });
    }

    await prisma.attendance.updateMany({
      where: { timetableSlotId: { in: slotIds }, userId },
      data: { timetableSlotId: null },
    });
    return prisma.timetableSlot.deleteMany({
      where: { id: { in: slotIds } },
    });
  }

  static async deleteSubjectSlots(userId: string, semesterId: string, subjectId: string, preserveHistory = true) {
    // SEC-04: Verify the semester belongs to the user
    const sem = await prisma.semester.findUnique({ where: { id: semesterId } });
    if (!sem || sem.userId !== userId) throw new Error("Forbidden: Semester does not belong to user");

    const slots = await prisma.timetableSlot.findMany({
      where: { semesterId, subjectId },
      select: { id: true },
    });
    const slotIds = slots.map((s) => s.id);
    if (slotIds.length === 0) return { count: 0 };

    if (preserveHistory) {
      await prisma.attendance.updateMany({
        where: { timetableSlotId: { in: slotIds }, userId },
        data: { timetableSlotId: null },
      });
    }
    return prisma.timetableSlot.deleteMany({
      where: { id: { in: slotIds } },
    });
  }

  static async addExtraClass(data: {
    userId?: string;
    semesterId?: string;
    subjectId: string;
    date: string | Date;
    startTime?: string;
    endTime?: string;
    reason?: string;
    markStatus?: string;
    remarks?: string;
  }) {
    if (!data.userId) throw new Error("userId is required for extra class");
    
    let semesterId = data.semesterId;
    if (!semesterId && data.subjectId) {
      const subject = await prisma.subject.findUnique({
        where: { id: data.subjectId },
      });
      if (subject?.semesterId) {
        semesterId = subject.semesterId;
      }
    }

    if (!semesterId) {
      const activeSem = await prisma.semester.findFirst({
        where: { isActive: true, userId: data.userId }, // SEC FIX: Only check the user's active semester
      });
      semesterId = activeSem?.id;
    }

    // Removed the global fallback that leaked cross-tenant data.
    if (!semesterId) {
      throw new Error("Unable to resolve an active semester for this user");
    }

    const dateObj = data.date instanceof Date ? data.date : new Date(data.date);

    const override = await prisma.timetableOverride.create({
      data: {
        semesterId,
        subjectId: data.subjectId,
        date: dateObj,
        overrideType: "extra_class",
        startTime: normalizeTimeString(data.startTime, "17:30"),
        endTime: normalizeTimeString(data.endTime, "18:20"),
        reason: data.reason || "Ad-hoc extra class",
      },
      include: { subject: true },
    });

    if (data.markStatus && data.userId) {
      await prisma.attendance.create({
        data: {
          userId: data.userId,
          subjectId: data.subjectId,
          date: dateObj,
          status: data.markStatus as any,
          overrideId: override.id,
          remarks: data.remarks || data.reason || "Previous Timetable / Extra Class",
        }
      });
    }

    return override;
  }

  static async deleteExtraClass(userId: string, id: string) {
    // SEC-05: Verify ownership
    const override = await prisma.timetableOverride.findUnique({
      where: { id },
      include: { semester: true }
    });
    if (!override) throw new Error("Extra class override not found");
    if (override.semester.userId !== userId) throw new Error("Forbidden: Override does not belong to user");

    await prisma.attendance.deleteMany({
      where: { overrideId: id, userId }
    });
    return prisma.timetableOverride.delete({
      where: { id }
    });
  }

  static async processOcrImage(fileBuffer: Buffer, mimeType: string, fileName: string, semesterId: string, userId: string) {
    let validMimeType = mimeType;
    if (!validMimeType || validMimeType === "application/octet-stream") {
      validMimeType = fileName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/png";
    }

    // Fetch the target semester to guide the OCR and prevent it from parsing the entire university timetable
    const targetSemester = await prisma.semester.findUnique({
      where: { id: semesterId },
      select: { name: true }
    });
    const targetSemName = targetSemester?.name || "the user's semester";

    try {
      const { AIManager } = require("../utils/ai_manager");
      
      const prompt = `You are an expert academic timetable parser.
Parse the attached timetable document/image.
Extract the weekly class schedule, subjects, electives, rooms, sections, and practical lab batches ONLY for semester/branch: "${targetSemName}".

CRITICAL TIMING & PERIOD RULES:
1. Slot 1: "09:00" to "09:50"
2. Slot 2: "09:50" to "10:40"
3. Slot 3: "11:00" to "11:50"
4. Slot 4: "11:50" to "12:40"
5. Slot 5: "14:00" to "14:50"
6. Slot 6: "14:50" to "15:40"
7. Slot 7: "16:00" to "16:50"

Return a JSON object containing:
{
  "detectedBranches": ["CSE", "IT", "ECE"],
  "detectedSemesters": ["Semester 1", "Semester 3"],
  "schedules": [
    {
      "branch": "CSE",
      "semester": "Semester 3",
      "slots": [
        {
          "subjectCode": "CS201",
          "subjectName": "Data Structures",
          "type": "Theory",
          "dayOfWeek": 0,
          "startTime": "09:00",
          "endTime": "09:50",
          "room": "Room 101",
          "section": "A",
          "labGroup": "ALL",
          "isElective": false
        }
      ]
    }
  ]
}`;

      const response = await AIManager.generateContent({
        model: "gemini-3.5-flash-lite",
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: fileBuffer.toString("base64"),
                  mimeType: validMimeType
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          temperature: 0.1
        }
      });

      const text = response.text();
      const parsedAiResult = JSON.parse(text || "{}");
      
      return {
        detectedBranches: parsedAiResult.detectedBranches || [],
        detectedSemesters: parsedAiResult.detectedSemesters || [],
        schedules: parsedAiResult.schedules || []
      };
    } catch (error) {
      console.error("Gemini Timetable Extraction failed:", error);
      throw new Error("Timetable Extraction failed: Could not parse document. Try again later.");
    }
  }

  static async saveWizardTimetable(userId: string, semesterId: string, selections: any, rawSlots: any[], startDateStr?: string) {
    const { branch, semester, section, labGroup } = selections;

    // Support both multi-select array and legacy single code parameters
    const selectedElectiveCodes: string[] = Array.isArray(selections.selectedElectiveCodes)
      ? selections.selectedElectiveCodes.map((c: string) => c.trim().toUpperCase())
      : Array.isArray(selections.selectedElectives)
      ? selections.selectedElectives.map((c: string) => c.trim().toUpperCase())
      : [selections.programElectiveCode, selections.minorElectiveCode].filter(Boolean).map((c: string) => c.trim().toUpperCase());

    // Archive existing active timetable slots up to the new start date
    const effectiveStart = startDateStr ? new Date(startDateStr) : new Date();
    await this.archiveTimetable(userId, semesterId, effectiveStart.toISOString());

    const colors = [
      "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899",
      "#06b6d4", "#6366f1", "#ef4444", "#14b8a6", "#a855f7"
    ];
    let colorIndex = 0;

    // Helper: Match lab group accurately (G1, G2, G1/G2, BOTH, ALL)
    const isGroupMatch = (slotGroup: string | undefined, userGroup: string | undefined) => {
      if (!slotGroup || slotGroup === "ALL" || !userGroup || userGroup === "ALL") return true;
      const normSlot = String(slotGroup).toUpperCase().replace(/\s+/g, "");
      const normUser = String(userGroup).toUpperCase().replace(/\s+/g, "");

      // Both groups share this lab (e.g. G1/G2, G1,G2, G1&G2, BOTH, ALL)
      if (
        normSlot.includes("G1/G2") ||
        normSlot.includes("G1,G2") ||
        normSlot.includes("G1&G2") ||
        normSlot.includes("BOTH") ||
        normSlot === "ALL"
      ) {
        return true;
      }

      // Group G1 student: matches G1 (and excludes G2-only)
      if (normUser === "G1") {
        return normSlot.includes("G1") && !normSlot.includes("G2");
      }

      // Group G2 student: matches G2 (and excludes G1-only)
      if (normUser === "G2") {
        return normSlot.includes("G2") && !normSlot.includes("G1");
      }

      return normSlot.includes(normUser);
    };

    // Normalize raw slots before filtering
    const normalizedRawSlots = (rawSlots || []).map(slot => {
      let group = slot.group || "ALL";
      let type = slot.type || "lecture";
      let code = (slot.code || "").trim();
      let room = (slot.room || "").trim();
      let faculty = (slot.faculty || slot.teacher || slot.instructor || "").trim();

      const combinedText = `${code} ${room} ${faculty} ${group}`.toUpperCase();

      // Check practical/lab indicators
      if (
        type === "practical" ||
        combinedText.includes("(P)") ||
        combinedText.includes(" LAB") ||
        combinedText.includes("LAB-") ||
        combinedText.includes("PRACTICAL") ||
        code.endsWith("_LAB")
      ) {
        type = "practical";
      }

      // Check group indicators
      if (
        combinedText.includes("G1/G2") ||
        combinedText.includes("G1 / G2") ||
        combinedText.includes("G1,G2") ||
        combinedText.includes("G1&G2") ||
        combinedText.includes("BOTH")
      ) {
        group = "G1/G2";
      } else if (/\bG1\b/i.test(combinedText) || combinedText.includes("(G1)") || combinedText.includes("BATCH 1") || combinedText.includes("BATCH-1") || combinedText.includes("B1")) {
        if (!/\bG2\b/i.test(combinedText) && !combinedText.includes("(G2)")) {
          group = "G1";
        }
      } else if (/\bG2\b/i.test(combinedText) || combinedText.includes("(G2)") || combinedText.includes("BATCH 2") || combinedText.includes("BATCH-2") || combinedText.includes("B2")) {
        if (!/\bG1\b/i.test(combinedText) && !combinedText.includes("(G1)")) {
          group = "G2";
        }
      }

      // Clean subject code of (P), (L), (T), and group tags
      code = code
        .replace(/\s*\([LPT]\)/gi, "")
        .replace(/\s*\b(G1\/G2|G1|G2|B1|B2)\b/gi, "")
        .replace(/\s*_LAB$/gi, "")
        .trim();

      let startTime = normalizeTimeString(slot.startTime, "09:00");
      let endTime = normalizeTimeString(slot.endTime, "10:00");

      // Expand 50-minute practicals to standard 100-minute lab block
      if (type === "practical") {
        if (startTime === "14:00" && endTime === "14:50") endTime = "15:40";
        else if (startTime === "11:00" && endTime === "11:50") endTime = "12:40";
        else if (startTime === "09:00" && endTime === "09:50") endTime = "10:40";
      }

      return {
        ...slot,
        code,
        group,
        type,
        startTime,
        endTime,
        room: room || null,
        faculty: faculty || null,
      };
    });

    // Detect all elective codes present in the raw slots
    const allElectiveCodesSet = new Set<string>();
    for (const slot of normalizedRawSlots) {
      if (slot.isProgramElective || slot.isMinorElective || slot.isElective) {
        allElectiveCodesSet.add(slot.code.toUpperCase());
      }
      // Also check if parallel slots exist with different codes at the same day & time
      const parallelSlot = normalizedRawSlots.find(s =>
        s !== slot &&
        s.dayOfWeek === slot.dayOfWeek &&
        s.startTime === slot.startTime &&
        s.code.toUpperCase() !== slot.code.toUpperCase()
      );
      if (parallelSlot) {
        allElectiveCodesSet.add(slot.code.toUpperCase());
        allElectiveCodesSet.add(parallelSlot.code.toUpperCase());
      }
    }

    // Filter raw slots according to user's branch, semester, section, electives, lab group
    const filteredSlots = normalizedRawSlots.filter(slot => {
      // 1. Filter section (if section is specified in slot and user selected a section)
      if (slot.section && slot.section !== "ALL" && section && section !== "ALL" && slot.section !== section) {
        return false;
      }

      // 2. Filter Lab Groups (G1 vs G2 vs G1/G2)
      if (!isGroupMatch(slot.group, labGroup)) {
        return false;
      }

      // 3. Filter Electives dynamically without hardcoded subject codes
      const slotCodeUpper = slot.code.toUpperCase();
      const isElectiveSlot = slot.isProgramElective || slot.isMinorElective || slot.isElective || allElectiveCodesSet.has(slotCodeUpper);

      if (isElectiveSlot && selectedElectiveCodes.length > 0) {
        // If this slot is an elective, only include if user selected this elective code
        if (!selectedElectiveCodes.includes(slotCodeUpper)) {
          return false;
        }
      }

      return true;
    });

    const createdSlots = [];
    const subjectsMap = new Map<string, string>(); // code -> subjectId
    const newSubjectIds = new Set<string>();
    const timetableSubjectIds = new Set<string>();

    for (const slot of filteredSlots) {
      const isLab = slot.type === "practical";
      const cleanCode = slot.code.replace(/\s*\([LPT]\)/g, '').trim();
      const actualCode = isLab ? `${cleanCode}_LAB` : cleanCode;

      const baseTitle = resolveSubjectName(cleanCode);
      const actualTitle = isLab && !baseTitle.toLowerCase().includes("lab")
        ? `${baseTitle} Lab`
        : baseTitle;

      let subjectId = subjectsMap.get(actualCode);
      const facultyName = slot.faculty || slot.teacher || slot.instructor || null;

      if (!subjectId) {
        let subject = await prisma.subject.findFirst({
          where: { semesterId, userId, code: actualCode }
        });

        if (!subject) {
          subject = await prisma.subject.create({
            data: {
              semesterId,
              userId,
              name: actualTitle,
              code: actualCode,
              faculty: facultyName,
              credits: isLab ? 2 : 4,
              colorHex: colors[colorIndex % colors.length],
            }
          });
          newSubjectIds.add(subject.id);
          colorIndex++;
        } else {
          const updateData: any = {};
          if (subject.name !== actualTitle) updateData.name = actualTitle;
          if (facultyName && !subject.faculty) updateData.faculty = facultyName;
          if (Object.keys(updateData).length > 0) {
            subject = await prisma.subject.update({
              where: { id: subject.id },
              data: updateData
            });
          }
        }
        subjectId = subject.id;
        subjectsMap.set(actualCode, subjectId);
      }

      timetableSubjectIds.add(subjectId);

      const newSlot = await prisma.timetableSlot.create({
        data: {
          semesterId,
          subjectId,
          dayOfWeek: Number(slot.dayOfWeek),
          startTime: normalizeTimeString(slot.startTime, "09:00"),
          endTime: normalizeTimeString(slot.endTime, "10:00"),
          room: slot.room || null,
          slotType: slot.type || "lecture",
          validFrom: effectiveStart,
        },
        include: { subject: true }
      });
      createdSlots.push(newSlot);
    }

    // Find existing subjects in the semester that were not part of this timetable
    const allSemesterSubjects = await prisma.subject.findMany({
      where: { semesterId, userId },
      select: { 
        id: true,
        _count: {
          select: { attendance: true }
        }
      }
    });
    
    // An existing subject can be mapped if it's unused in the timetable and has records,
    // OR it's used in the timetable but has NO records (meaning it's essentially new)
    const ghostSubjectIds = allSemesterSubjects
      .filter(s => !timetableSubjectIds.has(s.id) && s._count.attendance === 0)
      .map(s => s.id);
      
    if (ghostSubjectIds.length > 0) {
      await prisma.subject.deleteMany({
        where: { id: { in: ghostSubjectIds } }
      });
    }

    const existingSubjectIds = allSemesterSubjects
      .filter(s => !timetableSubjectIds.has(s.id) && s._count.attendance > 0)
      .map(s => s.id);

    const zeroAttendanceTimetableSubjects = allSemesterSubjects
      .filter(s => timetableSubjectIds.has(s.id) && s._count.attendance === 0)
      .map(s => s.id);

    // Merge genuinely new subjects with zero-attendance subjects
    const finalNewSubjectIds = Array.from(new Set([...Array.from(newSubjectIds), ...zeroAttendanceTimetableSubjects]));

    return { 
      slots: createdSlots, 
      newSubjectIds: finalNewSubjectIds,
      existingSubjectIds
    };
  }

  
  static async archiveTimetable(userId: string, semesterId: string, startDateStr: string) {
    const subjects = await prisma.subject.findMany({
      where: { userId, semesterId },
      select: { id: true }
    });
    const subjectIds = subjects.map(s => s.id);
    if (subjectIds.length === 0) return;

    // Set validUntil to 23:59:59.999 of the DAY BEFORE the new startDate
    const newStart = new Date(startDateStr);
    const endOfPreviousDay = new Date(newStart.getTime() - 24 * 60 * 60 * 1000);
    endOfPreviousDay.setUTCHours(23, 59, 59, 999);

    await prisma.timetableSlot.updateMany({
      where: { 
        semesterId, 
        subjectId: { in: subjectIds },
        validUntil: null 
      },
      data: {
        validUntil: endOfPreviousDay
      }
    });
  }

  static async safeDeleteTimetable(userId: string, semesterId?: string) {
    const subjects = await prisma.subject.findMany({
      where: { userId, ...(semesterId ? { semesterId } : {}) },
      select: { id: true }
    });
    const subjectIds = subjects.map(s => s.id);

    const conditions: any[] = [];
    if (semesterId) conditions.push({ semesterId });
    if (subjectIds.length > 0) conditions.push({ subjectId: { in: subjectIds } });

    if (conditions.length === 0) {
      return;
    }

    const whereCond = { OR: conditions };

    // Instead of hard-deleting the slots, we archive them by setting validUntil to now.
    // This preserves historical attendance links and adds the timetable to the Archive modal.
    try {
      await prisma.timetableSlot.updateMany({
        where: { ...whereCond, validUntil: null },
        data: { validUntil: new Date() }
      });
    } catch (err) {
      console.error("Failed to archive timetable during clear:", err);
    }
  }
  static async exportTimetable(userId: string, semesterId: string) {
    const semester = await prisma.semester.findFirst({
      where: { id: semesterId, userId },
      include: {
        subjects: true,
        timetableSlots: {
          include: {
            subject: true,
          },
        },
      },
    });

    if (!semester) throw new Error("Semester not found");

    return {
      version: "2.0.0",
      app: "AttendX",
      exportedAt: new Date().toISOString(),
      semester: {
        name: semester.name,
        startDate: semester.startDate,
        endDate: semester.endDate,
      },
      subjects: semester.subjects.map((s) => ({
        code: s.code,
        name: s.name,
        credits: s.credits,
        faculty: s.faculty,
        colorHex: s.colorHex,
        targetAttendance: s.targetAttendance,
      })),
      slots: semester.timetableSlots.map((slot) => ({
        originalId: slot.id,
        subjectCode: slot.subject?.code || "",
        subjectName: slot.subject?.name || "Subject",
        dayOfWeek: slot.dayOfWeek,
        startTime: normalizeTimeString(slot.startTime, "09:00"),
        endTime: normalizeTimeString(slot.endTime, "10:00"),
        room: slot.room,
        slotType: slot.slotType,
        validFrom: slot.validFrom,
        validUntil: slot.validUntil,
      })),
    };
  }

  static async importTimetable(userId: string, semesterId: string, payload: any) {
    if (!payload || !Array.isArray(payload.subjects) || !Array.isArray(payload.slots)) {
      throw new Error("Invalid timetable payload. Must contain 'subjects' and 'slots' arrays.");
    }

    await this.safeDeleteTimetable(userId, semesterId);

    // â”€â”€ 1. Subjects (small set, sequential is fine) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const subjectMap = new Map<string, string>();
    for (const subData of payload.subjects) {
      const codeKey = subData.code || subData.name;
      let subject = await prisma.subject.findFirst({ where: { semesterId, userId, code: codeKey } });
      if (!subject) {
        subject = await prisma.subject.create({
          data: {
            semesterId, userId,
            name: subData.name,
            code: subData.code || null,
            credits: subData.credits || 3,
            faculty: subData.faculty || null,
            colorHex: subData.colorHex || "#6366f1",
            targetAttendance: subData.targetAttendance || null,
          },
        });
      }
      subjectMap.set(codeKey, subject.id);
      if (subData.name) subjectMap.set(subData.name, subject.id);
    }

    // â”€â”€ 2. Timetable Slots â€” single batch insert â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const slotRows = payload.slots
      .map((slotData: any) => {
        const subjectId = subjectMap.get(slotData.subjectCode) || subjectMap.get(slotData.subjectName);
        if (!subjectId) return null;
        return {
          semesterId, subjectId,
          dayOfWeek: Number(slotData.dayOfWeek),
          startTime: normalizeTimeString(slotData.startTime, "09:00"),
          endTime: normalizeTimeString(slotData.endTime, "10:00"),
          room: slotData.room || null,
          slotType: slotData.slotType || "lecture",
          validFrom: slotData.validFrom ? new Date(slotData.validFrom) : null,
          validUntil: slotData.validUntil ? new Date(slotData.validUntil) : null,
        };
      })
      .filter(Boolean);

    if (slotRows.length > 0) {
      await prisma.timetableSlot.createMany({ data: slotRows, skipDuplicates: true });
    }

    // â”€â”€ 3. Academic Calendar Events â€” single batch insert â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let importedEvents = 0;
    if (payload.academicCalendar && Array.isArray(payload.academicCalendar) && payload.academicCalendar.length > 0) {
      const existingEvents = await prisma.event.findMany({
        where: { userId },
        select: { date: true, eventType: true }
      });
      const existingSet = new Set(existingEvents.map((e: any) => `${e.date.toISOString().split('T')[0]}_${e.eventType}`));

      const eventRows = payload.academicCalendar
        .map((event: any) => {
          const resolvedType = event.eventType || event.type || "holiday";
          const dateStr = new Date(event.date).toISOString().split('T')[0];
          const key = `${dateStr}_${resolvedType}`;
          if (existingSet.has(key)) return null;
          existingSet.add(key);
          return {
            userId, semesterId,
            title: event.title || event.description || "Event",
            date: new Date(event.date),
            endDate: event.endDate ? new Date(event.endDate) : null,
            eventType: resolvedType,
            isHolidayList: event.isHolidayList || false,
          };
        })
        .filter(Boolean);

      if (eventRows.length > 0) {
        const result = await prisma.event.createMany({ data: eventRows, skipDuplicates: true });
        importedEvents = result.count;
      }
    }

    // === 4. Attendance Logs ===
    let importedLogs = 0;
    if (payload.lectureLogs && Array.isArray(payload.lectureLogs) && payload.lectureLogs.length > 0) {
      const existingLogs = await prisma.attendance.findMany({
        where: { userId, subject: { semesterId } },
        select: { date: true, subjectId: true }
      });
      const existingSet = new Set(existingLogs.map((l: any) => `${l.date.toISOString().split('T')[0]}_${l.subjectId}`));

      const logRows = payload.lectureLogs
        .map((log: any) => {
          const subjectCode = log.subject?.code || log.subjectCode;
          const subjectName = log.subject?.name || log.subjectName;
          const subjectId = subjectMap.get(subjectCode) || subjectMap.get(subjectName);
          if (!subjectId) return null;

          let mappedStatus = log.status;
          if (mappedStatus === "HELD") return null;
          if (mappedStatus === "CANCELLED" || mappedStatus === "cancelled") mappedStatus = "off";

          const dateStr = new Date(log.date).toISOString().split('T')[0];
          const key = `${dateStr}_${subjectId}`;
          if (existingSet.has(key)) return null;
          existingSet.add(key);

          return { userId, subjectId, date: new Date(log.date), status: mappedStatus };
        })
        .filter(Boolean);

      if (logRows.length > 0) {
        const result = await prisma.attendance.createMany({ data: logRows, skipDuplicates: true });
        importedLogs = result.count;
      }
    }

    return {
      importedSubjects: payload.subjects.length,
      importedSlots: slotRows.length,
      importedEvents,
      importedLogs
    };
  }
}
