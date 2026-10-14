import { prisma } from "../lib/prisma";
import { CacheService } from "./cache.service";
import { TemplateEventService } from "./template_event.service";
import { PushNotificationService } from "./push_notification.service";

export class SemesterService {
  private static async wipeSemesterRelations(semesterId: string, userId: string) {
    // 1. Detach classrooms and fetch subjects in parallel
    const [, subjects] = await Promise.all([
      prisma.classroom.updateMany({
        where: { semesterId },
        data: { semesterId: null }
      }),
      prisma.subject.findMany({
        where: { semesterId },
        select: { id: true }
      }),
    ]);
    const subjectIds = subjects.map(s => s.id);

    // 2. Detach notes/assignments and delete exports + attendance in parallel
    await Promise.all([
      ...(subjectIds.length > 0
        ? [
            prisma.note.updateMany({
              where: { subjectId: { in: subjectIds } },
              data: { subjectId: null }
            }),
            prisma.assignment.updateMany({
              where: { subjectId: { in: subjectIds } },
              data: { subjectId: null }
            }),
          ]
        : []),
      prisma.export.deleteMany({
        where: {
          OR: [
            { semesterId },
            ...(subjectIds.length > 0 ? [{ subjectId: { in: subjectIds } }] : []),
          ]
        }
      }),
      prisma.attendance.deleteMany({
        where: {
          userId,
          OR: [
            ...(subjectIds.length > 0 ? [{ subjectId: { in: subjectIds } }] : []),
            { timetableSlot: { semesterId } },
            { override: { semesterId } },
          ]
        }
      }),
    ]);

    // 3. Delete overrides, events, and slots, then subjects
    await Promise.all([
      prisma.timetableOverride.deleteMany({ where: { semesterId } }),
      prisma.event.deleteMany({ where: { semesterId } }),
    ]);
    await prisma.timetableSlot.deleteMany({ where: { semesterId } });
    if (subjectIds.length > 0) {
      await prisma.subject.deleteMany({ where: { id: { in: subjectIds } } });
    }
  }

  static async listSemesters(userId: string) {
    return prisma.semester.findMany({
      where: { userId },
      include: { subjects: true },
      orderBy: { createdAt: "desc" },
    });
  }

