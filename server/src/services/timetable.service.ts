import { prisma } from "../lib/prisma";


// pdf-parse is loaded lazily inside processOcrImage to avoid startup crashes in production
// (pdf-parse tries to load test files from disk at module init time)
import { COURSE_CURRICULUM, resolveSubjectName, SUBJECT_DICTIONARY, BRANCH_NAMES } from "../utils/subjectDictionary";
import { normalizeTimeString } from "../utils/timeUtils";
import { CacheService } from "./cache.service";

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
        .map(s => new Date(s.validUntil!).getTime())
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
        // Require that the cluster retired a meaningful set of slots (>= 5)
        // so individual slot edits or minor swaps do not create false archived timetables.
        const retiredInCluster = allSlots.filter(s => 
          s.validUntil && Math.abs(new Date(s.validUntil).getTime() - time) <= CLUSTER_WINDOW_MS
        ).length;
        if (retiredInCluster >= 5) {
          mutationTimes.push(time);
        }
      }
    }
    
    // Sort descending for UI (newest archives first)
    mutationTimes.sort((a, b) => b - a);
    
    const versions = mutationTimes.map((time, idx) => {
      // Reconstruct timetable exactly as it existed right before this mutation
      const activeSlotsAtTime = allSlots.filter(s => {
        const from = new Date(s.validFrom).getTime();
        const until = s.validUntil ? new Date(s.validUntil).getTime() : Infinity;
        // The slot must have been created before or at this mutation time, 
        // and must not have been deleted strictly before this mutation time.
        return from <= time && until >= time;
      });
      
      // Sort slots cleanly
      activeSlotsAtTime.sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
        return a.startTime.localeCompare(b.startTime);
      });

      // Calculate the true earliest validFrom among active slots in this version
      const earliestFrom = activeSlotsAtTime.reduce((min, s) => {
        const t = s.validFrom.getTime();
        return t < min ? t : min;
      }, Infinity);
      const validFrom = earliestFrom !== Infinity ? new Date(earliestFrom) : new Date(time);

      return {
        id: `version_${time}`,
        versionNumber: mutationTimes.length - idx,
        archivedAt: new Date(time),
        validFrom,
        validUntil: new Date(time) as Date | null,
        isCurrent: false,
        slots: activeSlotsAtTime
      };
    }).filter(v => v.slots.length > 0);

    // Re-index sequential version numbers so there are no skipped versions
    versions.forEach((v, index) => {
      v.versionNumber = versions.length - index;
    });

    // Reconstruct current active timetable version (validUntil is null)
    const currentSlots = allSlots.filter(s => s.validUntil === null);
    if (currentSlots.length > 0) {
      currentSlots.sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
        return a.startTime.localeCompare(b.startTime);
      });

      // Earliest validFrom among currently active slots (starts from semester start/phase start, e.g. 2026-09-07)
      const earliestCurrentFrom = currentSlots.reduce((min, s) => {
        const t = s.validFrom.getTime();
        return t < min ? t : min;
      }, Infinity);

      const currentVersion = {
        id: "current_version",
        versionNumber: versions.length + 1,
        archivedAt: new Date(),
        validFrom: earliestCurrentFrom !== Infinity ? new Date(earliestCurrentFrom) : new Date(),
        validUntil: null,
        isCurrent: true,
        slots: currentSlots
      };

      // Place the current timetable above Version 1
      versions.unshift(currentVersion);
    }
    
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

  static async createSlot(userId: string, data: any) {
    const ownsSemester = await prisma.semester.findFirst({
      where: { id: data.semesterId, userId }
    });
    if (!ownsSemester) throw new Error("Forbidden: Semester does not belong to user");
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
    if (slot.validUntil !== null) throw new Error("Conflict: Slot has already been modified or deleted. Please refresh.");
    return slot;
  }

  static async updateSlot(userId: string, slotId: string, data: any) {
    const oldSlot = await this.verifySlotOwnership(userId, slotId);
    
    const targetSubjId = data.subjectId !== undefined ? data.subjectId : oldSlot.subjectId;
    const targetDay = data.dayOfWeek !== undefined ? Number(data.dayOfWeek) : oldSlot.dayOfWeek;
    const normStartTime = data.startTime !== undefined ? normalizeTimeString(data.startTime, oldSlot.startTime) : oldSlot.startTime;
    const normEndTime = data.endTime !== undefined ? normalizeTimeString(data.endTime, oldSlot.endTime) : oldSlot.endTime;
    const targetRoom = data.room !== undefined ? data.room : oldSlot.room;
    const targetSlotType = data.slotType !== undefined ? data.slotType.toLowerCase() : oldSlot.slotType.toLowerCase();

    const isIdentical =
      targetSubjId === oldSlot.subjectId &&
      targetDay === oldSlot.dayOfWeek &&
      normStartTime === oldSlot.startTime &&
      normEndTime === oldSlot.endTime &&
      (targetRoom || "") === (oldSlot.room || "") &&
      targetSlotType === oldSlot.slotType.toLowerCase();

    if (isIdentical) {
      return oldSlot;
    }

    // In-place update: Routine edits to timing, room, type, day, or subject update the slot directly.
    // This preserves historical attendance foreign keys and prevents generating spurious archived versions.
    return prisma.timetableSlot.update({
      where: { id: slotId },
      data: {
        subjectId: targetSubjId,
        dayOfWeek: targetDay,
        startTime: normStartTime,
        endTime: normEndTime,
        room: targetRoom,
        slotType: targetSlotType
      },
      include: { subject: true }
    });
  }



  static async swapDays(userId: string, semesterId: string, dayA: number, dayB: number) {
    const semester = await prisma.semester.findFirst({ where: { id: semesterId, userId } });
    if (!semester) throw new Error("Semester not found or unauthorized");

    const slotsA = await prisma.timetableSlot.findMany({ where: { semesterId, dayOfWeek: dayA, validUntil: null } });
    const slotsB = await prisma.timetableSlot.findMany({ where: { semesterId, dayOfWeek: dayB, validUntil: null } });

    await prisma.$transaction(async (tx) => {
      // In-place day swap using temporary dayOfWeek = 99 to avoid any temporary state collisions
      for (const slot of slotsA) {
        await tx.timetableSlot.update({ where: { id: slot.id }, data: { dayOfWeek: 99 } });
      }
      for (const slot of slotsB) {
        await tx.timetableSlot.update({ where: { id: slot.id }, data: { dayOfWeek: dayA } });
      }
      for (const slot of slotsA) {
        await tx.timetableSlot.update({ where: { id: slot.id }, data: { dayOfWeek: dayB } });
      }
    });

    return { success: true, swapped: slotsA.length + slotsB.length };
  }

  static async shiftDay(userId: string, semesterId: string, sourceDay: number, targetDay: number) {
    const semester = await prisma.semester.findFirst({ where: { id: semesterId, userId } });
    if (!semester) throw new Error("Semester not found or unauthorized");

    await prisma.timetableSlot.updateMany({
      where: { semesterId, dayOfWeek: sourceDay, validUntil: null },
      data: { dayOfWeek: targetDay }
    });

    return { success: true };
  }

  static async swapSlots(userId: string, slotAId: string, slotBId: string) {
    const slotA = await this.verifySlotOwnership(userId, slotAId);
    const slotB = await this.verifySlotOwnership(userId, slotBId);

    const parseMins = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const formatMins = (m: number) => {
      const h = Math.floor(m / 60);
      const min = m % 60;
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    };

    const startA = parseMins(slotA.startTime);
    const endA = parseMins(slotA.endTime);
    const durA = endA - startA;

    const startB = parseMins(slotB.startTime);
    const endB = parseMins(slotB.endTime);
    const durB = endB - startB;

    const sameDay = slotA.dayOfWeek === slotB.dayOfWeek;
    const isAdjacentAB = sameDay && endA === startB;
    const isAdjacentBA = sameDay && endB === startA;

    let newStartA = startB, newEndA = startB + durA;
    let newStartB = startA, newEndB = startA + durB;

    if (isAdjacentAB) {
      // Slot A was immediately before Slot B. Swapping orders means Slot B comes first, Slot A comes second.
      // Combined block is [startA, endB].
      newStartB = startA;
      newEndB = startA + durB;
      newStartA = newEndB;
      newEndA = newEndB + durA;
    } else if (isAdjacentBA) {
      // Slot B was immediately before Slot A. Swapping orders means Slot A comes first, Slot B comes second.
      // Combined block is [startB, endA].
      newStartA = startB;
      newEndA = startB + durA;
      newStartB = newEndA;
      newEndB = newEndA + durB;
    }

    return prisma.$transaction(async (tx) => {
      // In-place logical timing swap: Preserves intrinsic class duration (e.g. 100m lab remains 100m,
      // 50m lecture remains 50m). Slots preserve their own UUIDs, subjects, and rooms.
      // No slots are retired, no attendance logs orphaned, and no spurious versions created.
      await tx.timetableSlot.update({
        where: { id: slotAId },
        data: {
          dayOfWeek: slotB.dayOfWeek,
          startTime: formatMins(newStartA),
          endTime: formatMins(newEndA),
        }
      });

      await tx.timetableSlot.update({
        where: { id: slotBId },
        data: {
          dayOfWeek: slotA.dayOfWeek,
          startTime: formatMins(newStartB),
          endTime: formatMins(newEndB),
        }
      });
    });
  }


  static async deleteSlot(userId: string, slotId: string, preserveHistory = true) {
    const slot = await prisma.timetableSlot.findUnique({
      where: { id: slotId },
      include: { semester: true }
    });

    // Ghost slot handling: if slot does not exist, detach any dangling attendance records and return success
    if (!slot) {
      await prisma.attendance.updateMany({
        where: { userId, OR: [{ timetableSlotId: slotId }, { override: { originalSlotId: slotId } }] },
        data: { timetableSlotId: null, overrideId: null },
      }).catch(() => null);
      return { success: true, ghost: true };
    }

    if (slot.semester.userId !== userId) {
      throw new Error("Forbidden: Slot does not belong to user");
    }

    if (slot.validUntil !== null) {
      // Slot is already archived/deleted
      return { success: true, alreadyArchived: true, ghost: true };
    }

    if (preserveHistory) {
      await prisma.timetableSlot.updateMany({
        where: { id: slotId, validUntil: null },
        data: { validUntil: new Date() }
      });
      return { success: true };
    }

    // Hard delete fallback
    await prisma.attendance.updateMany({
      where: { userId, OR: [{ timetableSlotId: slotId }, { override: { originalSlotId: slotId } }] },
      data: { timetableSlotId: null, overrideId: null },
    }).catch(() => null);

    await prisma.timetableOverride.deleteMany({ where: { originalSlotId: slotId } }).catch(() => null);
    await prisma.timetableSlot.delete({
      where: { id: slotId },
    }).catch(() => null);

    return { success: true };
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
        where: { id: { in: slotIds }, validUntil: null },
        data: { validUntil: new Date() }
      });
    }

    await prisma.attendance.updateMany({
      where: { userId, OR: [{ timetableSlotId: { in: slotIds } }, { override: { originalSlotId: { in: slotIds } } }] },
      data: { timetableSlotId: null, overrideId: null },
    });
    await prisma.timetableOverride.deleteMany({ where: { originalSlotId: { in: slotIds } } });
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
      return prisma.timetableSlot.updateMany({
        where: { id: { in: slotIds }, validUntil: null },
        data: { validUntil: new Date() }
      });
    }

    await prisma.attendance.updateMany({
      where: { userId, OR: [{ timetableSlotId: { in: slotIds } }, { override: { originalSlotId: { in: slotIds } } }] },
      data: { timetableSlotId: null, overrideId: null },
    });
    await prisma.timetableOverride.deleteMany({ where: { originalSlotId: { in: slotIds } } });
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
    if (!data.subjectId) throw new Error("subjectId is required for extra class");

    const subject = await prisma.subject.findFirst({
      where: { id: data.subjectId, userId: data.userId },
    });
    if (!subject) {
      throw new Error("Subject not found or has been deleted");
    }

    let semesterId = data.semesterId || subject.semesterId;
    if (!semesterId) {
      const activeSem = await prisma.semester.findFirst({
        where: { isActive: true, userId: data.userId },
      });
      semesterId = activeSem?.id;
    }

    if (!semesterId) {
      throw new Error("Unable to resolve an active semester for this user");
    }

    const ownsSemester = await prisma.semester.findFirst({
      where: { id: semesterId, userId: data.userId },
    });
    if (!ownsSemester) {
      throw new Error("Forbidden: Semester does not belong to user");
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

    // Ghost class: the override no longer exists (orphaned attendance record).
    // Gracefully clean up any dangling attendance row by its ID or overrideId and return success
    // instead of throwing — the UI can silently remove ghost entries without 500 error.
    if (!override) {
      const deletedAtt = await prisma.attendance.deleteMany({
        where: {
          userId,
          OR: [
            { id },
            { overrideId: id }
          ]
        }
      }).catch(() => null);
      return { deleted: deletedAtt?.count || 0, ghost: true };
    }

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

CRITICAL EXTRACTION RULES:
  1. TIMING: Extract exact start/end times directly from the column headers.
  2. TYPE: If a cell contains "(P)", "Lab", or "Practical", strictly set "type": "Practical". If it contains "(L)", "(T)", or "Lecture", set "type": "Theory".
  3. GROUP: If a cell specifies a specific lab batch like "3ITA1", "G1", "Batch 1", map it to "G1". If it specifies "3ITA2", "G2", map it to "G2". If it is for both groups (e.g. "3ITA1/3ITA2", "G1/G2", or no group listed), set "group": "ALL".
  4. DAY OF WEEK: Use exact 0-indexed integers. Monday=0, Tuesday=1, Wednesday=2, Thursday=3, Friday=4, Saturday=5, Sunday=6.

  
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
          "code": "CS201",
            "name": "Data Structures",
            "type": "Theory",
            "dayOfWeek": 0,
            "startTime": "09:00",
            "endTime": "09:50",
            "room": "Room 101",
            "section": "A",
            "group": "ALL",
            "isElective": false,
            "isProgramElective": false,
            "isMinorElective": false
          }
        ]
      }
    ]
  }

  Make sure to map the exact subject codes (e.g. SCMS301, CSSE301). Mark Program Electives with isProgramElective=true, and Minor/Open Electives with isMinorElective=true. Do not invent sections if they are not explicitly specified for a slot.`;

      const response = await AIManager.generateContent({
        model: "gemini-3.8-flash",
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
          temperature: 0.1,
          thinkingConfig: {
            thinkingLevel: 'MINIMAL'
          }
        }
      });

      const text = typeof response.text === 'function' ? response.text() : response.text;
      const cleanedText = (text || "").replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
      const parsedAiResult = JSON.parse(cleanedText || "{}");
      
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
        const c = slot.code.toUpperCase();
        if (c.includes("SE3") || c.includes("SE4") || c.startsWith("SCMS") || c.startsWith("SEMS")) {
          allElectiveCodesSet.add(c);
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
      const isElective = slot.code.toUpperCase().includes("SE3") || slot.code.toUpperCase().includes("SE4") || slot.code.toUpperCase().startsWith("SCMS") || slot.code.toUpperCase().startsWith("SEMS");
        if (!isElective && !isGroupMatch(slot.group, labGroup)) {
        return false;
      }

      // 3. Filter Electives dynamically without hardcoded subject codes
      const slotCodeUpper = slot.code.toUpperCase();
      const isElectiveSlot =  allElectiveCodesSet.has(slotCodeUpper);

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

    // If the new timetable is effective from a future date, the old one ends the day before.
    // If the new timetable is applied immediately or retroactively, the old one was active until now.
    const newStart = new Date(startDateStr);
    const now = new Date();
    let archiveTime: Date;
    if (newStart.getTime() > now.getTime()) {
      const endOfPreviousDay = new Date(newStart.getTime() - 24 * 60 * 60 * 1000);
      endOfPreviousDay.setUTCHours(23, 59, 59, 999);
      archiveTime = endOfPreviousDay;
    } else {
      archiveTime = now;
    }

    await prisma.timetableSlot.updateMany({
      where: { 
        semesterId, 
        subjectId: { in: subjectIds },
        validUntil: null 
      },
      data: {
        validUntil: archiveTime
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
        // Export ALL slots — active AND archived — so receivers get full timetable history
        timetableSlots: {
          include: {
            subject: true,
          },
        },
      },
    });

    if (!semester) throw new Error("Semester not found");

    // Also export timetable overrides (extra classes, cancellations, reschedules)
    const overrides = await prisma.timetableOverride.findMany({
      where: { semesterId },
      include: {
        subject: true,
        originalSlot: { select: { id: true } },
      },
    });

    return {
      version: "2.1.0",
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
        validUntil: slot.validUntil,   // preserve exact archive boundaries
      })),
      // Overrides: extra classes, cancellations, reschedules, one-off holidays
      overrides: overrides.map((ov) => ({
        originalOverrideId: ov.id,
        date: ov.date.toISOString().split('T')[0],
        overrideType: ov.overrideType,
        originalSlotId: ov.originalSlotId ?? null,      // sender's slot UUID — mapped on import
        subjectCode: ov.subject?.code ?? null,
        subjectName: ov.subject?.name ?? null,
        startTime: ov.startTime ?? null,
        endTime: ov.endTime ?? null,
        reason: ov.reason ?? null,
      })),
    };
  }

  static async importTimetable(userId: string, semesterId: string, payload: any) {
    if (!payload || !Array.isArray(payload.subjects) || !Array.isArray(payload.slots)) {
      throw new Error("Invalid timetable payload. Must contain 'subjects' and 'slots' arrays.");
    }

    const ownsSemester = await prisma.semester.findFirst({
      where: { id: semesterId, userId }
    });
    if (!ownsSemester) throw new Error("Forbidden: Semester does not belong to user");

    // Align semester date range so historical slots & attendance fall within the semester window
    if (payload.semester?.startDate || payload.semester?.endDate) {
      const updateData: any = {};
      if (payload.semester.startDate) {
        const senderStart = new Date(payload.semester.startDate);
        if (senderStart < ownsSemester.startDate) {
          updateData.startDate = senderStart;
        }
      }
      if (payload.semester.endDate) {
        const senderEnd = new Date(payload.semester.endDate);
        if (senderEnd > ownsSemester.endDate) {
          updateData.endDate = senderEnd;
        }
      }
      if (Object.keys(updateData).length > 0) {
        await prisma.semester.update({
          where: { id: semesterId },
          data: updateData,
        });
      }
    }

    await this.safeDeleteTimetable(userId, semesterId);

    // ── 1. Subjects ──────────────────────────────────────────
    const subjectMap = new Map<string, string>();
    for (const subData of payload.subjects) {
      const trimmedName = (subData.name || "").trim();
      const trimmedCode = (subData.code || "").trim();
      const orClauses: any[] = [];
      if (trimmedCode) orClauses.push({ code: { equals: trimmedCode, mode: 'insensitive' } });
      if (trimmedName) orClauses.push({ name: { equals: trimmedName, mode: 'insensitive' } });
      let subject = orClauses.length > 0
        ? await prisma.subject.findFirst({ where: { semesterId, userId, OR: orClauses } })
        : null;
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
      if (trimmedCode) {
        subjectMap.set(trimmedCode, subject.id);
        subjectMap.set(trimmedCode.toLowerCase(), subject.id);
      }
      if (trimmedName) {
        subjectMap.set(trimmedName, subject.id);
        subjectMap.set(trimmedName.toLowerCase(), subject.id);
      }
    }

    // ── 2. Timetable Slots — preserve original validFrom / validUntil (all versions, active + archived) ──
    const seenSlots = new Set<string>();
    const slotRowsWithOriginalId: Array<{ row: any; originalId: string }> = [];

    for (const slotData of payload.slots) {
      const sc = (slotData.subjectCode || "").trim();
      const sn = (slotData.subjectName || "").trim();
      const subjectId = subjectMap.get(sc) || subjectMap.get(sc.toLowerCase()) || subjectMap.get(sn) || subjectMap.get(sn.toLowerCase());
      if (!subjectId) continue;

      // Preserve original validFrom & validUntil strictly so time-travel & archived versions work
      const validFrom = slotData.validFrom ? new Date(slotData.validFrom) : new Date();
      const validUntil = slotData.validUntil ? new Date(slotData.validUntil) : null;

      const key = `${subjectId}_${slotData.dayOfWeek}_${slotData.startTime}_${slotData.endTime}_${validFrom.toISOString()}`;
      if (seenSlots.has(key)) continue;
      seenSlots.add(key);

      slotRowsWithOriginalId.push({
        originalId: slotData.originalId || "",
        row: {
          semesterId,
          subjectId,
          dayOfWeek: Number(slotData.dayOfWeek),
          startTime: normalizeTimeString(slotData.startTime, "09:00"),
          endTime: normalizeTimeString(slotData.endTime, "10:00"),
          room: slotData.room || null,
          slotType: slotData.slotType || "lecture",
          validFrom,
          validUntil,
        },
      });
    }

    let importedSlots = 0;
    // Map: sender's original slot UUID -> receiver's new slot UUID
    const originalIdToNewId = new Map<string, string>();

    // Fetch existing slots in the semester to prevent duplicate slot generation on repeated syncs
    const existingSlots = await prisma.timetableSlot.findMany({
      where: { semesterId },
      select: { id: true, subjectId: true, dayOfWeek: true, startTime: true, endTime: true, validFrom: true }
    });
    const existingSlotMap = new Map<string, string>();
    for (const es of existingSlots) {
      const k = `${es.subjectId}_${es.dayOfWeek}_${es.startTime}_${es.endTime}_${es.validFrom.toISOString()}`;
      existingSlotMap.set(k, es.id);
    }

    for (const { row, originalId } of slotRowsWithOriginalId) {
      const k = `${row.subjectId}_${row.dayOfWeek}_${row.startTime}_${row.endTime}_${row.validFrom.toISOString()}`;
      const existingId = existingSlotMap.get(k);
      if (existingId) {
        if (originalId) originalIdToNewId.set(originalId, existingId);
        continue;
      }
      try {
        const created = await prisma.timetableSlot.create({ data: row });
        importedSlots++;
        if (originalId) originalIdToNewId.set(originalId, created.id);
      } catch (err: any) {
        if (err.code !== 'P2002') throw err;
      }
    }

    // ── 3. Academic Calendar Events ──────────────────────────
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
            userId,
            semesterId,
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

    // ── 4. Timetable Overrides (extra classes, cancellations, reschedules) ──
    let importedOverrides = 0;
    const originalOverrideIdToNewId = new Map<string, string>();

    if (payload.overrides && Array.isArray(payload.overrides) && payload.overrides.length > 0) {
      const existingOverrides = await prisma.timetableOverride.findMany({
        where: { semesterId },
        select: { date: true, overrideType: true, originalSlotId: true }
      });
      const existingOvSet = new Set(existingOverrides.map((o: any) =>
        `${o.date.toISOString().split('T')[0]}_${o.overrideType}_${o.originalSlotId ?? ''}`
      ));

      for (const ov of payload.overrides) {
        const dateStr = new Date(ov.date).toISOString().split('T')[0];
        const mappedOriginalSlotId = ov.originalSlotId ? (originalIdToNewId.get(ov.originalSlotId) ?? null) : null;

        let mappedSubjectId: string | null = null;
        if (ov.subjectCode || ov.subjectName) {
          const sc = (ov.subjectCode || "").trim();
          const sn = (ov.subjectName || "").trim();
          mappedSubjectId = subjectMap.get(sc) || subjectMap.get(sc.toLowerCase()) || subjectMap.get(sn) || subjectMap.get(sn.toLowerCase()) || null;
        }

        const dedupKey = `${dateStr}_${ov.overrideType}_${mappedOriginalSlotId ?? ''}`;
        if (existingOvSet.has(dedupKey)) continue;
        existingOvSet.add(dedupKey);

        try {
          const created = await prisma.timetableOverride.create({
            data: {
              semesterId,
              date: new Date(ov.date),
              overrideType: ov.overrideType,
              originalSlotId: mappedOriginalSlotId,
              subjectId: mappedSubjectId,
              startTime: ov.startTime ?? null,
              endTime: ov.endTime ?? null,
              reason: ov.reason ?? null,
            },
          });
          importedOverrides++;
          if (ov.originalOverrideId) originalOverrideIdToNewId.set(ov.originalOverrideId, created.id);
        } catch (err: any) {
          if (err.code !== 'P2002') throw err;
        }
      }
    }

    // ── 5. Attendance Logs ──────────────────────────────────
    // Rules:
    // - In SCHEDULE_STATUS: 'HELD' classes are conducted. Since slots exist, leaving them unmarked
    //   (no attendance row) allows the receiver to see them on the agenda and mark attendance.
    // - 'CANCELLED' or 'off': inserted as status 'off' with linked slot/override.
    // - In FULL_EXPORT: all personal attendance records (present, absent, medical, od, off)
    //   are imported and strictly linked to timetableSlotId (mapped from originalId) or overrideId!
    let importedLogs = 0;
    if (payload.lectureLogs && Array.isArray(payload.lectureLogs) && payload.lectureLogs.length > 0) {
      const existingLogs = await prisma.attendance.findMany({
        where: { userId, subject: { semesterId } },
        select: { date: true, subjectId: true, timetableSlotId: true, overrideId: true }
      });
      const existingSet = new Set(existingLogs.map((l: any) =>
        `${l.date.toISOString().split('T')[0]}_${l.subjectId}_${l.timetableSlotId || 'none'}_${l.overrideId || 'none'}`
      ));

      for (const log of payload.lectureLogs) {
        const subjectCode = log.subject?.code || log.subjectCode;
        const subjectName = log.subject?.name || log.subjectName;
        const subjectId = subjectMap.get(subjectCode) || subjectMap.get(subjectName);
        if (!subjectId) continue;

        let mappedStatus: string | null = log.status;

        // In SCHEDULE_STATUS mode, 'HELD' means conducted. Omit personal attendance record so it appears unmarked for the receiver
        if (mappedStatus === "HELD") {
          continue;
        }

        if (mappedStatus === "CANCELLED" || mappedStatus === "cancelled") {
          mappedStatus = "off";
        }

        // Validate allowed AttendanceStatus enum values
        const allowedStatuses = ["present", "absent", "off", "cancelled", "medical", "od"];
        if (!allowedStatuses.includes(mappedStatus || "")) {
          continue;
        }

        const dateStr = new Date(log.date).toISOString().split('T')[0];
        const slotKey = log.slot || log.timetableSlotId;
        const timetableSlotId = slotKey ? (originalIdToNewId.get(slotKey) ?? null) : null;
        const overrideKey = log.overrideId;
        const overrideId = overrideKey ? (originalOverrideIdToNewId.get(overrideKey) ?? null) : null;

        const dedupKey = `${dateStr}_${subjectId}_${timetableSlotId || 'none'}_${overrideId || 'none'}`;
        if (existingSet.has(dedupKey)) continue;
        existingSet.add(dedupKey);

        try {
          await prisma.attendance.create({
            data: {
              userId,
              subjectId,
              date: new Date(log.date),
              status: mappedStatus as any,
              timetableSlotId,
              overrideId,
              remarks: log.remarks || null,
            }
          });
          importedLogs++;
        } catch (err: any) {
          if (err.code !== 'P2002') throw err;
        }
      }
    }

    return {
      importedSubjects: payload.subjects.length,
      importedSlots,
      importedOverrides,
      importedEvents,
      importedLogs
    };
  }
}
