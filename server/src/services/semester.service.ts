import { prisma } from "../lib/prisma";
import { CacheService } from "./cache.service";
import { TemplateEventService } from "./template_event.service";
import { AcademicTemplateService } from "./academic_template.service";
import { PushNotificationService } from "./push_notification.service";

export class SemesterService {
  private static async wipeSemesterRelations(semesterId: string, userId: string) {
    // 1. Fetch relations by concrete indexed IDs in parallel
    const [, subjects, slots, overrides] = await Promise.all([
      prisma.classroom.updateMany({
        where: { semesterId },
        data: { semesterId: null }
      }),
      prisma.subject.findMany({
        where: { semesterId },
        select: { id: true }
      }),
      prisma.timetableSlot.findMany({
        where: { semesterId },
        select: { id: true }
      }),
      prisma.timetableOverride.findMany({
        where: { semesterId },
        select: { id: true }
      }),
    ]);
    const subjectIds = subjects.map(s => s.id);
    const slotIds = slots.map(s => s.id);
    const overrideIds = overrides.map(o => o.id);

    // 2. Detach notes/assignments, delete exports, and delete attendance by direct indexed FK columns
    const cleanupOps: Promise<any>[] = [
      prisma.export.deleteMany({
        where: {
          OR: [
            { semesterId },
            ...(subjectIds.length > 0 ? [{ subjectId: { in: subjectIds } }] : []),
          ]
        }
      })
    ];

    if (subjectIds.length > 0) {
      cleanupOps.push(
        prisma.note.updateMany({
          where: { subjectId: { in: subjectIds } },
          data: { subjectId: null }
        }),
        prisma.assignment.updateMany({
          where: { subjectId: { in: subjectIds } },
          data: { subjectId: null }
        }),
        prisma.attendance.deleteMany({
          where: { userId, subjectId: { in: subjectIds } }
        })
      );
    }

    if (slotIds.length > 0) {
      cleanupOps.push(
        prisma.attendance.deleteMany({
          where: { userId, timetableSlotId: { in: slotIds } }
        })
      );
    }

    if (overrideIds.length > 0) {
      cleanupOps.push(
        prisma.attendance.deleteMany({
          where: { userId, overrideId: { in: overrideIds } }
        })
      );
    }

    await Promise.all(cleanupOps);

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
    await Promise.all([
      CacheService.del(userId, "onboarding:status"),
      CacheService.del(userId, "semesters:active"),
      CacheService.invalidateUser(userId),
    ]);
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
    await Promise.all([
      CacheService.del(userId, "onboarding:status"),
      CacheService.del(userId, "semesters:active"),
      CacheService.invalidateUser(userId),
    ]);
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
      await Promise.all([
        CacheService.del(userId, "onboarding:status"),
        CacheService.del(userId, "semesters:active"),
        CacheService.invalidateUser(userId),
      ]);
      return deletedSemester;
    } else {
      // Detach attendance and overrides before removing slots while retaining historical attendance
      const [slots, overrides] = await Promise.all([
        prisma.timetableSlot.findMany({
          where: { semesterId: semester.id },
          select: { id: true },
        }),
        prisma.timetableOverride.findMany({
          where: { semesterId: semester.id },
          select: { id: true },
        }),
      ]);
      const slotIds = slots.map((s) => s.id);
      const overrideIds = overrides.map((o) => o.id);

      const detachOps: Promise<any>[] = [];
      if (slotIds.length > 0) {
        detachOps.push(
          prisma.attendance.updateMany({
            where: { userId, timetableSlotId: { in: slotIds } },
            data: { timetableSlotId: null },
          })
        );
      }
      if (overrideIds.length > 0) {
        detachOps.push(
          prisma.attendance.updateMany({
            where: { userId, overrideId: { in: overrideIds } },
            data: { overrideId: null },
          })
        );
      }
      if (detachOps.length > 0) {
        await Promise.all(detachOps);
      }

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
      await Promise.all([
        CacheService.del(userId, "onboarding:status"),
        CacheService.del(userId, "semesters:active"),
        CacheService.invalidateUser(userId),
      ]);
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

    const allSemEvents = await prisma.event.findMany({
      where: { userId, semesterId: activeSemester.id },
      orderBy: { date: "asc" },
    });

    const toIso = (dt: Date | string) => new Date(dt).toISOString().split("T")[0];
    const istNow = new Date(Date.now() + 330 * 60 * 1000);
    const todayIso = istNow.toISOString().split("T")[0];

    const lastTeachingEvent = allSemEvents.find((e) =>
      /last\s*(teaching|working)\s*day/i.test(e.title)
    );

    const semStartIso = toIso(activeSemester.startDate);
    const semEnd = new Date(activeSemester.endDate);
    semEnd.setHours(23, 59, 59, 999);
    const semEndIso = toIso(activeSemester.endDate);
    const isSemesterEnded = todayIso > semEndIso;

    let isTeachingEnded = isSemesterEnded;
    let lastTeachingDate: string | null = null;
    if (lastTeachingEvent) {
      lastTeachingDate = toIso(lastTeachingEvent.endDate || lastTeachingEvent.date);
      isTeachingEnded = todayIso > lastTeachingDate;
    }

    // Extract End-Sem Theory, Lab Exam, Vacation & Next Sem Commencement milestones
    const theoryExamEvents = allSemEvents.filter(
      (e) =>
        !/lab|practical|demo|mid\s*sem|supplementary/i.test(e.title) &&
        (/end\s*sem(?:ester)?\s*(?:theory|exam)/i.test(e.title) || e.eventType === "endsem")
    );
    const labExamEvents = allSemEvents.filter(
      (e) =>
        !/demo|mid/i.test(e.title) &&
        (/end\s*sem(?:ester)?\s*lab|lab\s*exam|practical.*exam/i.test(e.title) ||
          (e.eventType === "lab_exam" && (!lastTeachingDate || toIso(e.date) >= lastTeachingDate)))
    );
    const vacationEvents = allSemEvents.filter((e) => {
      const eIso = toIso(e.date);
      const afterTeaching = lastTeachingDate ? eIso >= lastTeachingDate : eIso >= semStartIso;
      return (
        afterTeaching &&
        (e.eventType === "vacation" ||
          /commencement\s*of\s*student\s*vacation|winter\s*vacation|summer\s*vacation/i.test(e.title))
      );
    });
    const nextSemStartEvt = allSemEvents.find((e) =>
      /next\s*semester\s*commencement/i.test(e.title)
    );
    if (nextSemStartEvt) {
      suggestedStartDate = toIso(nextSemStartEvt.date);
    } else {
      // Check latest backend Academic Calendar override for next semester start if available
      try {
        const nextCal = await AcademicTemplateService.getAcademicCalendar({
          year: nextYear,
          semesterType: nextSemesterType,
          semesterNumber: nextSemNum,
        });
        const commence = nextCal.events.find((e) =>
          /commencement\s*of\s*classes/i.test(e.title)
        );
        if (commence?.startDate) {
          suggestedStartDate = commence.startDate;
        }
      } catch {}
    }

    const theoryExamStartDate =
      theoryExamEvents.length > 0 ? toIso(theoryExamEvents[0].date) : null;
    const theoryExamEndDate =
      theoryExamEvents.length > 0
        ? theoryExamEvents
            .map((e) => toIso(e.endDate || e.date))
            .sort()
            .slice(-1)[0]
        : null;
    const labExamStartDate =
      labExamEvents.length > 0 ? toIso(labExamEvents[0].date) : null;
    const lastLabExamDate =
      labExamEvents.length > 0
        ? labExamEvents
            .map((e) => toIso(e.endDate || e.date))
            .sort()
            .slice(-1)[0]
        : null;
    const vacationStartDate =
      vacationEvents.length > 0 ? toIso(vacationEvents[0].date) : null;

    const formatShortDate = (iso: string | null) => {
      if (!iso) return "";
      const dt = new Date(`${iso}T00:00:00Z`);
      if (isNaN(dt.getTime())) return iso;
      return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    };
    const nextSemesterStartFormatted = formatShortDate(suggestedStartDate);

    let transitionStage:
      | "teaching"
      | "final_days"
      | "exams_remaining"
      | "labs_remaining"
      | "all_done" = "teaching";
    let stageTitle = "Semester in Progress";
    let stageSubtitle = "Classes and attendance logs are active.";
    let stageMessage = "";
    let shouldShowBanner = false;
    let shouldPromptTransition = false;

    const pastLabExams = Boolean(lastLabExamDate && todayIso > lastLabExamDate);
    const inVacation = Boolean(vacationStartDate && todayIso >= vacationStartDate);
    const pastAllKnownExams = Boolean(
      !lastLabExamDate && theoryExamEndDate && todayIso > theoryExamEndDate
    );

    if (isSemesterEnded || pastLabExams || inVacation || pastAllKnownExams) {
      transitionStage = "all_done";
      shouldShowBanner = true;
      shouldPromptTransition = true;
      stageTitle = "All Exams Complete — Vacation Has Begun!";
      stageSubtitle = `Next semester (${nextSemesterName}) starts on ${nextSemesterStartFormatted}.`;
      stageMessage = `Your exams & labs are officially done! Your next semester starts on ${nextSemesterStartFormatted} — thanks for riding with AttendX!`;
    } else if (theoryExamEndDate && todayIso > theoryExamEndDate) {
      transitionStage = "labs_remaining";
      shouldShowBanner = true;
      stageTitle = "End-Sem Theory Done — Just Lab Exams Remaining";
      stageSubtitle = lastLabExamDate
        ? `Practical evaluations wrap up by ${formatShortDate(lastLabExamDate)}. Next sem starts ${nextSemesterStartFormatted}.`
        : `Final lab exams remain. Next sem starts ${nextSemesterStartFormatted}.`;
      stageMessage = stageSubtitle;
    } else if (lastTeachingDate && todayIso >= lastTeachingDate) {
      transitionStage = "exams_remaining";
      shouldShowBanner = true;
      stageTitle =
        todayIso === lastTeachingDate
          ? "Last Teaching Day Today — Exams Ahead"
          : "Teaching Concluded — Just Exams Remaining";
      stageSubtitle = theoryExamEndDate
        ? `Classes are done! End-Sem Exams run through ${formatShortDate(theoryExamEndDate)}${lastLabExamDate ? ` · Labs end ${formatShortDate(lastLabExamDate)}` : ""}.`
        : "Regular lectures have ended — just exams remain!";
      stageMessage = stageSubtitle;
    } else if (lastTeachingDate) {
      const diffMs =
        new Date(`${lastTeachingDate}T00:00:00Z`).getTime() -
        new Date(`${todayIso}T00:00:00Z`).getTime();
      const daysLeft = Math.round(diffMs / 86400000);
      if (daysLeft >= 1 && daysLeft <= 7) {
        transitionStage = "final_days";
        stageTitle = `${daysLeft} Teaching Day${daysLeft === 1 ? "" : "s"} Left`;
        stageSubtitle = `Approaching Last Teaching Day (${formatShortDate(lastTeachingDate)}). Replay card ready anytime.`;
        stageMessage = stageSubtitle;
      }
    }

    return {
      hasActiveSemester: true,
      activeSemester,
      currentSemesterNumber: currentSemNum,
      currentYearName: getYearSuffix(Math.ceil(currentSemNum / 2)),
      isSemesterEnded,
      isTeachingEnded,
      lastTeachingDate,
      transitionStage,
      stageTitle,
      stageSubtitle,
      stageMessage,
      shouldShowBanner,
      shouldPromptTransition,
      theoryExamStartDate,
      theoryExamEndDate,
      labExamStartDate,
      lastLabExamDate,
      vacationStartDate,
      nextSemesterStartFormatted,
      nextSemester: {
        semesterNumber: nextSemNum,
        yearNumber: nextYearNum,
        yearName: nextYearName,
        name: nextSemesterName,
        semesterType: nextSemesterType,
        year: nextYear,
        suggestedStartDate,
        suggestedEndDate,
        formattedStartDate: nextSemesterStartFormatted,
      },
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
      where: { userId, isActive: true },
      orderBy: { createdAt: "desc" }
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

    // Ensure any remaining active semesters for user are deactivated
    await prisma.semester.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false }
    });

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

    // 3. Auto-sync calendar and holidays asynchronously / non-blocking so the transition completes sub-second
    if (data.autoSyncCalendar !== false || data.autoSyncHolidays !== false) {
      AcademicTemplateService.syncToSemester({
        userId,
        semesterId: newSemester.id,
        syncHolidayList: data.autoSyncHolidays !== false,
        syncAcademicCalendar: data.autoSyncCalendar !== false,
        semesterNumber: data.semesterNumber,
        year: new Date(data.startDate).getFullYear(),
        rewriteExisting: true,
      }).catch((err) => {
        console.error("[SemesterService] Auto-sync failed in background during transition:", err);
      });
    }

    await CacheService.invalidateUser(userId);
    return {
      success: true,
      message: "Successfully transitioned to next semester",
      semester: newSemester,
      syncedCount: 0
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