  static async createSemester(userId: string, data: any) {
    // If setting active, deactivate others
    if (data.isActive) {
      await prisma.semester.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });
    }

    const semester = await prisma.semester.create({
      data: {
        userId,
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isActive: data.isActive ?? true,
      },
    });
    await CacheService.invalidateUser(userId);
    return semester;
  }

  static async getActiveSemester(userId: string) {
    return prisma.semester.findFirst({
      where: { userId, isActive: true },
      include: { subjects: true },
    });
  }

  static async activateSemester(userId: string, semesterId: string) {
    const semester = await prisma.semester.findFirst({
      where: { id: semesterId, userId },
    });

    if (!semester) {
      throw new Error("Semester not found");
    }

    await prisma.semester.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });
    const updatedSemester = await prisma.semester.update({
      where: { id: semester.id },
      data: { isActive: true },
    });
    await CacheService.invalidateUser(userId);
    return updatedSemester;
  }

  static async deleteSemester(userId: string, semesterId: string, wipeAttendance = false) {
    const semester = await prisma.semester.findFirst({
      where: { id: semesterId, userId },
    });

    if (!semester) {
      throw new Error("Semester not found");
    }

    if (wipeAttendance) {
      await this.wipeSemesterRelations(semester.id, userId);

      // Wipes the semester record cleanly after leaf-to-root cleanup
      const deletedSemester = await prisma.semester.delete({
        where: { id: semester.id },
      });
      await CacheService.invalidateUser(userId);
      return deletedSemester;
    } else {
      // Detach attendance and overrides before removing slots while retaining historical attendance
      await prisma.attendance.updateMany({
        where: {
          userId,
          OR: [
            { timetableSlot: { semesterId: semester.id } },
            { override: { semesterId: semester.id } },
          ],
        },
        data: { timetableSlotId: null, overrideId: null },
      });
      await prisma.timetableOverride.deleteMany({
        where: { semesterId: semester.id },
      });
      await prisma.timetableSlot.deleteMany({
        where: { semesterId: semester.id },
      });
      const updatedSemester = await prisma.semester.update({
        where: { id: semester.id },
        data: { isActive: false },
      });
      await CacheService.invalidateUser(userId);
      return updatedSemester;
    }
  }

  static async getTransitionStatus(userId: string) {
    const activeSemester = await this.getActiveSemester(userId);
    if (!activeSemester) {
      return { hasActiveSemester: false };
    }

    const semName = activeSemester.name;
    let currentSemNum = 1;
    const semMatch = semName.match(/(?:semester|sem)[^\d]*(\d+)/i) 
      || semName.match(/(\d+)(?:st|nd|rd|th)?\s*(?:semester|sem)/i) 
      || semName.match(/\b(\d+)\b/);
    if (semMatch) {
      currentSemNum = parseInt(semMatch[1], 10);
    }

    const getYearSuffix = (n: number) => {
      if (n === 1) return "1st Year";
      if (n === 2) return "2nd Year";
      if (n === 3) return "3rd Year";
      return `${n}th Year`;
    };

    const nextSemNum = currentSemNum + 1;
    // Odd -> Even: academic year remains unchanged (e.g. 5 -> 6 stays 3rd Year)
    // Even -> Odd: academic year increments by 1 (e.g. 6 -> 7 moves 3rd Year -> 4th Year)
    const nextYearNum = Math.ceil(nextSemNum / 2);
    const nextYearName = getYearSuffix(nextYearNum);
    const nextSemesterName = `Semester ${nextSemNum} (${nextYearName})`;
    const nextSemesterType: 'odd' | 'even' = nextSemNum % 2 !== 0 ? 'odd' : 'even';

    const currentEnd = new Date(activeSemester.endDate);
    let nextYear = currentEnd.getFullYear();
    if (nextSemesterType === 'even') {
      const currentStart = new Date(activeSemester.startDate);
      if (currentStart.getMonth() >= 6) {
        nextYear = currentStart.getFullYear() + 1;
      }
    }

    let suggestedStartDate = nextSemesterType === 'even'
      ? `${nextYear}-01-11`
      : `${nextYear}-07-14`;
    let suggestedEndDate = nextSemesterType === 'even'
      ? `${nextYear}-06-30`
      : `${nextYear}-12-31`;

    // Invariant: Next semester must never start on or before current semester ends
    if (new Date(suggestedStartDate) <= currentEnd) {
      nextYear += 1;
      suggestedStartDate = nextSemesterType === 'even'
        ? `${nextYear}-01-11`
        : `${nextYear}-07-14`;
      suggestedEndDate = nextSemesterType === 'even'
        ? `${nextYear}-06-30`
        : `${nextYear}-12-31`;
    }

    const lastTeachingEvent = await prisma.event.findFirst({
      where: {
        userId,
        semesterId: activeSemester.id,
        title: { contains: "Last Teaching Day", mode: "insensitive" }
      }
    });

    const today = new Date();
    const semEnd = new Date(activeSemester.endDate);
    semEnd.setHours(23, 59, 59, 999);
    const isSemesterEnded = today > semEnd;

    let isTeachingEnded = isSemesterEnded;
    let lastTeachingDate: string | null = null;
    if (lastTeachingEvent) {
      const lDate = new Date(lastTeachingEvent.endDate || lastTeachingEvent.date);
      lastTeachingDate = lDate.toISOString().split('T')[0];
      const lDateEnd = new Date(lDate);
      lDateEnd.setHours(23, 59, 59, 999);
      isTeachingEnded = today > lDateEnd;
    }

    return {
      hasActiveSemester: true,
      activeSemester,
      currentSemesterNumber: currentSemNum,
      currentYearName: getYearSuffix(Math.ceil(currentSemNum / 2)),
      isSemesterEnded,
      isTeachingEnded,
      lastTeachingDate,
      nextSemester: {
        semesterNumber: nextSemNum,
        yearNumber: nextYearNum,
        yearName: nextYearName,
        name: nextSemesterName,
        semesterType: nextSemesterType,
        year: nextYear,
        suggestedStartDate,
        suggestedEndDate
      }
    };
  }

  static async transitionToNextSemester(userId: string, data: {
    nextName: string;
    startDate: string;
    endDate: string;
    semesterNumber?: number;
    wipeOldData?: boolean;
    autoSyncCalendar?: boolean;
    autoSyncHolidays?: boolean;
  }) {
    const activeSemester = await prisma.semester.findFirst({
      where: { userId, isActive: true }
    });

    // 1. Wipe or deactivate old semester
    if (activeSemester) {
      if (data.wipeOldData !== false) {
        await this.wipeSemesterRelations(activeSemester.id, userId);

        // Delete old semester after leaf-to-root cleanup
        await prisma.semester.delete({
          where: { id: activeSemester.id }
        });
      } else {
        await prisma.semester.update({
          where: { id: activeSemester.id },
          data: { isActive: false }
        });
      }
    }

    // 2. Create the new semester
    const newSemester = await prisma.semester.create({
      data: {
        userId,
        name: data.nextName,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isActive: true
      }
    });

    // 3. Auto-sync calendar and holidays if requested
    let syncResult: any = { syncedCount: 0 };
    if (data.autoSyncCalendar !== false || data.autoSyncHolidays !== false) {
      try {
        syncResult = await TemplateEventService.syncToSemester({
          userId,
          semesterId: newSemester.id,
          syncHolidayList: data.autoSyncHolidays !== false,
          syncAcademicCalendar: data.autoSyncCalendar !== false,
          semesterNumber: data.semesterNumber,
          year: new Date(data.startDate).getFullYear()
        });
      } catch (err) {
        console.error("[SemesterService] Auto-sync failed during transition:", err);
      }
    }

    await CacheService.invalidateUser(userId);
    return {
      success: true,
      message: "Successfully transitioned to next semester",
      semester: newSemester,
      syncedCount: syncResult.syncedCount || 0
    };
  }

  static async sendSemesterEndNotification(userId: string) {
    const activeSemester = await prisma.semester.findFirst({
      where: { userId, isActive: true }
    });
    if (!activeSemester) return false;

    const semName = activeSemester.name;
    let nextSemName = "your next semester";
    const semMatch = semName.match(/(?:semester|sem)[^\d]*(\d+)/i) 
      || semName.match(/(\d+)(?:st|nd|rd|th)?\s*(?:semester|sem)/i) 
      || semName.match(/\b(\d+)\b/);
    if (semMatch) {
      const semNum = parseInt(semMatch[1], 10);
      const nextNum = semNum + 1;
      const yr = Math.ceil(nextNum / 2);
      const suffix = yr === 1 ? "1st" : yr === 2 ? "2nd" : yr === 3 ? "3rd" : `${yr}th`;
      nextSemName = `Semester ${nextNum} (${suffix} Year)`;
    }

    return PushNotificationService.sendToUser(
      userId,
      "🎓 Semester Completed!",
      `Congratulations! ${semName} has ended. Tap to reset app data & set up ${nextSemName}!`,
      {
        type: "semester_transition",
        semesterId: activeSemester.id,
        url: "/today?promptSemesterTransition=true",
        route: "/today?promptSemesterTransition=true"
      }
    );
  }
}
