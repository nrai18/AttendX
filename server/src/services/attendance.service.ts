import { prisma } from "../lib/prisma";
import { isSameHoliday } from "../utils/holidayUtils";
import { CacheService } from "./cache.service";

export class AttendanceService {
  private static markLocks = new Map<string, Promise<any>>();

  private static toLocalIso(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  // Parses UTC timestamps from DB that represent midnight IST dates
  private static getDbDateUtc(d: Date | string): number {
    const dt = d instanceof Date ? d : new Date(d);
    const adj = new Date(dt.getTime() + 5.5 * 3600 * 1000);
    return Date.UTC(adj.getUTCFullYear(), adj.getUTCMonth(), adj.getUTCDate());
  }

  private static toDbLocalIso(date: Date | string): string {
    const dt = date instanceof Date ? date : new Date(date);
    const adj = new Date(dt.getTime() + 5.5 * 3600 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${adj.getUTCFullYear()}-${pad(adj.getUTCMonth() + 1)}-${pad(adj.getUTCDate())}`;
  }

  public static inferSlotTypeFromSubject(sub?: { name?: string | null; code?: string | null } | null): "Practical" | "Lecture" {
    const code = String(sub?.code || "").trim();
    const name = String(sub?.name || "").trim();
    if (
      /(?:^|[_\-\s])(lab|prac|practical)(?:$|[_\-\s\d])/i.test(code) ||
      /lab$/i.test(code) ||
      /\b(lab|laboratory|practical|workshop)\b/i.test(name)
    ) {
      return "Practical";
    }
    return "Lecture";
  }

  public static computeEndTimeFromStart(startTime: string, slotType: string): string {
    if (!startTime || startTime === "00:00") return "00:00";
    const match = startTime.trim().match(/^(\d{1,2}):(\d{1,2})/);
    if (!match) return "00:00";
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (isNaN(h) || isNaN(m)) return "00:00";
    const durationMins = /practical|lab/i.test(slotType) ? 100 : 50;
    const totalMins = (h * 60 + m + durationMins) % (24 * 60);
    const endH = String(Math.floor(totalMins / 60)).padStart(2, "0");
    const endM = String(totalMins % 60).padStart(2, "0");
    return `${endH}:${endM}`;
  }

  /**
   * Resolves the best TimetableSlot for a subject on a specific dateKey ("YYYY-MM-DD") and weekday,
   * prioritizing exact timetableSlotId, then archived timetable versions valid on or covering dateKey,
   * before falling back to later active timetable versions.
   */
  static findBestSlotForDate(
    allSlots: any[],
    subjectId: string,
    dayOfWeek: number,
    dateKey: string,
    timetableSlotId?: string | null
  ): any | undefined {
    if (!allSlots || allSlots.length === 0) return undefined;
    if (timetableSlotId) {
      const byId = allSlots.find((s: any) => s.id === timetableSlotId);
      if (byId) return byId;
    }

    const subjectSlots = allSlots.filter((s: any) => !subjectId || s.subjectId === subjectId);
    if (subjectSlots.length === 0) return undefined;

    const sortedSubjectSlots = [...subjectSlots].sort((a, b) => {
      const aUntil = a.validUntil ? AttendanceService.toDbLocalIso(a.validUntil) : null;
      const bUntil = b.validUntil ? AttendanceService.toDbLocalIso(b.validUntil) : null;
      const aValidOnDate = !aUntil || aUntil >= dateKey;
      const bValidOnDate = !bUntil || bUntil >= dateKey;
      if (aValidOnDate !== bValidOnDate) return aValidOnDate ? -1 : 1;
      // Both not yet retired on dateKey: prefer the earliest archived version (smallest validUntil >= dateKey) before current (null)
      if (aUntil && bUntil && aUntil !== bUntil) return aUntil.localeCompare(bUntil);
      if (aUntil && !bUntil) return -1;
      if (!aUntil && bUntil) return 1;
      const aFrom = a.validFrom ? AttendanceService.toDbLocalIso(a.validFrom) : "0000-00-00";
      const bFrom = b.validFrom ? AttendanceService.toDbLocalIso(b.validFrom) : "0000-00-00";
      return aFrom.localeCompare(bFrom);
    });

    return (
      sortedSubjectSlots.find(
        (s: any) =>
          s.dayOfWeek === dayOfWeek &&
          AttendanceService.toDbLocalIso(s.validFrom) <= dateKey &&
          (!s.validUntil || AttendanceService.toDbLocalIso(s.validUntil) >= dateKey)
      ) ||
      sortedSubjectSlots.find(
        (s: any) =>
          s.dayOfWeek === dayOfWeek &&
          (!s.validUntil || AttendanceService.toDbLocalIso(s.validUntil) >= dateKey)
      ) ||
      sortedSubjectSlots.find((s: any) => s.dayOfWeek === dayOfWeek) ||
      sortedSubjectSlots.find(
        (s: any) =>
          AttendanceService.toDbLocalIso(s.validFrom) <= dateKey &&
          (!s.validUntil || AttendanceService.toDbLocalIso(s.validUntil) >= dateKey)
      ) ||
      sortedSubjectSlots[0]
    );
  }

  /**
   * Get the agenda for a specific date:
   * 1. Get all regular TimetableSlots for the dayOfWeek
   * 2. Get all TimetableOverrides for the specific date
   * 3. Fetch any existing Attendance records for these slots/overrides
   */
  static async getTodayAgenda(userId: string, dateStr: string) {
    const [year, month, day] = dateStr.split("-").map(Number);
    const targetDate = new Date(Date.UTC(year, month - 1, day));
    const dayOfWeek = targetDate.getUTCDay() === 0 ? 6 : targetDate.getUTCDay() - 1; // 0=Mon, 6=Sun in our db

    // Resolve active semester via L1/L2 cache first (0ms hit)
    const activeSemester = await CacheService.getOrSet(
      userId,
      "semesters:active",
      () =>
        prisma.semester.findFirst({
          where: { userId, isActive: true },
        })
    );

    if (!activeSemester) {
      return [];
    }

      // 1. Fetch regular slots, Last Teaching Day event, overrides, and attendance records in parallel
      const targetDateStart = new Date(targetDate);
      targetDateStart.setHours(0, 0, 0, 0);
      const targetDateEnd = new Date(targetDate);
      targetDateEnd.setHours(23, 59, 59, 999);

      const semEndDate = new Date(activeSemester.endDate);
      semEndDate.setHours(23, 59, 59, 999);
      const targetDateKey = typeof dateStr === "string" ? dateStr.slice(0, 10) : targetDate.toISOString().slice(0, 10);

      const [lastTeachingEvent, allDaySlotsRaw, rawOverrides, rawAttendanceRecords] = await Promise.all([
        CacheService.getOrSet(
          userId,
          `lastTeachingEvent:${activeSemester.id}`,
          () =>
            prisma.event.findFirst({
              where: {
                userId,
                OR: [
                  { semesterId: activeSemester.id },
                  { semesterId: null }
                ],
                title: {
                  contains: "Last Teaching Day",
                  mode: "insensitive"
                }
              },
              orderBy: { date: "desc" }
            })
        ),
        prisma.timetableSlot.findMany({
          where: {
            semesterId: activeSemester.id,
            dayOfWeek,
            OR: [
              { validUntil: null },
              { validUntil: { gte: targetDateStart } }
            ]
          },
          include: {
            subject: true,
          },
        }),
        prisma.timetableOverride.findMany({
          where: {
            semesterId: activeSemester.id,
            date: {
              gte: new Date(targetDateStart.getTime() - 14 * 3600 * 1000),
              lte: new Date(targetDateEnd.getTime() + 14 * 3600 * 1000)
            },
          },
          include: {
            subject: true,
          },
        }),
        prisma.attendance.findMany({
          where: {
            userId,
            date: {
              gte: new Date(targetDateStart.getTime() - 14 * 3600 * 1000),
              lte: new Date(targetDateEnd.getTime() + 14 * 3600 * 1000)
            },
          },
        }),
      ]);

      const overrides = rawOverrides.filter(o => AttendanceService.toDbLocalIso(o.date) === targetDateKey);
      const attendanceRecords = rawAttendanceRecords.filter(a => AttendanceService.toDbLocalIso(a.date) === targetDateKey);

      let isPastTeachingDay = false;
      if (lastTeachingEvent) {
        const lastTeachingDateEnd = new Date(lastTeachingEvent.endDate || lastTeachingEvent.date);
        lastTeachingDateEnd.setHours(23, 59, 59, 999);
        if (targetDateEnd > lastTeachingDateEnd) {
          isPastTeachingDay = true;
        }
      } else if (targetDateEnd > semEndDate) {
        isPastTeachingDay = true;
      }

      const allDaySlots = isPastTeachingDay ? [] : allDaySlotsRaw;

      const hasArchivedSlotsOnDate = allDaySlots.some(s => {
        if (!s.validUntil) return false;
        const fromKey = (s.validFrom instanceof Date ? s.validFrom : new Date(s.validFrom)).toISOString().slice(0, 10);
        const untilKey = (s.validUntil instanceof Date ? s.validUntil : new Date(s.validUntil)).toISOString().slice(0, 10);
        return fromKey <= targetDateKey && untilKey >= targetDateKey;
      });

      const rawRegularSlots = allDaySlots.filter(s => {
        if (s.validUntil) {
          const untilDateKey = (s.validUntil instanceof Date ? s.validUntil : new Date(s.validUntil)).toISOString().slice(0, 10);
          if (untilDateKey < targetDateKey) return false;
          const fromDateKey = (s.validFrom instanceof Date ? s.validFrom : new Date(s.validFrom)).toISOString().slice(0, 10);
          if (fromDateKey > targetDateKey) return false;
        } else if (hasArchivedSlotsOnDate) {
          // If an archived timetable was active on targetDateKey, skip newer active slots
          return false;
        }
        return true;
      });

    // Deduplicate regular slots by subjectId and time window to prevent showing duplicates on the transition day
    // while strictly preserving multiple periods/labs of the same subject on the same day.
    const regularSlots = [];
    const seenSlotWindows = new Set<string>();
    // Sort descending by validFrom so the newer slot is kept if they overlap
    const sortedRaw = [...rawRegularSlots].sort((a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime());
    for (const s of sortedRaw) {
      const timeKey = `${s.subjectId}_${(s.startTime || '').trim()}_${(s.endTime || '').trim()}`;
      if (!seenSlotWindows.has(timeKey)) {
        seenSlotWindows.add(timeKey);
        regularSlots.push(s);
      }
    }

    // Map them together
    const agenda: any[] = [];
    const nowTime = new Date();
    const isTargetToday = targetDate.getUTCFullYear() === nowTime.getUTCFullYear() &&
                          targetDate.getUTCMonth() === nowTime.getUTCMonth() &&
                          targetDate.getUTCDate() === nowTime.getUTCDate();

    // Add regular slots, replacing them if they have an override (rescheduled/holiday)
    for (const slot of regularSlots) {
      // If a slot was archived/deleted earlier today and has NO marked attendance, skip it from today's agenda
      if (isTargetToday && slot.validUntil && new Date(slot.validUntil) <= nowTime) {
        const hasAttendance = attendanceRecords.some(a => a.timetableSlotId === slot.id);
        if (!hasAttendance) {
          continue;
        }
      }
      const relatedOverride = overrides.find(o => o.originalSlotId === slot.id);
      
      if (relatedOverride) {
        if (relatedOverride.overrideType === "holiday" || relatedOverride.overrideType === "cancelled") {
          continue; // skip this slot entirely
        }
        // Rescheduled
        const existingAtt = attendanceRecords.find(a => a.overrideId === relatedOverride.id);
        agenda.push({
          id: relatedOverride.id,
          type: "override",
          subject: relatedOverride.subject || slot.subject,
          startTime: relatedOverride.startTime || slot.startTime,
          endTime: relatedOverride.endTime || slot.endTime,
          room: slot.room,
          slotType: slot.slotType,
          status: existingAtt?.status || null,
          remarks: existingAtt?.remarks || null,
          attendanceId: existingAtt?.id || null,
        });
      } else {
        // Normal slot
        const existingAtt = attendanceRecords.find(a => a.timetableSlotId === slot.id);
        agenda.push({
          id: slot.id,
          type: "slot",
          subject: slot.subject,
          startTime: slot.startTime,
          endTime: slot.endTime,
          room: slot.room,
          slotType: slot.slotType,
          status: existingAtt?.status || null,
          remarks: existingAtt?.remarks || null,
          attendanceId: existingAtt?.id || null,
        });
      }
    }

    // Add extra classes that aren't tied to an original slot
    const extraClasses = overrides.filter(o => o.overrideType === "extra_class");
    for (const extra of extraClasses) {
      const existingAtt = attendanceRecords.find(a => a.overrideId === extra.id);
      const inferredType = AttendanceService.inferSlotTypeFromSubject(extra.subject);
      const resolvedStart = extra.startTime || "00:00";
      const resolvedEnd =
        extra.endTime && extra.endTime !== "00:00"
          ? extra.endTime
          : AttendanceService.computeEndTimeFromStart(resolvedStart, inferredType);
      agenda.push({
        id: extra.id,
        type: "override",
        isExtra: true,
        subject: extra.subject,
        startTime: resolvedStart,
        endTime: resolvedEnd,
        room: null,
        slotType: inferredType,
        status: existingAtt?.status || null,
        remarks: existingAtt?.remarks || null,
        attendanceId: existingAtt?.id || null,
      });
    }
    
    // Add manual attendance records (marked when no slot existed)
    const matchedAttIds = agenda.filter(a => a.attendanceId).map(a => a.attendanceId);
    let manualAtts = attendanceRecords.filter(a => !matchedAttIds.includes(a.id));

    // Auto-map orphaned attendances to unmarked regular slots of the same subject
    for (const slot of agenda) {
      if (slot.type === "slot" && slot.status === null) {
        const matchingIndex = manualAtts.findIndex(a => a.subjectId === slot.subject.id);
        if (matchingIndex !== -1) {
          const match = manualAtts[matchingIndex];
          slot.status = match.status;
          slot.remarks = match.remarks;
          slot.attendanceId = match.id;
          manualAtts.splice(matchingIndex, 1);
        }
      }
    }
    
    if (manualAtts.length > 0) {
      // Fetch subjects AND their timetable slots for these historical/manual attendances
      const manualSubjectIds = manualAtts.map(a => a.subjectId);
      const manualSubjects = await prisma.subject.findMany({
        where: { id: { in: Array.from(new Set(manualSubjectIds)) } },
        include: {
          timetableSlots: true,
        }
      });
      
      for (const att of manualAtts) {
        const sub = manualSubjects.find(s => s.id === att.subjectId);
        let slotStartTime = "00:00";
        let slotEndTime = "00:00";
        let slotType: string = AttendanceService.inferSlotTypeFromSubject(sub);
        let slotRoom = null;

        if (sub?.timetableSlots && sub.timetableSlots.length > 0) {
          const matchingSlot = AttendanceService.findBestSlotForDate(
            sub.timetableSlots,
            sub.id,
            dayOfWeek,
            targetDateKey,
            att.timetableSlotId
          );

          if (matchingSlot) {
            slotStartTime = matchingSlot.startTime || "00:00";
            slotType = matchingSlot.slotType ? matchingSlot.slotType.charAt(0).toUpperCase() + matchingSlot.slotType.slice(1) : slotType;
            slotEndTime =
              matchingSlot.endTime && matchingSlot.endTime !== "00:00"
                ? matchingSlot.endTime
                : AttendanceService.computeEndTimeFromStart(slotStartTime, slotType);
            slotRoom = matchingSlot.room || null;
          }
        }

        const hasMatchingSchedule = sub?.timetableSlots && sub.timetableSlots.some((s: any) => s.dayOfWeek === dayOfWeek);
        agenda.push({
          id: att.id,
          type: hasMatchingSchedule ? "slot" : "manual",
          isExtra: !hasMatchingSchedule,
          subject: sub || { id: att.subjectId, name: "Unknown" },
          startTime: slotStartTime,
          endTime: slotEndTime,
          room: slotRoom,
          slotType: slotType,
          status: att.status,
          remarks: att.remarks || null,
          attendanceId: att.id,
        });
      }
    }

    // Sort by startTime
    return agenda.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  static async markAttendance(userId: string, data: {
    subjectId: string;
    date: string;
    status: any;
    remarks?: string;
    timetableSlotId?: string;
    overrideId?: string;
    attendanceId?: string;
  }) {
    const lockKey = `${userId}:${data.date}:${data.overrideId || data.timetableSlotId || data.subjectId}`;
    const prev = AttendanceService.markLocks.get(lockKey) || Promise.resolve();
    const run = prev
      .catch(() => {})
      .then(() => AttendanceService.executeMarkAttendance(userId, data));
    AttendanceService.markLocks.set(lockKey, run);
    try {
      return await run;
    } finally {
      if (AttendanceService.markLocks.get(lockKey) === run) {
        AttendanceService.markLocks.delete(lockKey);
      }
    }
  }

  private static async executeMarkAttendance(userId: string, rawData: {
    subjectId: string;
    date: string;
    status: any;
    remarks?: string;
    timetableSlotId?: string;
    overrideId?: string;
    attendanceId?: string;
  }) {
    const data = { ...rawData };
    if (data.overrideId) {
      const overrideExists = await prisma.timetableOverride.findUnique({
        where: { id: data.overrideId },
        select: { id: true },
      });
      if (!overrideExists) {
        if (!data.attendanceId) {
          data.attendanceId = data.overrideId;
        }
        data.overrideId = undefined;
      }
    }

    const ownsSubject = await prisma.subject.findFirst({
      where: { id: data.subjectId, userId }
    });

    if (!ownsSubject) {
      // If user is clearing or unmarking a ghost class whose subject is already deleted:
      if (data.status === "not_marked" || data.status === "clear") {
        await prisma.attendance.deleteMany({
          where: {
            userId,
            OR: [
              ...(data.attendanceId && !data.attendanceId.startsWith("extra-") ? [{ id: data.attendanceId }] : []),
              { subjectId: data.subjectId }
            ]
          }
        }).catch(() => null);
        return { success: true, cleared: true, ghost: true };
      }
      throw new Error("Forbidden: Subject does not belong to user");
    }

    const [year, month, day] = data.date.split("-").map(Number);
    const targetDate = new Date(Date.UTC(year, month - 1, day));
    const targetDateStart = new Date(targetDate.getTime() - 14 * 3600 * 1000);
    const targetDateEnd = new Date(targetDate.getTime() + 14 * 3600 * 1000);
    const targetDateKey = data.date;
    
    // Check if record exists
    let existing: any = null;
    if (data.attendanceId && !data.attendanceId.startsWith("extra-") && !data.attendanceId.startsWith("today-") && !data.attendanceId.startsWith("unmarked-")) {
      existing = await prisma.attendance.findUnique({ where: { id: data.attendanceId } });
    }
    if (!existing) {
      const candidates = await prisma.attendance.findMany({
        where: {
          userId,
          subjectId: data.subjectId,
          date: { gte: targetDateStart, lte: targetDateEnd },
          ...(data.timetableSlotId
            ? { timetableSlotId: data.timetableSlotId }
            : data.overrideId
              ? { overrideId: data.overrideId }
              : {}),
        },
      });
      existing = candidates.find(a => AttendanceService.toDbLocalIso(a.date) === targetDateKey) || null;
      if (!existing && !data.timetableSlotId && !data.overrideId) {
        // Fallback: match any record for the same subject on this day
        existing = candidates.find(a => AttendanceService.toDbLocalIso(a.date) === targetDateKey && !a.timetableSlotId && !a.overrideId) || null;
      }
    }

    if (data.status === "not_marked" || data.status === "clear") {
      let deleteCount = 0;
      
      // 1. Delete by exact ID if provided
      if (existing) {
        const exactDelete = await prisma.attendance.deleteMany({
          where: { id: existing.id }
        });
        deleteCount += exactDelete.count;
      }

      // 2. Also sweep by exact slot/override matching across the day's timezone window
      const sweepCandidates = await prisma.attendance.findMany({
        where: {
          userId,
          subjectId: data.subjectId,
          date: { gte: targetDateStart, lte: targetDateEnd },
          ...(data.timetableSlotId
            ? { timetableSlotId: data.timetableSlotId }
            : data.overrideId
              ? { overrideId: data.overrideId }
              : {}),
        },
      });

      const idsToDelete = sweepCandidates
        .filter(a => AttendanceService.toDbLocalIso(a.date) === targetDateKey)
        .map(a => a.id);

      if (idsToDelete.length > 0) {
        const sweepDelete = await prisma.attendance.deleteMany({
          where: { id: { in: idsToDelete } }
        });
        deleteCount += sweepDelete.count;
      }
      
      CacheService.invalidateUser(userId).catch(() => {});
      return { message: "Attendance cleared", count: deleteCount, status: "not_marked" };
    }

    if (existing) {
      const updated = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          status: data.status,
          ...(data.remarks !== undefined ? { remarks: data.remarks } : {}),
          ...(data.timetableSlotId && !existing.timetableSlotId ? { timetableSlotId: data.timetableSlotId } : {}),
          ...(data.overrideId && !existing.overrideId ? { overrideId: data.overrideId } : {}),
        },
      });
      await Promise.allSettled([
        CacheService.set(userId, "pref:has_attendance", true),
        CacheService.del(userId, "onboarding:status"),
        CacheService.invalidateUser(userId),
      ]);
      return updated;
    }

    try {
      const created = await prisma.attendance.create({
        data: {
          userId,
          subjectId: data.subjectId,
          date: targetDate,
          status: data.status,
          remarks: data.remarks || null,
          timetableSlotId: data.timetableSlotId,
          overrideId: data.overrideId,
        },
      });
      await Promise.allSettled([
        CacheService.set(userId, "pref:has_attendance", true),
        CacheService.del(userId, "onboarding:status"),
        CacheService.invalidateUser(userId),
      ]);
      return created;
    } catch (err: any) {
      if (err.code === "P2002") {
        const concurrent = await prisma.attendance.findFirst({
          where: {
            userId,
            subjectId: data.subjectId,
            date: targetDate,
            ...(data.timetableSlotId ? { timetableSlotId: data.timetableSlotId } : {}),
            ...(data.overrideId ? { overrideId: data.overrideId } : {})
          }
        });
        if (concurrent) {
          const updatedConcurrent = await prisma.attendance.update({
            where: { id: concurrent.id },
            data: { status: data.status, ...(data.remarks !== undefined ? { remarks: data.remarks } : {}) }
          });
          await CacheService.invalidateUser(userId);
          return updatedConcurrent;
        }
      }
      throw err;
    }
  }

  static async markFullDay(userId: string, data: {
    date: string;
    status: string;
    remarks?: string;
    semesterId?: string;
  }) {
    const [year, month, day] = data.date.split("-").map(Number);
    const targetDate = new Date(Date.UTC(year, month - 1, day));
    const targetDateStart = new Date(targetDate.getTime() - 14 * 3600 * 1000);
    const targetDateEnd = new Date(targetDate.getTime() + 14 * 3600 * 1000);
    const targetDateKey = data.date;
    const dayOfWeek = targetDate.getUTCDay() === 0 ? 6 : targetDate.getUTCDay() - 1; // 0=Mon, 6=Sun in our db

    // 1. Get active semester if not provided
    let semesterId = data.semesterId;
    if (!semesterId) {
      const activeSem = await prisma.semester.findFirst({
        where: { userId, isActive: true },
        select: { id: true },
      });
      semesterId = activeSem?.id;
    }

    // 2. Undo / Clear: delete all attendance records on this date for this user
    if (data.status === "clear" || data.status === "not_marked") {
      const dayRecords = await prisma.attendance.findMany({
        where: {
          userId,
          date: { gte: targetDateStart, lte: targetDateEnd },
        },
      });
      const idsToDelete = dayRecords
        .filter(a => AttendanceService.toDbLocalIso(a.date) === targetDateKey)
        .map(a => a.id);
      let count = 0;
      if (idsToDelete.length > 0) {
        const deleted = await prisma.attendance.deleteMany({
          where: { id: { in: idsToDelete } },
        });
        count = deleted.count;
      }
      CacheService.invalidateUser(userId).catch(() => {});
      return { success: true, cleared: true, count, status: "not_marked" };
    }

    // 3. Status is "present", "absent", or "off"
    // Fetch all timetable slots for this day of week that are active on targetDate
    const slots = semesterId
      ? await prisma.timetableSlot.findMany({
          where: {
            semesterId,
            dayOfWeek,
            validFrom: { lte: targetDate },
            OR: [
              { validUntil: null },
              { validUntil: { gt: targetDate } },
            ],
          },
          include: { subject: true },
        })
      : [];

    // Fetch overrides for this specific date (extra classes, reschedules, etc.)
    const overrides = semesterId
      ? await prisma.timetableOverride.findMany({
          where: {
            semesterId,
            date: { gte: targetDateStart, lte: targetDateEnd },
            overrideType: { not: "cancelled" },
          },
          include: { subject: true },
        })
      : [];
    const activeOverrides = overrides.filter(o => AttendanceService.toDbLocalIso(o.date) === targetDateKey);

    // Find all cancellations on targetDate
    const cancellations = semesterId
      ? await prisma.timetableOverride.findMany({
          where: {
            semesterId,
            date: { gte: targetDateStart, lte: targetDateEnd },
            overrideType: "cancelled",
          },
          select: { originalSlotId: true, date: true },
        })
      : [];
    const activeCancellations = cancellations.filter(c => AttendanceService.toDbLocalIso(c.date) === targetDateKey);
    const cancelledSlotIds = new Set(activeCancellations.map(c => c.originalSlotId).filter(Boolean));

    // Active slots excluding cancelled ones
    const activeSlots = slots.filter(s => !cancelledSlotIds.has(s.id));

    // Existing attendance records on this date across the timezone window
    const rawExistingAttendance = await prisma.attendance.findMany({
      where: {
        userId,
        date: { gte: targetDateStart, lte: targetDateEnd },
      },
    });
    const existingAttendance = rawExistingAttendance.filter(a => AttendanceService.toDbLocalIso(a.date) === targetDateKey);

    const results = [];
    const processedKeys = new Set<string>();
    const handledExistingIds = new Set<string>();

    // A. Process active timetable slots
    for (const slot of activeSlots) {
      if (!slot.subjectId) continue;
      processedKeys.add(`slot:${slot.id}`);

      let existing = existingAttendance.find(a => !handledExistingIds.has(a.id) && a.timetableSlotId === slot.id);
      if (!existing) {
        existing = existingAttendance.find(a => !handledExistingIds.has(a.id) && a.subjectId === slot.subjectId);
      }
      if (existing) {
        handledExistingIds.add(existing.id);
        const updated = await prisma.attendance.update({
          where: { id: existing.id },
          data: {
            status: data.status as any,
            remarks: data.remarks || null,
            ...(slot.id && !existing.timetableSlotId ? { timetableSlotId: slot.id } : {}),
          },
        });
        results.push(updated);
      } else {
        const created = await prisma.attendance.create({
          data: {
            userId,
            subjectId: slot.subjectId,
            date: targetDate,
            status: data.status as any,
            remarks: data.remarks || null,
            timetableSlotId: slot.id,
          },
        });
        results.push(created);
      }
    }

    // B. Process overrides (extra classes on targetDate)
    for (const override of activeOverrides) {
      if (!override.subjectId) continue;
      processedKeys.add(`override:${override.id}`);

      let existing = existingAttendance.find(a => !handledExistingIds.has(a.id) && a.overrideId === override.id);
      if (!existing) {
        existing = existingAttendance.find(a => !handledExistingIds.has(a.id) && a.subjectId === override.subjectId);
      }
      if (existing) {
        handledExistingIds.add(existing.id);
        const updated = await prisma.attendance.update({
          where: { id: existing.id },
          data: {
            status: data.status as any,
            remarks: data.remarks || null,
            ...(override.id && !existing.overrideId ? { overrideId: override.id } : {}),
          },
        });
        results.push(updated);
      } else {
        const created = await prisma.attendance.create({
          data: {
            userId,
            subjectId: override.subjectId,
            date: targetDate,
            status: data.status as any,
            remarks: data.remarks || null,
            overrideId: override.id,
          },
        });
        results.push(created);
      }
    }

    // C. Any remaining unlinked existing attendance records on target date
    for (const record of existingAttendance) {
      const handled = (record.timetableSlotId && processedKeys.has(`slot:${record.timetableSlotId}`)) ||
                      (record.overrideId && processedKeys.has(`override:${record.overrideId}`));
      if (!handled) {
        const updated = await prisma.attendance.update({
          where: { id: record.id },
          data: {
            status: data.status as any,
            remarks: data.remarks || null,
          },
        });
        results.push(updated);
      }
    }

    CacheService.set(userId, "pref:has_attendance", true).catch(() => {});
    CacheService.del(userId, "onboarding:status").catch(() => {});
    CacheService.invalidateUser(userId).catch(() => {});

    return { success: true, count: results.length, status: data.status };
  }

  static async getAttendanceLogs(userId: string, options: { subjectId?: string; semesterId?: string }) {
    const [user, cachedActiveSem] = await Promise.all([
      CacheService.getOrSet(userId, "user:record", () => prisma.user.findUnique({ where: { id: userId } })),
      CacheService.getOrSet(userId, "semesters:active", () =>
        prisma.semester.findFirst({ where: { userId, isActive: true } })
      ),
    ]);
    const activeSemester =
      options.semesterId && cachedActiveSem?.id !== options.semesterId
        ? await prisma.semester.findFirst({ where: { userId, id: options.semesterId } })
        : cachedActiveSem;
    const globalTarget = user?.targetAttendance || 75;

    if (!activeSemester) {
      return { logs: [], subjects: [] };
    }

    const specificSubjectId =
      options.subjectId && options.subjectId !== "all" && options.subjectId !== "overall"
        ? options.subjectId
        : undefined;

    // Share singleflight L1-cached subjects:full and overrides:all with getSubjectStats so concurrent calls run 0 duplicate queries
    const [allSubjects, allOverrides] = await Promise.all([
      CacheService.getOrSet(userId, `subjects:full:${activeSemester.id}`, () =>
        prisma.subject.findMany({
          where: {
            userId,
            semesterId: activeSemester.id,
          },
          include: {
            attendance: true,
            semester: true,
            timetableSlots: true,
          },
        })
      ),
      CacheService.getOrSet(userId, `overrides:all:${activeSemester.id}`, () =>
        prisma.timetableOverride.findMany({
          where: {
            semesterId: activeSemester.id,
          },
          include: { subject: true },
        })
      ),
    ]);

    const subjects = specificSubjectId
      ? allSubjects.filter((s) => s.id === specificSubjectId)
      : allSubjects;
    const rawOverrides = specificSubjectId
      ? allOverrides.filter((o) => o.subjectId === specificSubjectId)
      : allOverrides;

    // Compute subject stats map
    const subjectStatsMap: Record<string, any> = {};
    for (const sub of subjects) {
      const allRecords = sub.attendance;
      const countable = allRecords.filter(a => a.status === "present" || a.status === "absent" || a.status === "medical" || a.status === "od");
      const attended = countable.filter(a => a.status === "present" || a.status === "medical" || a.status === "od").length;
      const missed = countable.filter(a => a.status === "absent").length;
      const off = allRecords.filter(a => a.status === "off" || a.status === "cancelled").length;
      const total = countable.length;
      const percentage = total > 0 ? (attended / total) * 100 : 0;
      const target = globalTarget;
      const canMiss = total > 0 ? Math.floor((attended - (target / 100) * total) / (target / 100)) : 0;
      const needAttend = percentage < target && target < 100
        ? Math.ceil(((target / 100) * total - attended) / (1 - target / 100))
        : 0;

      let statusText = "";
      if (total === 0) statusText = "No classes recorded yet";
      else if (percentage >= target) {
        statusText = canMiss > 0 ? `can miss ${canMiss} lecture${canMiss > 1 ? "s" : ""}` : "can't miss the next lecture";
      } else {
        statusText = `need to attend ${needAttend} lecture${needAttend > 1 ? "s" : ""}`;
      }

      subjectStatsMap[sub.id] = {
        id: sub.id,
        name: sub.name,
        code: sub.code,
        colorHex: sub.colorHex || "#8b5cf6",
        target,
        attended,
        missed,
        off,
        total,
        percentage,
        canMiss: canMiss > 0 ? canMiss : 0,
        needAttend: needAttend > 0 ? needAttend : 0,
        statusText,
      };
    }

    const subjectIdSet = new Set(subjects.map(s => s.id));
    const overrides = rawOverrides.filter(o => !o.subjectId || subjectIdSet.has(o.subjectId));
    // Reuse already-fetched subject.attendance records instead of making a duplicate DB round-trip
    const attendanceRecords = subjects.flatMap(s => s.attendance);



    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const semStart = new Date(activeSemester.startDate);
    semStart.setHours(0, 0, 0, 0);
    const semEnd = new Date(activeSemester.endDate);
    semEnd.setHours(23, 59, 59, 999);

    const allSemesterSlots = subjects.flatMap((s: any) => s.timetableSlots || []);
    const logs: any[] = [];

    // 1. Process all Attendance records (marked classes)
    for (const att of attendanceRecords) {
      const sub = subjects.find(s => s.id === att.subjectId);
      if (!sub) continue;
      
      const stats = subjectStatsMap[sub.id];
      const dbDate = new Date(att.date);
      const dateKey = AttendanceService.toDbLocalIso(dbDate);
      const adj = new Date(dbDate.getTime() + 5.5 * 3600 * 1000);
      const dateFormatted = adj.toLocaleDateString("en-US", {
        timeZone: "UTC",
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      let slotType: string = AttendanceService.inferSlotTypeFromSubject(sub);
      let isExtraClass = false;
      let startTime = "00:00";
      let endTime = "00:00";
      const attDayOfWeek = adj.getUTCDay() === 0 ? 6 : adj.getUTCDay() - 1;

      // 1. Separate all slots for this subject into archived and active versions
      const subSlots = sub.timetableSlots || [];
      const archivedSlots = subSlots.filter((s: any) => s.validUntil !== null);
      const activeSlots = subSlots.filter((s: any) => s.validUntil === null);

      // 2. Check if an archived timetable version was active on this specific date
      const archivedSlotsOnDate = archivedSlots.filter((s: any) => {
        const fromKey = AttendanceService.toDbLocalIso(s.validFrom);
        const untilKey = AttendanceService.toDbLocalIso(s.validUntil);
        return fromKey <= dateKey && untilKey >= dateKey;
      });
      const hasArchivedVersionOnDate = archivedSlotsOnDate.length > 0;

      // 3. Select the authoritative timetable version for dateKey:
      // If an archived timetable governed this date, inspect archived slots;
      // otherwise, inspect the active timetable (or fallback to any semester slot on that day)
      const applicableSlots = hasArchivedVersionOnDate ? archivedSlotsOnDate : activeSlots;
      const scheduledSlotsOnDay = applicableSlots.filter((s: any) => s.dayOfWeek === attDayOfWeek);
      const anyScheduledSlotOnDay = scheduledSlotsOnDay.length > 0
        ? scheduledSlotsOnDay
        : subSlots.filter((s: any) => s.dayOfWeek === attDayOfWeek);

      // 4. Resolve isExtraClass according to priority hierarchy:
      if (att.overrideId) {
        const override = overrides.find((o: any) => o.id === att.overrideId);
        if (override) {
          isExtraClass = override.overrideType === "extra_class";
          startTime = override.startTime || startTime;
          endTime = override.endTime || endTime;
        }
      } else if (att.timetableSlotId) {
        const slot = subSlots.find((s: any) => s.id === att.timetableSlotId);
        if (slot) {
          slotType = slot.slotType ? slot.slotType.charAt(0).toUpperCase() + slot.slotType.slice(1) : slotType;
          startTime = slot.startTime || "00:00";
          endTime = slot.endTime || "00:00";
          // If explicitly linked to a real slot, it is regular unless on an unscheduled day
          isExtraClass = slot.dayOfWeek !== attDayOfWeek && anyScheduledSlotOnDay.length === 0;
        }
      } else {
        // Attendance without explicit slot link: regular if subject is scheduled on this weekday, extra otherwise
        isExtraClass = anyScheduledSlotOnDay.length === 0;
      }

      if (startTime === "00:00" && sub.timetableSlots && sub.timetableSlots.length > 0) {
        const matchingSlot = AttendanceService.findBestSlotForDate(
          sub.timetableSlots,
          sub.id,
          attDayOfWeek,
          dateKey,
          att.timetableSlotId
        );

        if (matchingSlot) {
          slotType = matchingSlot.slotType ? matchingSlot.slotType.charAt(0).toUpperCase() + matchingSlot.slotType.slice(1) : slotType;
          startTime = matchingSlot.startTime;
          endTime = matchingSlot.endTime;
        }
      }

      if (startTime !== "00:00" && (!endTime || endTime === "00:00")) {
        endTime = AttendanceService.computeEndTimeFromStart(startTime, slotType);
      }

      logs.push({
        id: att.id,
        date: dateKey,
        dateFormatted,
        timestamp: dbDate.getTime(),
        subjectId: sub.id,
        subjectName: sub.name,
        subjectCode: sub.code,
        subjectColor: sub.colorHex || "#8b5cf6",
        target: stats.target,
        currentPercentage: stats.percentage,
        canMiss: stats.canMiss,
        needAttend: stats.needAttend,
        statusText: stats.statusText,
        slotType,
        isExtra: isExtraClass || slotType === "Extra",
        startTime,
        endTime,
        status: att.status,
        remarks: att.remarks || null,
        timetableSlotId: att.timetableSlotId,
        overrideId: att.overrideId,
        attendanceId: att.id,
      });
    }

    // 2. Process all extra_class Overrides that do NOT have an attendance record
    const extraOverrides = overrides.filter(o => o.overrideType === "extra_class");
    for (const extra of extraOverrides) {
      if (attendanceRecords.some(a => a.overrideId === extra.id)) continue;
      
      const sub = subjects.find(s => s.id === extra.subjectId);
      if (!sub) continue;
      
      const stats = subjectStatsMap[sub.id];
      const dbDate = new Date(extra.date);
      const dateKey = AttendanceService.toDbLocalIso(dbDate);
      const adj = new Date(dbDate.getTime() + 5.5 * 3600 * 1000);
      const dateFormatted = adj.toLocaleDateString("en-US", {
        timeZone: "UTC",
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      const extraInferredType = AttendanceService.inferSlotTypeFromSubject(sub);
      const extraStart = extra.startTime || "00:00";
      const extraEnd =
        extra.endTime && extra.endTime !== "00:00"
          ? extra.endTime
          : AttendanceService.computeEndTimeFromStart(extraStart, extraInferredType);

      logs.push({
        id: `extra-${extra.id}-${dateKey}`,
        date: dateKey,
        dateFormatted,
        timestamp: dbDate.getTime(),
        subjectId: sub.id,
        subjectName: sub.name,
        subjectCode: sub.code,
        subjectColor: sub.colorHex || "#8b5cf6",
        target: stats.target,
        currentPercentage: stats.percentage,
        canMiss: stats.canMiss,
        needAttend: stats.needAttend,
        statusText: stats.statusText,
        slotType: extraInferredType,
        isExtra: true,
        startTime: extraStart,
        endTime: extraEnd,
        status: "not_marked",
        remarks: null,
        timetableSlotId: undefined,
        overrideId: extra.id,
        attendanceId: undefined,
      });
    }

    // Sort descending by date (newest date first), and chronologically by startTime within the same date
    logs.sort((a, b) => {
      if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
      const aTime = a.startTime && a.startTime !== "00:00" ? a.startTime : "99:99";
      const bTime = b.startTime && b.startTime !== "00:00" ? b.startTime : "99:99";
      return aTime.localeCompare(bTime);
    });

    return {
      logs,
      subjects: Object.values(subjectStatsMap),
    };
  }

  static _buildHolidayDateMap(events: any[]) {
    const map = new Map<number, { isHoliday: boolean; isRestrictedHoliday: boolean; reason: string }>();
    const ONE_DAY_MS = 86400000;
    for (const ev of (events || [])) {
      const isHol = (ev.isHolidayList && ev.eventType !== "restricted_holiday") || ["holiday", "vacation", "midsem", "endsem"].includes(ev.eventType);
      const isRestricted = ev.eventType === "restricted_holiday";
      if (!isHol && !isRestricted) continue;

      const evStart = AttendanceService.getDbDateUtc(ev.date);
      const evEnd = ev.endDate ? AttendanceService.getDbDateUtc(ev.endDate) : evStart;

      for (let t = evStart; t <= evEnd; t += ONE_DAY_MS) {
        const existing = map.get(t);
        if (!existing || (!existing.isHoliday && isHol)) {
          map.set(t, {
            isHoliday: isHol,
            isRestrictedHoliday: isRestricted && (!existing || !existing.isHoliday),
            reason: ev.title || (isHol ? "Holiday" : "Restricted Holiday"),
          });
        }
      }
    }
    return map;
  }

  static async _calculateRemainingClasses(
    subject: any,
    events: any[],
    overrides: any[],
    today: Date,
    precomputedHolidayMap?: Map<number, { isHoliday: boolean; isRestrictedHoliday: boolean; reason: string }>
  ) {
    if (!subject.semester) {
      return { remainingClasses: 0, maxRemainingClasses: 0, missingBoundaries: false, futureBreakdown: [] };
    }

    let actualStartDate = new Date(subject.semester.startDate);
    const commencement = events.find(e => e.title && e.title.toLowerCase().includes("commencement of classes"));
    if (commencement && commencement.date) actualStartDate = new Date(commencement.date);

    let actualEndDate = new Date(subject.semester.endDate);
    const lastDay = events.find(e => e.title && (e.title.toLowerCase().includes("last teaching day") || e.title.toLowerCase().includes("last working day")));
    if (lastDay && lastDay.date) actualEndDate = new Date(lastDay.date);

    const missingBoundaries = !commencement || !lastDay;

    if (actualEndDate < today) {
      return { remainingClasses: 0, maxRemainingClasses: 0, missingBoundaries, futureBreakdown: [] };
    }

    const startProjection = today > actualStartDate ? today : actualStartDate;
    const tomorrow = new Date(startProjection);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Instant short-circuit: If this subject has NO active timetable slots, NO future overrides,
    // and NO future attendance records, remainingClasses is strictly 0!
    const activeSlots = (subject.timetableSlots || []).filter((s: any) => s.validUntil === null);
    const tomorrowUTC = Date.UTC(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
    
    // Fast O(1) single-pass maps:
    const overridesByDate = new Map<number, any[]>();
    let hasSubjectOverrides = false;
    for (const o of (overrides || [])) {
      if (o.subjectId === subject.id) {
        const oUtc = AttendanceService.getDbDateUtc(o.date);
        if (oUtc >= tomorrowUTC) hasSubjectOverrides = true;
        const list = overridesByDate.get(oUtc);
        if (list) list.push(o);
        else overridesByDate.set(oUtc, [o]);
      }
    }

    const attendanceByDate = new Map<number, any[]>();
    let hasFutureAttendance = false;
    for (const a of (subject.attendance || [])) {
      const aUtc = AttendanceService.getDbDateUtc(a.date);
      if (aUtc >= tomorrowUTC) hasFutureAttendance = true;
      const list = attendanceByDate.get(aUtc);
      if (list) list.push(a);
      else attendanceByDate.set(aUtc, [a]);
    }

    if (activeSlots.length === 0 && !hasSubjectOverrides && !hasFutureAttendance) {
      return { remainingClasses: 0, maxRemainingClasses: 0, missingBoundaries, futureBreakdown: [] };
    }

    // Use pre-computed holiday map or build on demand
    const holidayDateMap = precomputedHolidayMap || AttendanceService._buildHolidayDateMap(events);

    // Active slots pre-indexed by day-of-week (0=Monday...6=Sunday)
    const slotsByDay = [0, 0, 0, 0, 0, 0, 0];
    for (const s of activeSlots) {
      if (typeof s.dayOfWeek === "number" && s.dayOfWeek >= 0 && s.dayOfWeek < 7) {
        slotsByDay[s.dayOfWeek]++;
      }
    }

    let remainingClasses = 0;
    let maxRemainingClasses = 0;
    const futureBreakdown: any[] = [];
    const ONE_DAY_MS = 86400000;
    const endUTC = Date.UTC(actualEndDate.getFullYear(), actualEndDate.getMonth(), actualEndDate.getDate());

    if (tomorrowUTC <= endUTC) {
      for (let dUTC = tomorrowUTC; dUTC <= endUTC; dUTC += ONE_DAY_MS) {
        const dateOverrides = overridesByDate.get(dUTC) || [];
        const holInfo = holidayDateMap.get(dUTC);
        const isHoliday = !!holInfo?.isHoliday;
        const isRestrictedHoliday = !!holInfo?.isRestrictedHoliday;
        const holidayReason = holInfo?.reason || "Holiday";

        const dObj = new Date(dUTC);
        const dbDayOfWeek = dObj.getUTCDay() === 0 ? 6 : dObj.getUTCDay() - 1;
        const slotsOnDay = slotsByDay[dbDayOfWeek] || 0;

        let extraClasses = 0;
        let cancelledClasses = 0;
        for (const o of dateOverrides) {
          if (o.overrideType === "extra_class") extraClasses++;
          else if (o.overrideType === "cancelled" || o.overrideType === "holiday") cancelledClasses++;
        }

        const markedLogs = attendanceByDate.get(dUTC) || [];
        const markedClasses = markedLogs.length;
        const baseSlots = slotsOnDay + extraClasses;

        if (baseSlots > 0 || markedClasses > 0) {
          const dateIso = dObj.toISOString();
          if (markedClasses > 0) {
            for (const log of markedLogs) {
              futureBreakdown.push({
                date: dateIso,
                type: "LOGGED",
                reason: `Already Logged (${log.status})`,
                count: 1,
                status: log.status,
              });
            }
          }

          const daySlotsCount = Math.max(0, baseSlots - cancelledClasses - markedClasses);

          if (cancelledClasses > 0) {
            futureBreakdown.push({
              date: dateIso,
              type: "OFF",
              reason: "Cancelled/Off Class",
              count: cancelledClasses,
            });
            maxRemainingClasses += cancelledClasses;
          }

          if (daySlotsCount > 0) {
            if (isHoliday || isRestrictedHoliday) {
              futureBreakdown.push({
                date: dateIso,
                type: "OFF",
                reason: holidayReason,
                count: daySlotsCount,
              });
              maxRemainingClasses += daySlotsCount;
            } else {
              futureBreakdown.push({
                date: dateIso,
                type: "HELD",
                count: daySlotsCount,
              });
              remainingClasses += daySlotsCount;
              maxRemainingClasses += daySlotsCount;
            }
          }
        }
      }
    }

    return { remainingClasses, maxRemainingClasses, missingBoundaries, futureBreakdown };
  }

  static async getSubjectStats(userId: string, semesterId?: string) {
    const [user, cachedActiveSem] = await Promise.all([
      CacheService.getOrSet(userId, "user:record", () => prisma.user.findUnique({ where: { id: userId } })),
      CacheService.getOrSet(userId, "semesters:active", () =>
        prisma.semester.findFirst({ where: { userId, isActive: true } })
      )
    ]);
    const activeSemester =
      semesterId && cachedActiveSem?.id !== semesterId
        ? await prisma.semester.findUnique({ where: { id: semesterId } })
        : cachedActiveSem;
    
    const globalTarget = user?.targetAttendance || 75;
    const targetSemesterId = activeSemester?.id || semesterId;

    const [subjects, allEvents, allOverrides] = await Promise.all([
      targetSemesterId
        ? CacheService.getOrSet(userId, `subjects:full:${targetSemesterId}`, () =>
            prisma.subject.findMany({
              where: {
                userId,
                semesterId: targetSemesterId,
              },
              include: {
                attendance: true,
                semester: true,
                timetableSlots: true,
              },
            })
          )
        : prisma.subject.findMany({
            where: { userId },
            include: {
              attendance: true,
              semester: true,
              timetableSlots: true,
            },
          }),
      activeSemester 
        ? CacheService.getOrSet(userId, `events:all:${activeSemester.id}`, () =>
            prisma.event.findMany({
              where: {
                userId,
                OR: [{ semesterId: activeSemester.id }, { semesterId: null }],
              },
            })
          )
        : Promise.resolve([]),
      activeSemester 
        ? CacheService.getOrSet(userId, `overrides:all:${activeSemester.id}`, () =>
            prisma.timetableOverride.findMany({
              where: { semesterId: activeSemester.id },
              include: { subject: true },
            })
          )
        : Promise.resolve([])
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const holidayDateMap = AttendanceService._buildHolidayDateMap(allEvents);

    const promises = subjects.map(async sub => {
      const allRecords = sub.attendance;
      const countableRecords = allRecords.filter(a => a.status === "present" || a.status === "absent" || a.status === "medical" || a.status === "od");
      const attended = countableRecords.filter(a => a.status === "present" || a.status === "medical" || a.status === "od").length;
      const missed = countableRecords.filter(a => a.status === "absent").length;
      const off = allRecords.filter(a => a.status === "off" || a.status === "cancelled").length;
      const total = attended + missed;
      const percentage = total > 0 ? (attended / total) * 100 : 0;
      
      const remainingData = await AttendanceService._calculateRemainingClasses(sub, allEvents, allOverrides, today, holidayDateMap);
      const remainingClasses = remainingData.remainingClasses || 0;
      const expectedTotal = total + remainingClasses;
      
      let canMiss = 0;
      let needAttend = 0;

      if (expectedTotal > 0) {
        canMiss = Math.floor((attended - (globalTarget / 100) * total) / (globalTarget / 100));
        if (canMiss < 0) {
          needAttend = Math.ceil(((globalTarget / 100) * total - attended) / (1 - (globalTarget / 100)));
        }
      }

      return {
        id: sub.id,
        name: sub.name,
        code: sub.code,
        colorHex: sub.colorHex,
        target: sub.targetAttendance ?? globalTarget,
        attended,
        missed,
        off,
        total,
        percentage,
        canMiss: canMiss > 0 ? canMiss : 0,
        needAttend: needAttend > 0 ? needAttend : 0,
        ...remainingData
      };
    });
    
    const subjectsStats = await Promise.all(promises);
    
    let simulationBounds = null;
    if (activeSemester) {
      let actualStartDate = activeSemester.startDate;
      const commencement = allEvents.find(e => e.title && e.title.toLowerCase().includes("commencement of classes"));
      if (commencement && commencement.date) actualStartDate = new Date(commencement.date);

      let actualEndDate = activeSemester.endDate;
      const lastDay = allEvents.find(e => e.title && (e.title.toLowerCase().includes("last teaching day") || e.title.toLowerCase().includes("last working day")));
      if (lastDay && lastDay.date) actualEndDate = new Date(lastDay.date);

      simulationBounds = {
        startDate: (actualStartDate instanceof Date && !isNaN(actualStartDate.getTime()) ? actualStartDate : new Date(actualStartDate)).toISOString(),
        endDate: (actualEndDate instanceof Date && !isNaN(actualEndDate.getTime()) ? actualEndDate : new Date(actualEndDate)).toISOString(),
        missingBoundaries: !commencement || !lastDay,
        hasCommencement: !!commencement,
        hasLastDay: !!lastDay
      };
    }

    return {
      subjects: subjectsStats,
      simulationBounds
    };
  }

  static async getSingleSubjectStats(userId: string, subjectId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const globalTarget = user?.targetAttendance || 75;

    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, userId },
      include: {
        semester: true,
        timetableSlots: true,
        attendance: true,
      }
    });

    if (!subject) return null;

    let attendedClasses = 0;
    let missedClasses = 0;
    let offClasses = 0;
    subject.attendance.forEach((log) => {
      if (log.status === "present" || log.status === "medical" || log.status === "od") attendedClasses++;
      else if (log.status === "absent") missedClasses++;
      else if (log.status === "off" || log.status === "cancelled") offClasses++;
    });
    const totalClasses = attendedClasses + missedClasses;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let allEvents: any[] = [];
    let allOverrides: any[] = [];
    if (subject.semester) {
       allEvents = await prisma.event.findMany({
         where: { 
           OR: [
             { semesterId: subject.semester.id },
             { semesterId: null }
           ]
         }
       });
       allOverrides = await prisma.timetableOverride.findMany({
         where: { semesterId: subject.semester.id }
       });
    }

    const remainingData = await AttendanceService._calculateRemainingClasses(subject, allEvents, allOverrides, today);

    return {
      id: subject.id,
      name: subject.name,
      code: subject.code,
      colorHex: subject.colorHex,
      attended: attendedClasses,
      missed: missedClasses,
      off: offClasses,
      total: totalClasses,
      target: subject.targetAttendance ?? globalTarget,
      percentage: totalClasses > 0 ? (attendedClasses / totalClasses) * 100 : 0,
      timetableSlots: subject.timetableSlots,
      attendance: subject.attendance,
      ...remainingData
    };
  }

  static async getMonthlyCalendar(userId: string, monthStr: string) {
    const [year, m] = monthStr.split("-").map(Number);
    const startDate = new Date(year, m - 1, 1);
    const endDate = new Date(year, m, 0, 23, 59, 59, 999); 

    const activeSemester = await CacheService.getOrSet(
      userId,
      "semesters:active",
      () =>
        prisma.semester.findFirst({
          where: { userId, isActive: true },
        })
    );

    if (!activeSemester) {
      return {
        days: {},
        details: {},
        stats: {
          days: { not_marked: 0, off: 0, missed: 0, attended: 0, mixed: 0 },
          lectures: { off: 0, missed: 0, attended: 0, total: 0, percentage: 0 },
        },
      };
    }

    // Fetch regularSlots (including all archived timetable versions for the semester), globalEvents, overrides, and attendances in 1 parallel round-trip
    const [regularSlots, overrides, attendances, allUserSemesterEvents] =
      await Promise.all([
        CacheService.getOrSet(
          userId,
          `timetable:all_sem_slots_v2:${activeSemester.id}`,
          () =>
            prisma.timetableSlot.findMany({
              where: {
                semesterId: activeSemester.id,
              },
              include: { subject: true },
            }),
        ),
        prisma.timetableOverride.findMany({
          where: {
            semesterId: activeSemester.id,
            date: { gte: startDate, lte: endDate },
          },
          include: { subject: true },
        }),
        prisma.attendance.findMany({
          where: {
            userId,
            date: {
              gte: new Date(startDate.getTime() - 24 * 3600 * 1000),
              lte: new Date(endDate.getTime() + 24 * 3600 * 1000),
            },
          },
          include: {
            subject: true,
          },
        }),
        CacheService.getOrSet(userId, `events:all:${activeSemester.id}`, () =>
          prisma.event.findMany({
            where: {
              userId,
              OR: [{ semesterId: activeSemester.id }, { semesterId: null }],
            },
          }),
        ),
      ]);

    const globalEvents = allUserSemesterEvents.filter((e) => new Date(e.date) <= endDate);
    const totalEventsCount = allUserSemesterEvents.filter((e) => e.semesterId === activeSemester.id).length;

    const daysObj: Record<string, string> = {};
    const detailsObj: Record<string, Array<{ id: string; subjectName: string; status: string; remarks: string | null }>> = {};
    const eventsObj: Record<string, Array<{ id: string; title: string; eventType: string }>> = {};
    const dayStats = { not_marked: 0, off: 0, missed: 0, attended: 0, mixed: 0 };
    const lectureStats = { off: 0, missed: 0, attended: 0, total: 0, percentage: 0 };

    const lastTeachingEvent = globalEvents.find(e => 
      /last\s*(teaching|working)\s*day/i.test(e.title)
    );
    const lastTeachingDateEnd = lastTeachingEvent 
      ? new Date(lastTeachingEvent.endDate || lastTeachingEvent.date)
      : null;
    if (lastTeachingDateEnd) {
      lastTeachingDateEnd.setHours(23, 59, 59, 999);
    }
    const semStartDate = new Date(activeSemester.startDate);
    semStartDate.setHours(0, 0, 0, 0);
    const semEndDate = new Date(activeSemester.endDate);
    semEndDate.setHours(23, 59, 59, 999);

    const numDays = new Date(year, m, 0).getDate();
    for (let day = 1; day <= numDays; day++) {
      const d = new Date(year, m - 1, day);
      const dateKey = AttendanceService.toLocalIso(d);
      const jsDayOfWeek = d.getDay();
      const dbDayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1; // 0=Mon, 6=Sun

      const dUTC = Date.UTC(year, m - 1, day);

      const dayEvents = globalEvents.filter(e => {
        const start = AttendanceService.getDbDateUtc(e.date);
        const end = e.endDate ? AttendanceService.getDbDateUtc(e.endDate) : start;
        return dUTC >= start && dUTC <= end;
      });

      
      // Holidays, vacations, breaks, and exams count as global off (classes suspended)
      const isGlobalOff = dayEvents.some(e => {
        const t = String(e.eventType || "").toLowerCase();
        const title = String(e.title || "").toLowerCase();
        return (
          ["holiday", "vacation", "exam", "midsem", "endsem"].includes(t) ||
          /holiday|vacation|break|recess|exam|midsem|endsem/i.test(title)
        );
      });
      if (dayEvents.length > 0) {
        // Smart deduplication: collapse holidays that share the same root name or are duplicates on the same date
        const deduplicatedDayEvents: any[] = [];
        for (const ev of dayEvents) {
          const isHol = ev.isHoliday || ["holiday", "restricted_holiday"].includes(ev.eventType);
          if (isHol) {
            const existingHolIdx = deduplicatedDayEvents.findIndex(d => 
              (d.isHoliday || ["holiday", "restricted_holiday"].includes(d.eventType)) &&
              isSameHoliday(d.title, ev.title)
            );
            if (existingHolIdx !== -1) {
              // Prefer the more descriptive title (e.g. "Dussehra (Vijay Dashmi)" over "Dussehra")
              if (ev.title.length > deduplicatedDayEvents[existingHolIdx].title.length) {
                deduplicatedDayEvents[existingHolIdx] = ev;
              }
              continue;
            }
          } else {
            // Non-holiday exact duplicate title check
            const exactDup = deduplicatedDayEvents.some(d => d.title.toLowerCase().trim() === ev.title.toLowerCase().trim());
            if (exactDup) continue;
          }
          deduplicatedDayEvents.push(ev);
        }

        eventsObj[dateKey] = deduplicatedDayEvents.map(e => ({
          id: e.id,
          title: e.title,
          eventType: e.eventType,
          isHolidayList: e.isHolidayList,
        }));
      }
      
      const dStart = new Date(d);
      dStart.setHours(0, 0, 0, 0);
      const dEnd = new Date(d);
      dEnd.setHours(23, 59, 59, 999);
      const isBeforeSemester = dStart < semStartDate;
      const isPastTeachingDay = (lastTeachingDateEnd && dEnd > lastTeachingDateEnd) || dEnd > semEndDate;

      const hasArchivedSlotForSubjectOnDay = (subId: string) =>
        regularSlots.some((s) => {
          if (!s.validUntil || s.subjectId !== subId) return false;
          const fromKey = AttendanceService.toDbLocalIso(s.validFrom);
          const untilKey = AttendanceService.toDbLocalIso(s.validUntil);
          return fromKey <= dateKey && untilKey >= dateKey;
        });

      const rawDaySlots =
        isPastTeachingDay || isBeforeSemester || isGlobalOff
          ? []
          : regularSlots.filter((s) => {
              if (s.dayOfWeek !== dbDayOfWeek) return false;
              const fromDateKey = AttendanceService.toDbLocalIso(s.validFrom);
              if (fromDateKey > dateKey) return false; // Not active yet on this calendar date
              if (s.validUntil) {
                const untilDateKey = AttendanceService.toDbLocalIso(s.validUntil);
                if (untilDateKey < dateKey) return false; // Already archived before this calendar date began
              } else if (hasArchivedSlotForSubjectOnDay(s.subjectId)) {
                return false;
              }
              return true;
            });

      // Deduplicate overlapping daySlots (old vs new timetable on transition day) by subjectId and time window
      const daySlots = [];
      const seenDaySlotWindows = new Set<string>();
      const sortedRawDaySlots = [...rawDaySlots].sort((a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime());
      for (const s of sortedRawDaySlots) {
        const timeKey = `${s.subjectId}_${(s.startTime || '').trim()}_${(s.endTime || '').trim()}`;
        if (!seenDaySlotWindows.has(timeKey)) {
          seenDaySlotWindows.add(timeKey);
          daySlots.push(s);
        }
      }
      daySlots.sort((a, b) => (a.startTime || "99:99").localeCompare(b.startTime || "99:99"));

      const dayOverrides = overrides.filter(o => AttendanceService.toDbLocalIso(o.date) === dateKey);
      
      let expectedClasses = 0;
      const expectedSubjectIds = new Set<string>();

      for (const slot of daySlots) {
        const over = dayOverrides.find(o => o.originalSlotId === slot.id);
        if (over && (over.overrideType === "holiday" || over.overrideType === "cancelled")) {
          // skip
        } else {
          expectedClasses++;
          expectedSubjectIds.add(slot.subjectId);
        }
      }
      
      const extras = dayOverrides.filter(o => {
        const oDateStr = AttendanceService.toDbLocalIso(o.date);
        return o.overrideType === "extra_class" && oDateStr === dateKey;
      });
      for (const o of extras) {
        if (o.subjectId) {
          expectedClasses++;
          expectedSubjectIds.add(o.subjectId);
        }
      }

      // Filter attendance records for this day
      const dayAtts = attendances.filter(a => AttendanceService.toDbLocalIso(a.date) === dateKey);



      // Add manual attendances (that don't match any expected slot/override) to expectedClasses
      for (const a of dayAtts) {
        if (!expectedSubjectIds.has(a.subjectId)) {
          expectedClasses++;
        }
      }
       // Get today's date string in IST (+5:30)
      const now = new Date();
      const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      const localTodayStr = istTime.toISOString().split("T")[0];


      let status = "off";

      const totalExpected = expectedClasses;
      const isFullyMarked = totalExpected > 0 && dayAtts.length >= totalExpected;

      if (isFullyMarked) {
        let presentCount = 0;
        let absentCount = 0;
        let offCount = 0;

        for (const a of dayAtts) {
          if (
            a.status === "present" ||
            a.status === "medical" ||
            a.status === "od"
          )
            presentCount++;
          else if (a.status === "absent") absentCount++;
          else if (a.status === "off" || a.status === "cancelled") offCount++;
        }

        if (presentCount > 0 && absentCount === 0) status = "attended";
        else if (absentCount > 0 && presentCount === 0) status = "missed";
        else if (presentCount > 0 && absentCount > 0) status = "mixed";
        else if (offCount > 0) status = "off";
        else status = dateKey > localTodayStr ? "future" : "not_marked";
      } else if (totalExpected === 0) {
        status = "off";
      } else {
        // Partially marked or unmarked: stays grey dot
        status = dateKey > localTodayStr ? "future" : "not_marked";
      }
      
      if (dateKey > localTodayStr) {
        if (status === "not_marked") status = "future";
      }

      daysObj[dateKey] = status;
      
      const dayAgenda: any[] = [];
      const handledAttendanceIds = new Set<string>();

      for (const slot of daySlots) {
        const over = dayOverrides.find(o => o.originalSlotId === slot.id);
        if (over && (over.overrideType === "holiday" || over.overrideType === "cancelled")) continue;
          let att = dayAtts.find(a => a.timetableSlotId === slot.id);
        if (!att) {
          att = dayAtts.find(a => !handledAttendanceIds.has(a.id) && a.subjectId === slot.subjectId);
        }
        if (att) handledAttendanceIds.add(att.id);
        dayAgenda.push({
          id: att ? att.id : `unmarked-${slot.id}-${dateKey}`,
          subjectId: slot.subjectId,
          subjectName: slot.subject?.name || "Subject",
          startTime: slot.startTime || "00:00",
          endTime: slot.endTime || "00:00",
          status: att ? att.status : (dateKey > localTodayStr ? "future" : "not_marked"),
          remarks: att ? att.remarks : null,
          isExtra: false,
        });
      }

      for (const o of extras) {
        if (o.subjectId) {
          let att = dayAtts.find(a => a.overrideId === o.id);
          if (!att) {
            att = dayAtts.find(a => !handledAttendanceIds.has(a.id) && a.subjectId === o.subjectId && !a.timetableSlotId && !a.overrideId);
          }
          if (att) handledAttendanceIds.add(att.id);
          dayAgenda.push({
            id: att ? att.id : `unmarked-${o.id}-${dateKey}`,
            subjectId: o.subjectId,
            subjectName: o.subject?.name || "Subject",
            startTime: o.startTime || "00:00",
            endTime: o.endTime || "00:00",
            isExtra: true,
            status: att ? att.status : (dateKey > localTodayStr ? "future" : "not_marked"),
            remarks: att ? att.remarks : null,
          });
        }
      }

      for (const a of dayAtts) {
        if (!handledAttendanceIds.has(a.id)) {
          const matchedSlot = AttendanceService.findBestSlotForDate(
            regularSlots,
            a.subjectId,
            dbDayOfWeek,
            dateKey,
            a.timetableSlotId
          );
          const matchedOverride = a.overrideId ? dayOverrides.find(o => o.id === a.overrideId) : undefined;
          const isScheduledOnDay =
            daySlots.some(s => s.subjectId === a.subjectId) ||
            regularSlots.some(s => s.subjectId === a.subjectId && s.dayOfWeek === dbDayOfWeek);
          const isExtraClass = matchedOverride
            ? matchedOverride.overrideType === "extra_class"
            : !isScheduledOnDay;
          dayAgenda.push({
            id: a.id,
            subjectId: a.subjectId,
            subjectName: a.subject?.name || "Subject",
            startTime: matchedOverride?.startTime || matchedSlot?.startTime || "00:00",
            endTime: matchedOverride?.endTime || matchedSlot?.endTime || "00:00",
            isExtra: isExtraClass,
            status: a.status,
            remarks: a.remarks || null,
          });
        }
      }

      if (dayAgenda.length > 0) {
        dayAgenda.sort((a, b) => {
          const aTime = a.startTime && a.startTime !== "00:00" ? a.startTime : "99:99";
          const bTime = b.startTime && b.startTime !== "00:00" ? b.startTime : "99:99";
          return aTime.localeCompare(bTime);
        });
        detailsObj[dateKey] = dayAgenda;
      }

      if (status === "not_marked" || status === "future") dayStats.not_marked++;
      else if (status === "off") dayStats.off++;
      else if (status === "missed") dayStats.missed++;
      else if (status === "attended") dayStats.attended++;
      else if (status === "mixed") dayStats.mixed++;

      for (const a of dayAtts) {
        if (a.status === "present" || a.status === "medical" || a.status === "od") lectureStats.attended++;
        else if (a.status === "absent") lectureStats.missed++;
        else if (a.status === "off" || a.status === "cancelled") lectureStats.off++;
      }
    }

    lectureStats.total = lectureStats.attended + lectureStats.missed;
    lectureStats.percentage = lectureStats.total > 0 ? (lectureStats.attended / lectureStats.total) * 100 : 0;

    return {
      hasCalendar: totalEventsCount > 0,
      days: daysObj,
      details: detailsObj,
      events: eventsObj,
      stats: {
        days: dayStats,
        lectures: lectureStats,
      },
    };
  }
  static async updateBoundaries(userId: string, semesterId: string, startDate: string, endDate: string) {
    const semester = await prisma.semester.findFirst({
      where: { id: semesterId, userId }
    });
    if (!semester) throw new Error("Semester not found or unauthorized");

    // Helper to upsert a boundary event
    const upsertBoundary = async (title: string, dateStr: string) => {
      // Find existing event
      const existing = await prisma.event.findFirst({
        where: {
          semesterId,
          userId,
          title: { contains: title, mode: 'insensitive' }
        }
      });
      
      if (existing) {
        return prisma.event.update({
          where: { id: existing.id },
          data: { date: new Date(dateStr), endDate: new Date(dateStr) }
        });
      } else {
        return prisma.event.create({
          data: {
            userId,
            semesterId,
            title,
            date: new Date(dateStr),
            endDate: new Date(dateStr),
            eventType: "institute",
            allDay: true,
            isHoliday: false,
            isHolidayList: false
          }
        });
      }
    };

    await upsertBoundary("Commencement of Classes", startDate);
    await upsertBoundary("Last Teaching Day", endDate);
  }
}
