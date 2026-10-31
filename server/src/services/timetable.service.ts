import crypto from "crypto";
import { prisma } from "../lib/prisma";


// pdf-parse is loaded lazily inside processOcrImage to avoid startup crashes in production
// (pdf-parse tries to load test files from disk at module init time)
import { COURSE_CURRICULUM, resolveSubjectName, SUBJECT_DICTIONARY, BRANCH_NAMES } from "../utils/subjectDictionary";
import { normalizeTimeString } from "../utils/timeUtils";
import { CacheService } from "./cache.service";

export class TimetableService {
  
  static async getArchivedTimetables(userId: string, semesterId: string) {
    if (!semesterId || semesterId === "undefined" || semesterId === "null" || semesterId === "active") {
      const activeSem = await prisma.semester.findFirst({
        where: { userId, isActive: true },
        select: { id: true }
      });
      if (activeSem) {
        semesterId = activeSem.id;
      } else {
        const latestSem = await prisma.semester.findFirst({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          select: { id: true }
        });
        if (latestSem) {
          semesterId = latestSem.id;
        }
      }
    }

    const allSlots = await prisma.timetableSlot.findMany({
      where: { 
        ...(semesterId ? { semesterId } : {}),
        semester: { userId }
      },
      include: { subject: true }
    });

    if (allSlots.length === 0) {
      return [];
    }

    const retiredSlots = allSlots.filter(s => s.validUntil !== null);
    
    // Find all distinct mutation timestamps (when slots were archived)
    const rawMutationTimes = Array.from(new Set(
      retiredSlots.map(s => new Date(s.validUntil!).getTime())
    )).sort((a, b) => b - a); // Descending order (newest first)
    
    // Cluster mutations that occur in the same editing/clearing session (within 3 minutes)
    const CLUSTER_WINDOW_MS = 3 * 60 * 1000;
    const clusterCentres: number[] = [];
    
    for (const time of rawMutationTimes) {
      const existing = clusterCentres.find(c => Math.abs(c - time) <= CLUSTER_WINDOW_MS);
      if (!existing) {
        clusterCentres.push(time);
      }
    }
    
    const versions = clusterCentres.map((time) => {
      // Reconstruct timetable exactly as it existed right before this mutation
      const activeSlotsAtTime = allSlots.filter(s => {
        const slotRetired = s.validUntil ? new Date(s.validUntil).getTime() : Infinity;
        const slotCreated = new Date(s.validFrom).getTime();

        // 1. If this slot was retired during this cluster, it is part of this version
        if (s.validUntil && Math.abs(slotRetired - time) <= CLUSTER_WINDOW_MS) {
          return true;
        }

        // 2. Otherwise, it must have been created before or around this cluster time,
        // and retired strictly after this cluster (or currently active)
        return slotCreated <= time + 60000 && slotRetired > time + CLUSTER_WINDOW_MS;
      });

      // Deduplicate slots by ID
      const uniqueSlots = Array.from(new Map(activeSlotsAtTime.map(s => [s.id, s])).values());
      
      // Sort slots cleanly
      uniqueSlots.sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
        return a.startTime.localeCompare(b.startTime);
      });

      // Calculate the true earliest validFrom among active slots in this version
      const earliestFrom = uniqueSlots.reduce((min, s) => {
        const t = new Date(s.validFrom).getTime();
        return t < min ? t : min;
      }, Infinity);
      const validFrom = earliestFrom !== Infinity && earliestFrom <= time
        ? new Date(earliestFrom)
        : new Date(time);

      return {
        id: `version_${time}`,
        versionNumber: 0, // Assigned sequentially below
        archivedAt: new Date(time),
        validFrom,
        validUntil: new Date(time) as Date | null,
        isCurrent: false,
        slots: uniqueSlots
      };
    }).filter(v => v.slots.length > 0);

    // Reconstruct current active timetable version (validUntil is null)
    const currentSlots = allSlots.filter(s => s.validUntil === null);
    if (currentSlots.length > 0) {
      currentSlots.sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
        return a.startTime.localeCompare(b.startTime);
      });

      const earliestCurrentFrom = currentSlots.reduce((min, s) => {
        const t = new Date(s.validFrom).getTime();
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

      // Place the current timetable above historical versions
      versions.unshift(currentVersion);
    }

    // Number historical versions sequentially (Version 1 = oldest, Version N = newest)
    const historical = versions.filter(v => !v.isCurrent);
    historical.forEach((v, index) => {
      v.versionNumber = historical.length - index;
    });

    if (versions.length > 0 && versions[0].isCurrent) {
      versions[0].versionNumber = historical.length + 1;
    }
    
    return versions;
  }

  static async deleteArchivedVersion(userId: string, semesterId: string, versionId: string, slotIds?: string[]) {
    if (!semesterId || semesterId === "undefined" || semesterId === "null" || semesterId === "active") {
      const activeSem = await prisma.semester.findFirst({
        where: { userId, isActive: true },
        select: { id: true }
      });
      if (activeSem) {
        semesterId = activeSem.id;
      } else {
        const latestSem = await prisma.semester.findFirst({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          select: { id: true }
        });
        if (latestSem) semesterId = latestSem.id;
      }
    }

    if (!semesterId) {
      throw new Error("No semester found to delete archived timetable version from");
    }

    const ownsSemester = await prisma.semester.findFirst({
      where: { id: semesterId, userId },
      select: { id: true }
    });
    if (!ownsSemester) {
      throw new Error("Forbidden: Semester does not belong to user");
    }

    let targetSlotIds: string[] = [];

    // 1. If explicit slot IDs were passed, filter for those belonging to this user/semester that are retired
    if (Array.isArray(slotIds) && slotIds.length > 0) {
      const validSlots = await prisma.timetableSlot.findMany({
        where: {
          id: { in: slotIds },
          semesterId,
          semester: { userId },
          validUntil: { not: null } // Never delete active slots!
        },
        select: { id: true }
      });
      targetSlotIds = validSlots.map(s => s.id);
    }

    // 2. Fallback: Parse cluster timestamp from versionId (e.g., "version_1793263700000")
    if (targetSlotIds.length === 0) {
      const match = versionId.match(/^version_(\d+)$/);
      if (match) {
        const clusterTime = Number(match[1]);
        const CLUSTER_WINDOW_MS = 3 * 60 * 1000;

        const candidateSlots = await prisma.timetableSlot.findMany({
          where: {
            semesterId,
            semester: { userId },
            validUntil: { not: null }
          },
          select: { id: true, validUntil: true }
        });

        targetSlotIds = candidateSlots
          .filter(s => s.validUntil && Math.abs(new Date(s.validUntil).getTime() - clusterTime) <= CLUSTER_WINDOW_MS)
          .map(s => s.id);
      }
    }

    if (targetSlotIds.length === 0) {
      return { count: 0, message: "No retired slots found for this archived version" };
    }

    // 3. Foreign key decoupling in parallel: decouple attendance records & overrides safely
    await Promise.all([
      prisma.attendance.updateMany({
        where: { timetableSlotId: { in: targetSlotIds } },
        data: { timetableSlotId: null }
      }),
      prisma.timetableOverride.updateMany({
        where: { originalSlotId: { in: targetSlotIds } },
        data: { originalSlotId: null }
      })
    ]);

    // 4. Delete the retired slots
    const deleteResult = await prisma.timetableSlot.deleteMany({
      where: {
        id: { in: targetSlotIds },
        validUntil: { not: null } // Strict invariant
      }
    });

    // 5. Invalidate caches
    await Promise.all([
      CacheService.del(userId, `timetable:archived:${semesterId}`),
      CacheService.del(userId, "archived_timetables"),
      CacheService.del(userId, `archived_timetables_${semesterId}`),
      CacheService.del(userId, `timetable:${semesterId}`),
      CacheService.invalidateUser(userId)
    ]);

    return {
      count: deleteResult.count,
      deletedSlotIds: targetSlotIds,
      message: "Archived timetable version deleted successfully"
    };
  }

  static async deleteAllArchivedVersions(userId: string, semesterId: string) {
    if (!semesterId || semesterId === "undefined" || semesterId === "null" || semesterId === "active") {
      const activeSem = await prisma.semester.findFirst({
        where: { userId, isActive: true },
        select: { id: true }
      });
      if (activeSem) {
        semesterId = activeSem.id;
      } else {
        const latestSem = await prisma.semester.findFirst({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          select: { id: true }
        });
        if (latestSem) semesterId = latestSem.id;
      }
    }

    if (!semesterId) {
      throw new Error("No semester found");
    }

    const candidateSlots = await prisma.timetableSlot.findMany({
      where: {
        semesterId,
        semester: { userId },
        validUntil: { not: null } // Only retired slots!
      },
      select: { id: true }
    });

    const targetSlotIds = candidateSlots.map(s => s.id);
    if (targetSlotIds.length === 0) {
      return { count: 0, message: "No archived timetable slots found to delete" };
    }

    await Promise.all([
      prisma.attendance.updateMany({
        where: { timetableSlotId: { in: targetSlotIds } },
        data: { timetableSlotId: null }
      }),
      prisma.timetableOverride.updateMany({
        where: { originalSlotId: { in: targetSlotIds } },
        data: { originalSlotId: null }
      })
    ]);

    const deleteResult = await prisma.timetableSlot.deleteMany({
      where: {
        id: { in: targetSlotIds },
        validUntil: { not: null }
      }
    });

    await Promise.all([
      CacheService.del(userId, `timetable:archived:${semesterId}`),
      CacheService.del(userId, "archived_timetables"),
      CacheService.del(userId, `archived_timetables_${semesterId}`),
      CacheService.del(userId, `timetable:${semesterId}`),
      CacheService.invalidateUser(userId)
    ]);

    return {
      count: deleteResult.count,
      message: "All archived timetable versions deleted successfully"
    };
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
    const newSlot = await prisma.timetableSlot.create({
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
    CacheService.del(userId, "onboarding:status").catch(() => {});
    return newSlot;
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

    const tx = prisma;
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
      return { success: true };
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

    let semesterId: string | undefined = data.semesterId || subject.semesterId;
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
            thinkingBudget: 0
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
      // Practicals and group slots must strictly match user's lab group
      if (!isGroupMatch(slot.group, labGroup)) {
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

    // If the client wizard already provided exact WYSIWYG previewed slots, honor them with 100% fidelity
    const finalSlotsToSave = (Array.isArray(selections.filteredSlots) && selections.filteredSlots.length > 0)
      ? selections.filteredSlots.map((s: any) => ({
          ...s,
          code: (s.code || "").trim(),
          group: s.group || "ALL",
          type: s.type || "lecture",
          startTime: normalizeTimeString(s.startTime, "09:00"),
          endTime: normalizeTimeString(s.endTime, "10:00"),
          room: s.room || null,
          faculty: s.faculty || null,
        }))
      : filteredSlots;

    const subjectsMap = new Map<string, string>(); // code -> subjectId
    const newSubjectIds = new Set<string>();
    const timetableSubjectIds = new Set<string>();

    // 1. Preload all existing subjects for this semester in ONE single query
    const existingSemesterSubjects = await prisma.subject.findMany({
      where: { semesterId, userId },
    });
    for (const sub of existingSemesterSubjects) {
      subjectsMap.set(sub.code, sub.id);
    }

    // 2. Identify unique subjects needed and create/update as needed
    for (const slot of finalSlotsToSave) {
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
        let subject = existingSemesterSubjects.find((s) => s.code === actualCode);
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
    }

    // 3. Batch insert all timetable slots in a single lightning-fast database operation!
    const slotsToInsert = finalSlotsToSave.map(slot => {
      const isLab = slot.type === "practical";
      const cleanCode = slot.code.replace(/\s*\([LPT]\)/g, '').trim();
      const actualCode = isLab ? `${cleanCode}_LAB` : cleanCode;
      const subjectId = subjectsMap.get(actualCode)!;
      return {
        semesterId,
        subjectId,
        dayOfWeek: Number(slot.dayOfWeek),
        startTime: normalizeTimeString(slot.startTime, "09:00"),
        endTime: normalizeTimeString(slot.endTime, "10:00"),
        room: slot.room || null,
        slotType: slot.type || "lecture",
        validFrom: effectiveStart,
      };
    });

    await prisma.timetableSlot.createMany({
      data: slotsToInsert,
    });

    const createdSlots = await prisma.timetableSlot.findMany({
      where: {
        semesterId,
        validFrom: effectiveStart,
        validUntil: null,
      },
      include: { subject: true },
    });

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

    // Invalidate onboarding status immediately
    CacheService.del(userId, "onboarding:status").catch(() => {});

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
    if (!semesterId || semesterId === "undefined" || semesterId === "null" || semesterId === "active") {
      const activeSem = await prisma.semester.findFirst({
        where: { userId, isActive: true },
        select: { id: true }
      });
      if (activeSem) {
        semesterId = activeSem.id;
      }
    }

    const subjects = await prisma.subject.findMany({
      where: { userId, ...(semesterId ? { semesterId } : {}) },
      select: { id: true }
    });
    const subjectIds = subjects.map(s => s.id);

    const conditions: any[] = [];
    if (semesterId) conditions.push({ semesterId });
    if (subjectIds.length > 0) conditions.push({ subjectId: { in: subjectIds } });

    if (conditions.length === 0) {
      conditions.push({ semester: { userId } });
    }

    const whereCond = { OR: conditions };

    // Instead of hard-deleting the slots, we archive them by setting validUntil to now.
    // This preserves historical attendance links and adds the timetable to the Archive modal.
    try {
      await prisma.timetableSlot.updateMany({
        where: { ...whereCond, validUntil: null },
        data: { validUntil: new Date() }
      });
      CacheService.del(userId, "onboarding:status").catch(() => {});
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

    const hasCalendarPayload = Boolean(
      payload.academicCalendar && Array.isArray(payload.academicCalendar) && payload.academicCalendar.length > 0
    );
    const hasOverridesPayload = Boolean(
      payload.overrides && Array.isArray(payload.overrides) && payload.overrides.length > 0
    );
    const hasLogsPayload = Boolean(
      payload.lectureLogs && Array.isArray(payload.lectureLogs) && payload.lectureLogs.length > 0
    );

    // ── Phase 0: Single Parallel Read Roundtrip ──────────────────────────────
    const [
      ownsSemester,
      existingReceiverSubjects,
      allSemesterSlots,
      existingEvents,
      existingOverrides,
      existingLogs,
    ] = await Promise.all([
      prisma.semester.findFirst({
        where: { id: semesterId, userId },
      }),
      prisma.subject.findMany({
        where: { semesterId, userId },
      }),
      prisma.timetableSlot.findMany({
        where: { semesterId },
        select: { id: true },
      }),
      hasCalendarPayload
        ? prisma.event.findMany({
            where: { userId },
            select: { date: true, eventType: true },
          })
        : Promise.resolve([]),
      hasOverridesPayload
        ? prisma.timetableOverride.findMany({
            where: { semesterId },
            select: { id: true, date: true, overrideType: true, originalSlotId: true },
          })
        : Promise.resolve([]),
      hasLogsPayload
        ? prisma.attendance.findMany({
            where: { userId, subject: { semesterId } },
            select: { id: true, date: true, subjectId: true, timetableSlotId: true, overrideId: true },
          })
        : Promise.resolve([]),
    ]);

    if (!ownsSemester) throw new Error("Forbidden: Semester does not belong to user");

    // Prepare semester date alignment if needed
    const semesterUpdateData: any = {};
    if (payload.semester?.startDate) {
      const senderStart = new Date(payload.semester.startDate);
      if (senderStart < ownsSemester.startDate) {
        semesterUpdateData.startDate = senderStart;
      }
    }
    if (payload.semester?.endDate) {
      const senderEnd = new Date(payload.semester.endDate);
      if (senderEnd > ownsSemester.endDate) {
        semesterUpdateData.endDate = senderEnd;
      }
    }

    // ── 1. Prepare Subjects (In-Memory UUID Pre-Generation) ──────────────────
    const subjectMap = new Map<string, string>();
    for (const es of existingReceiverSubjects) {
      if (es.code) {
        subjectMap.set(es.code.trim(), es.id);
        subjectMap.set(es.code.trim().toLowerCase(), es.id);
      }
      if (es.name) {
        subjectMap.set(es.name.trim(), es.id);
        subjectMap.set(es.name.trim().toLowerCase(), es.id);
      }
    }

    const subjectsToCreate: any[] = [];
    for (const subData of payload.subjects) {
      const trimmedCode = (subData.code || "").trim();
      const trimmedName = (subData.name || "").trim();
      const existingId =
        (trimmedCode ? subjectMap.get(trimmedCode) || subjectMap.get(trimmedCode.toLowerCase()) : null) ||
        (trimmedName ? subjectMap.get(trimmedName) || subjectMap.get(trimmedName.toLowerCase()) : null);

      if (!existingId) {
        const newSubjectId = crypto.randomUUID();
        if (trimmedCode) {
          subjectMap.set(trimmedCode, newSubjectId);
          subjectMap.set(trimmedCode.toLowerCase(), newSubjectId);
        }
        if (trimmedName) {
          subjectMap.set(trimmedName, newSubjectId);
          subjectMap.set(trimmedName.toLowerCase(), newSubjectId);
        }
        subjectsToCreate.push({
          id: newSubjectId,
          semesterId,
          userId,
          name: subData.name,
          code: subData.code || null,
          credits: subData.credits || 3,
          faculty: subData.faculty || null,
          colorHex: subData.colorHex || "#6366f1",
          targetAttendance: subData.targetAttendance || null,
        });
      }
    }
    const validSubjectIds = new Set<string>(subjectMap.values());

    // ── 2. Prepare Timetable Slots (In-Memory UUID Pre-Generation) ───────────
    const originalIdToNewId = new Map<string, string>();
    const seenSlots = new Set<string>();
    const slotRowsToInsert: any[] = [];
    const validSlotIds = new Set<string>(allSemesterSlots.map((s: any) => s.id));

    const sortedSlots = [...payload.slots].sort((a, b) => {
      const aActive = !a.validUntil ? 0 : 1;
      const bActive = !b.validUntil ? 0 : 1;
      return aActive - bActive;
    });

    for (const slotData of sortedSlots) {
      const sc = (slotData.subjectCode || "").trim();
      const sn = (slotData.subjectName || "").trim();
      const subjectId =
        subjectMap.get(sc) ||
        subjectMap.get(sc.toLowerCase()) ||
        subjectMap.get(sn) ||
        subjectMap.get(sn.toLowerCase());
      if (!subjectId) continue;

      const validFrom = slotData.validFrom ? new Date(slotData.validFrom) : new Date();
      const validUntil = slotData.validUntil ? new Date(slotData.validUntil) : null;
      const untilStr = validUntil ? validUntil.toISOString() : "active";
      const key = `${subjectId}_${slotData.dayOfWeek}_${slotData.startTime}_${slotData.endTime}_${validFrom.toISOString()}_${untilStr}`;
      if (seenSlots.has(key)) continue;
      seenSlots.add(key);

      const newSlotId = crypto.randomUUID();
      if (slotData.originalId) {
        originalIdToNewId.set(slotData.originalId, newSlotId);
      }
      validSlotIds.add(newSlotId);
      slotRowsToInsert.push({
        id: newSlotId,
        semesterId,
        subjectId,
        dayOfWeek: Number(slotData.dayOfWeek),
        startTime: normalizeTimeString(slotData.startTime, "09:00"),
        endTime: normalizeTimeString(slotData.endTime, "10:00"),
        room: slotData.room || null,
        slotType: slotData.slotType || "lecture",
        validFrom,
        validUntil,
      });
    }

    // ── 3. Prepare Academic Calendar Events ──────────────────────────────────
    let eventRows: any[] = [];
    if (hasCalendarPayload) {
      const existingSet = new Set(
        existingEvents.map((e: any) => `${e.date.toISOString().split("T")[0]}_${e.eventType}`)
      );

      eventRows = payload.academicCalendar
        .map((event: any) => {
          const resolvedType = event.eventType || event.type || "holiday";
          const dateStr = new Date(event.date).toISOString().split("T")[0];
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
    }

    // ── 4. Prepare Timetable Overrides (In-Memory UUID Pre-Generation) ───────
    const originalOverrideIdToNewId = new Map<string, string>();
    const validOverrideIds = new Set<string>();
    const overrideRowsToInsert: any[] = [];

    if (hasOverridesPayload) {
      for (const eo of existingOverrides) {
        validOverrideIds.add(eo.id);
      }
      const existingOvSet = new Set(
        existingOverrides.map(
          (o: any) => `${o.date.toISOString().split("T")[0]}_${o.overrideType}_${o.originalSlotId ?? ""}`
        )
      );

      for (const ov of payload.overrides) {
        const dateStr = new Date(ov.date).toISOString().split("T")[0];
        const rawSlotId = ov.originalSlotId ? (originalIdToNewId.get(ov.originalSlotId) ?? null) : null;
        const mappedOriginalSlotId = rawSlotId && validSlotIds.has(rawSlotId) ? rawSlotId : null;

        let mappedSubjectId: string | null = null;
        if (ov.subjectCode || ov.subjectName) {
          const sc = (ov.subjectCode || "").trim();
          const sn = (ov.subjectName || "").trim();
          const candId =
            subjectMap.get(sc) ||
            subjectMap.get(sc.toLowerCase()) ||
            subjectMap.get(sn) ||
            subjectMap.get(sn.toLowerCase()) ||
            null;
          if (candId && validSubjectIds.has(candId)) {
            mappedSubjectId = candId;
          }
        }

        const dedupKey = `${dateStr}_${ov.overrideType}_${mappedOriginalSlotId ?? ""}`;
        if (existingOvSet.has(dedupKey)) continue;
        existingOvSet.add(dedupKey);

        const newOverrideId = crypto.randomUUID();
        if (ov.originalOverrideId) {
          originalOverrideIdToNewId.set(ov.originalOverrideId, newOverrideId);
        }
        validOverrideIds.add(newOverrideId);

        overrideRowsToInsert.push({
          id: newOverrideId,
          semesterId,
          date: new Date(ov.date),
          overrideType: ov.overrideType,
          originalSlotId: mappedOriginalSlotId,
          subjectId: mappedSubjectId,
          startTime: ov.startTime ?? null,
          endTime: ov.endTime ?? null,
          reason: ov.reason ?? null,
        });
      }
    }

    // ── 5. Prepare Attendance Logs ───────────────────────────────────────────
    const attendanceRowsToInsert: any[] = [];
    const nullSlotUpdates: Array<{ id: string; timetableSlotId?: string; overrideId?: string }> = [];

    if (hasLogsPayload) {
      const existingLogSet = new Set(
        existingLogs.map(
          (l: any) =>
            `${l.date.toISOString().split("T")[0]}_${l.subjectId}_${l.timetableSlotId || "none"}_${l.overrideId || "none"}`
        )
      );

      const nullSlotLogMap = new Map<string, string>();
      for (const l of existingLogs) {
        if (!l.timetableSlotId && !l.overrideId) {
          nullSlotLogMap.set(`${l.date.toISOString().split("T")[0]}_${l.subjectId}`, l.id);
        }
      }

      const allowedStatuses = ["present", "absent", "off", "cancelled", "medical", "od"];

      for (const log of payload.lectureLogs) {
        const subjectCode = log.subject?.code || log.subjectCode;
        const subjectName = log.subject?.name || log.subjectName;
        const subjectId =
          subjectMap.get((subjectCode || "").trim()) ||
          subjectMap.get((subjectCode || "").trim().toLowerCase()) ||
          subjectMap.get((subjectName || "").trim()) ||
          subjectMap.get((subjectName || "").trim().toLowerCase());
        if (!subjectId || !validSubjectIds.has(subjectId)) continue;

        let mappedStatus: string | null = log.status;
        if (mappedStatus === "HELD") continue;
        if (mappedStatus === "CANCELLED" || mappedStatus === "cancelled") mappedStatus = "off";
        if (!allowedStatuses.includes(mappedStatus || "")) continue;

        const dateStr = new Date(log.date).toISOString().split("T")[0];
        const slotKey = log.slot || log.timetableSlotId;
        const rawSlotId = slotKey ? (originalIdToNewId.get(slotKey) ?? null) : null;
        const timetableSlotId = rawSlotId && validSlotIds.has(rawSlotId) ? rawSlotId : null;

        const overrideKey = log.overrideId;
        const rawOverrideId = overrideKey ? (originalOverrideIdToNewId.get(overrideKey) ?? null) : null;
        const overrideId = rawOverrideId && validOverrideIds.has(rawOverrideId) ? rawOverrideId : null;

        const dedupKey = `${dateStr}_${subjectId}_${timetableSlotId || "none"}_${overrideId || "none"}`;
        if (existingLogSet.has(dedupKey)) continue;
        existingLogSet.add(dedupKey);

        const nullSlotKey = `${dateStr}_${subjectId}`;
        const existingNullId = nullSlotLogMap.get(nullSlotKey);
        if (existingNullId) {
          if (timetableSlotId || overrideId) {
            nullSlotUpdates.push({
              id: existingNullId,
              timetableSlotId: timetableSlotId || undefined,
              overrideId: overrideId || undefined,
            });
          }
          nullSlotLogMap.delete(nullSlotKey);
          continue;
        }

        attendanceRowsToInsert.push({
          userId,
          subjectId,
          date: new Date(log.date),
          status: mappedStatus as any,
          timetableSlotId,
          overrideId,
          remarks: log.remarks || null,
        });
      }
    }

    // ── Write Wave 1: Archive old slots + Update Semester + Create Subjects + Create Events ──
    const existingSubjectIds = existingReceiverSubjects.map((s) => s.id);
    const archiveOrConditions: any[] = [{ semesterId }];
    if (existingSubjectIds.length > 0) {
      archiveOrConditions.push({ subjectId: { in: existingSubjectIds } });
    }

    const [, , , eventResult] = await Promise.all([
      Object.keys(semesterUpdateData).length > 0
        ? prisma.semester.update({ where: { id: semesterId }, data: semesterUpdateData })
        : Promise.resolve(null),
      prisma.timetableSlot.updateMany({
        where: { OR: archiveOrConditions, validUntil: null },
        data: { validUntil: new Date() },
      }),
      subjectsToCreate.length > 0
        ? prisma.subject.createMany({ data: subjectsToCreate, skipDuplicates: true })
        : Promise.resolve({ count: 0 }),
      eventRows.length > 0
        ? prisma.event.createMany({ data: eventRows, skipDuplicates: true })
        : Promise.resolve({ count: 0 }),
    ]);
    const importedEvents = eventResult.count;
    CacheService.del(userId, "onboarding:status").catch(() => {});

    // ── Write Wave 2: Insert Timetable Slots ─────────────────────────────────
    let importedSlots = 0;
    if (slotRowsToInsert.length > 0) {
      const slotResult = await prisma.timetableSlot.createMany({
        data: slotRowsToInsert,
        skipDuplicates: true,
      });
      importedSlots = slotResult.count;
    }

    // ── Write Wave 3: Insert Timetable Overrides ─────────────────────────────
    let importedOverrides = 0;
    if (overrideRowsToInsert.length > 0) {
      const ovResult = await prisma.timetableOverride.createMany({
        data: overrideRowsToInsert,
        skipDuplicates: true,
      });
      importedOverrides = ovResult.count;
    }

    // ── Write Wave 4: Insert Attendance Logs (Chunked Parallel) + Null-Slot Updates ──
    let importedLogs = 0;
    if (attendanceRowsToInsert.length > 0 || nullSlotUpdates.length > 0) {
      const CHUNK_SIZE = 500;
      const logChunks: any[][] = [];
      for (let i = 0; i < attendanceRowsToInsert.length; i += CHUNK_SIZE) {
        logChunks.push(attendanceRowsToInsert.slice(i, i + CHUNK_SIZE));
      }

      const [chunkResults] = await Promise.all([
        Promise.all(
          logChunks.map((chunk) =>
            prisma.attendance.createMany({
              data: chunk,
              skipDuplicates: true,
            })
          )
        ),
        nullSlotUpdates.length > 0
          ? Promise.all(
              nullSlotUpdates.map((u) =>
                prisma.attendance
                  .update({
                    where: { id: u.id },
                    data: {
                      timetableSlotId: u.timetableSlotId,
                      overrideId: u.overrideId,
                    },
                  })
                  .catch(() => {})
              )
            )
          : Promise.resolve([]),
      ]);

      importedLogs = chunkResults.reduce((acc, r) => acc + r.count, 0);
    }

    return {
      importedSubjects: payload.subjects.length,
      importedSlots,
      importedOverrides,
      importedEvents,
      importedLogs,
    };
  }
}
