import { prisma } from "../lib/prisma";

export class AttendanceService {
  private static toLocalIso(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  /**
   * Get the agenda for a specific date:
   * 1. Get all regular TimetableSlots for the dayOfWeek
   * 2. Get all TimetableOverrides for the specific date
   * 3. Fetch any existing Attendance records for these slots/overrides
   */
  static async getTodayAgenda(userId: string, dateStr: string) {
    const targetDate = new Date(dateStr);
    const dayOfWeek = targetDate.getDay() === 0 ? 6 : targetDate.getDay() - 1; // 0=Mon, 6=Sun in our db

    // We need to fetch the active semester for the user first
    const activeSemester = await prisma.semester.findFirst({
      where: { userId, isActive: true },
    });

    if (!activeSemester) {
      return [];
    }

    // 1. Fetch regular slots
    const regularSlots = await prisma.timetableSlot.findMany({
      where: {
        semesterId: activeSemester.id,
        dayOfWeek,
      },
      include: {
        subject: true,
      },
    });

    // 2. Fetch overrides (extra classes, holidays)
    const overrides = await prisma.timetableOverride.findMany({
      where: {
        semesterId: activeSemester.id,
        date: targetDate,
      },
      include: {
        subject: true,
      },
    });

    // 3. Fetch existing attendance records for the date
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        userId,
        date: targetDate,
      },
    });

    // Map them together
    const agenda: any[] = [];

    // Add regular slots, replacing them if they have an override (rescheduled/holiday)
    for (const slot of regularSlots) {
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
      agenda.push({
        id: extra.id,
        type: "override",
        isExtra: true,
        subject: extra.subject,
        startTime: extra.startTime || "00:00",
        endTime: extra.endTime || "00:00",
        room: null,
        slotType: "Extra",
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
      // Fetch subjects for these manual attendances
      const manualSubjectIds = manualAtts.map(a => a.subjectId);
      const manualSubjects = await prisma.subject.findMany({
        where: { id: { in: Array.from(new Set(manualSubjectIds)) } },
      });
      
      for (const att of manualAtts) {
        const sub = manualSubjects.find(s => s.id === att.subjectId);
        agenda.push({
          id: att.id,
          type: "manual",
          isExtra: true,
          subject: sub || { id: att.subjectId, name: "Unknown" },
          startTime: "00:00",
          endTime: "00:00",
          room: null,
          slotType: "Extra",
          status: att.status,
          remarks: att.remarks || "Extra class from merge",
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
    const targetDate = new Date(data.date);
    
    // Check if record exists
    let existing = null;
    if (data.attendanceId) {
      existing = await prisma.attendance.findUnique({ where: { id: data.attendanceId } });
    }
    if (!existing) {
      existing = await prisma.attendance.findFirst({
        where: {
          userId,
          subjectId: data.subjectId,
          date: targetDate,
          ...(data.timetableSlotId ? { timetableSlotId: data.timetableSlotId } : {}),
          ...(data.overrideId ? { overrideId: data.overrideId } : {}),
        },
      });
    }

    if (data.status === "not_marked" || data.status === "clear") {
      if (data.attendanceId) {
        const deleteResult = await prisma.attendance.deleteMany({
          where: { id: data.attendanceId }
        });
        return { message: "Attendance cleared", count: deleteResult.count, status: "not_marked" };
      }

      const deleteResult = await prisma.attendance.deleteMany({
        where: {
          userId,
          subjectId: data.subjectId,
          date: targetDate,
          ...(data.timetableSlotId ? { timetableSlotId: data.timetableSlotId } : {}),
          ...(data.overrideId ? { overrideId: data.overrideId } : {}),
        }
      });
      return { message: "Attendance cleared", count: deleteResult.count, status: "not_marked" };
    }

    if (existing) {
      return prisma.attendance.update({
        where: { id: existing.id },
        data: {
          status: data.status,
          ...(data.remarks !== undefined ? { remarks: data.remarks } : {}),
        },
      });
    }

    return prisma.attendance.create({
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
  }

  static async getAttendanceLogs(userId: string, options: { subjectId?: string; semesterId?: string }) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const globalTarget = user?.targetAttendance || 75;

    const activeSemester = await prisma.semester.findFirst({
      where: {
        userId,
        ...(options.semesterId ? { id: options.semesterId } : { isActive: true }),
      },
    });

    if (!activeSemester) {
      return { logs: [], subjects: [] };
    }

    // Get subjects
    const subjects = await prisma.subject.findMany({
      where: {
        userId,
        semesterId: activeSemester.id,
        ...(options.subjectId && options.subjectId !== "all" && options.subjectId !== "overall" ? { id: options.subjectId } : {}),
      },
      include: {
        attendance: true,
        timetableSlots: true,
      },
    });

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

    const subjectIds = subjects.map(s => s.id);
    const overrides = await prisma.timetableOverride.findMany({
      where: {
        semesterId: activeSemester.id,
        ...(options.subjectId && options.subjectId !== "all" && options.subjectId !== "overall" ? { subjectId: options.subjectId } : { subjectId: { in: subjectIds } }),
      },
      include: { subject: true },
    });

    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        userId,
        ...(options.subjectId && options.subjectId !== "all" && options.subjectId !== "overall" ? { subjectId: options.subjectId } : { subjectId: { in: subjectIds } }),
      },
      include: { subject: true },
    });

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const semStart = new Date(activeSemester.startDate);
    semStart.setHours(0, 0, 0, 0);
    const semEnd = new Date(activeSemester.endDate);
    semEnd.setHours(23, 59, 59, 999);

    const logs: any[] = [];

    // 1. Process all Attendance records (marked classes)
    for (const att of attendanceRecords) {
      const sub = subjects.find(s => s.id === att.subjectId);
      if (!sub) continue;
      
      const stats = subjectStatsMap[sub.id];
      const d = new Date(att.date);
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const dateFormatted = d.toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      let slotType = "Lecture";
      let startTime = "00:00";
      let endTime = "00:00";
      
      if (att.timetableSlotId) {
        const slot = sub.timetableSlots.find(s => s.id === att.timetableSlotId);
        if (slot) {
          slotType = slot.slotType ? slot.slotType.charAt(0).toUpperCase() + slot.slotType.slice(1) : "Lecture";
          startTime = slot.startTime;
          endTime = slot.endTime;
        }
      }
      
      if (att.overrideId) {
        const override = overrides.find(o => o.id === att.overrideId);
        if (override) {
          slotType = override.overrideType === "extra_class" ? "Extra" : slotType;
          startTime = override.startTime || startTime;
          endTime = override.endTime || endTime;
        }
      }

      logs.push({
        id: att.id,
        date: dateKey,
        dateFormatted,
        timestamp: d.getTime(),
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
        isExtra: slotType === "Extra",
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
      const d = new Date(extra.date);
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const dateFormatted = d.toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      logs.push({
        id: `extra-${extra.id}-${dateKey}`,
        date: dateKey,
        dateFormatted,
        timestamp: d.getTime(),
        subjectId: sub.id,
        subjectName: sub.name,
        subjectCode: sub.code,
        subjectColor: sub.colorHex || "#8b5cf6",
        target: stats.target,
        currentPercentage: stats.percentage,
        canMiss: stats.canMiss,
        needAttend: stats.needAttend,
        statusText: stats.statusText,
        slotType: "Extra",
        isExtra: true,
        startTime: extra.startTime || "00:00",
        endTime: extra.endTime || "00:00",
        status: "not_marked",
        remarks: null,
        timetableSlotId: undefined,
        overrideId: extra.id,
        attendanceId: undefined,
      });
    }

    // Sort descending by timestamp (newest first)
    logs.sort((a, b) => b.timestamp - a.timestamp || b.startTime.localeCompare(a.startTime));

    return {
      logs,
      subjects: Object.values(subjectStatsMap),
    };
  }

  static async _calculateRemainingClasses(subject: any, events: any[], overrides: any[], today: Date) {
    if (!subject.semester) {
      return { remainingClasses: 0, maxRemainingClasses: 0, missingBoundaries: false };
    }

    let actualStartDate = subject.semester.startDate;
    const commencement = events.find(e => e.title && e.title.toLowerCase().includes("commencement of classes"));
    if (commencement && commencement.date) actualStartDate = new Date(commencement.date);

    let actualEndDate = subject.semester.endDate;
    const lastDay = events.find(e => e.title && (e.title.toLowerCase().includes("last teaching day") || e.title.toLowerCase().includes("last working day")));
    if (lastDay && lastDay.date) actualEndDate = new Date(lastDay.date);

    const missingBoundaries = !commencement || !lastDay;

    if (actualEndDate < today) {
      return { remainingClasses: 0, maxRemainingClasses: 0, missingBoundaries };
    }

    const startProjection = today > actualStartDate ? today : actualStartDate;
    const tomorrow = new Date(startProjection);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let remainingClasses = 0;
    let maxRemainingClasses = 0;
    const futureBreakdown: any[] = [];
    
    if (tomorrow <= actualEndDate) {
      for (let d = new Date(tomorrow); d <= actualEndDate; d.setDate(d.getDate() + 1)) {
        const dYear = d.getFullYear();
        const dMonth = d.getMonth();
        const dDate = d.getDate();
        
        const dateOverrides = overrides.filter(o => 
          o.subjectId === subject.id && 
          o.date.getFullYear() === dYear &&
          o.date.getMonth() === dMonth &&
          o.date.getDate() === dDate
        );
        
        let daySlotsCount = 0;
        let isHoliday = false;
        let isRestrictedHoliday = false;
        let holidayReason = "Holiday";

        const dUTC = Date.UTC(dYear, dMonth, dDate);

        const dateEvents = events.filter(e => {
          const evStart = Date.UTC(e.date.getFullYear(), e.date.getMonth(), e.date.getDate());
          const evEnd = e.endDate ? Date.UTC(e.endDate.getFullYear(), e.endDate.getMonth(), e.endDate.getDate()) : evStart;
          return dUTC >= evStart && dUTC <= evEnd;
        });

        for (const ev of dateEvents) {
           if ((ev.isHolidayList && ev.eventType !== "restricted_holiday") || ["holiday", "vacation", "midsem", "endsem"].includes(ev.eventType)) {
             isHoliday = true;
             holidayReason = ev.title || "Holiday";
           }
           if (ev.eventType === "restricted_holiday") {
             isRestrictedHoliday = true;
             if (!isHoliday) holidayReason = ev.title || "Restricted Holiday";
           }
        }

        let dbDayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1;
        const slotsOnDay = (subject.timetableSlots || []).filter((s: any) => s.dayOfWeek === dbDayOfWeek).length;
        const extraClasses = dateOverrides.filter(o => o.overrideType === 'extra_class').length;
        const cancelledClasses = dateOverrides.filter(o => o.overrideType === 'cancelled' || o.overrideType === 'holiday').length;
        
        let markedLogs: any[] = [];
        if (subject.attendance) {
          markedLogs = subject.attendance.filter((a: any) => 
            new Date(a.date).getFullYear() === dYear &&
            new Date(a.date).getMonth() === dMonth &&
            new Date(a.date).getDate() === dDate
          );
        }
        const markedClasses = markedLogs.length;

        const baseSlots = slotsOnDay + extraClasses;

        if (baseSlots > 0 || markedClasses > 0) {
             // 1. Push any explicitly marked logs
             if (markedClasses > 0) {
               markedLogs.forEach((log: any) => {
                 futureBreakdown.push({
                   date: new Date(d).toISOString(),
                   type: 'LOGGED',
                   reason: `Already Logged (${log.status})`,
                   count: 1,
                   status: log.status
                 });
               });
             }

             // 2. Calculate remaining slots
             let daySlotsCount = baseSlots - cancelledClasses - markedClasses;
             daySlotsCount = Math.max(0, daySlotsCount);

             // 3. Push cancelled classes
             if (cancelledClasses > 0) {
               futureBreakdown.push({
                 date: new Date(d).toISOString(),
                 type: 'OFF',
                 reason: "Cancelled/Off Class",
                 count: cancelledClasses
               });
             }

             // 4. Handle remaining slots based on holiday or regular
             if (daySlotsCount > 0) {
               if (isHoliday) {
                 futureBreakdown.push({
                   date: new Date(d).toISOString(),
                   type: 'OFF',
                   reason: holidayReason,
                   count: daySlotsCount
                 });
               } else if (isRestrictedHoliday) {
                 futureBreakdown.push({
                   date: new Date(d).toISOString(),
                   type: 'OFF',
                   reason: holidayReason,
                   count: daySlotsCount
                 });
                 maxRemainingClasses += daySlotsCount;
               } else {
                 futureBreakdown.push({
                   date: new Date(d).toISOString(),
                   type: 'HELD',
                   count: daySlotsCount
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
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const globalTarget = user?.targetAttendance || 75;

    let targetSemesterId = semesterId;
    let activeSemester = null;

    if (targetSemesterId) {
      activeSemester = await prisma.semester.findUnique({ where: { id: targetSemesterId } });
    } else {
      activeSemester = await prisma.semester.findFirst({ where: { userId, isActive: true } });
      if (activeSemester) targetSemesterId = activeSemester.id;
    }

    const subjects = await prisma.subject.findMany({
      where: {
        userId,
        ...(targetSemesterId ? { semesterId: targetSemesterId } : {}),
      },
      include: {
        attendance: true,
        semester: true,
        timetableSlots: true,
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let allEvents: any[] = [];
    let allOverrides: any[] = [];
    if (activeSemester) {
       allEvents = await prisma.event.findMany({
         where: { 
           OR: [
             { semesterId: activeSemester.id },
             { semesterId: null }
           ]
         }
       });
       allOverrides = await prisma.timetableOverride.findMany({
         where: { semesterId: activeSemester.id }
       });
    }

    const promises = subjects.map(async sub => {
      const allRecords = sub.attendance;
      const countableRecords = allRecords.filter(a => a.status === "present" || a.status === "absent" || a.status === "medical" || a.status === "od");
      const attended = countableRecords.filter(a => a.status === "present" || a.status === "medical" || a.status === "od").length;
      const missed = countableRecords.filter(a => a.status === "absent").length;
      const off = allRecords.filter(a => a.status === "off").length;
      const total = attended + missed;
      const percentage = total > 0 ? (attended / total) * 100 : 0;
      
      const remainingData = await AttendanceService._calculateRemainingClasses(sub, allEvents, allOverrides, today);
      const remainingClasses = remainingData.remainingClasses || 0;
      const expectedTotal = total + remainingClasses;
      
      let canMiss = 0;
      let needAttend = 0;

      if (expectedTotal > 0) {
        canMiss = Math.floor(attended - (globalTarget / 100) * total);
        if (canMiss < 0) {
          needAttend = Math.ceil(((globalTarget / 100) * total - attended) / (1 - (globalTarget / 100)));
        }
      }

      return {
        id: sub.id,
        name: sub.name,
        code: sub.code,
        colorHex: sub.colorHex,
        target: sub.targetAttendance,
        attended,
        missed,
        off,
        total,
        percentage,
        canMiss: canMiss > 0 ? canMiss : 0,
        needAttend: needAttend > 0 ? needAttend : 0,
        attendance: sub.attendance,
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
        startDate: actualStartDate.toISOString(),
        endDate: actualEndDate.toISOString(),
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
    let totalClasses = 0;
    subject.attendance.forEach((log) => {
      if (log.status === "present") attendedClasses++;
      if (log.status === "present" || log.status === "absent") totalClasses++;
    });

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

    const activeSemester = await prisma.semester.findFirst({
      where: { userId, isActive: true },
    });

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

    const regularSlots = await prisma.timetableSlot.findMany({
      where: { semesterId: activeSemester.id },
    });

    const overrides = await prisma.timetableOverride.findMany({
      where: {
        semesterId: activeSemester.id,
        date: { gte: startDate, lte: endDate },
      },
    });

    const attendances = await prisma.attendance.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
        subject: { semesterId: activeSemester.id }
      },
      include: {
        subject: true,
      },
    });

    const globalEvents = await prisma.event.findMany({
      where: {
        userId,
        OR: [
          { semesterId: activeSemester.id },
          { semesterId: null }
        ],
        date: { lte: endDate }
      }
    });

    const totalEventsCount = await prisma.event.count({
      where: {
        userId,
        semesterId: activeSemester.id
      }
    });

    const daysObj: Record<string, string> = {};
    const detailsObj: Record<string, Array<{ id: string; subjectName: string; status: string; remarks: string | null }>> = {};
    const eventsObj: Record<string, Array<{ id: string; title: string; eventType: string }>> = {};
    const dayStats = { not_marked: 0, off: 0, missed: 0, attended: 0, mixed: 0 };
    const lectureStats = { off: 0, missed: 0, attended: 0, total: 0, percentage: 0 };

    const numDays = new Date(year, m, 0).getDate();
    for (let day = 1; day <= numDays; day++) {
      const d = new Date(year, m - 1, day);
      const dateKey = AttendanceService.toLocalIso(d);
      const jsDayOfWeek = d.getDay();
      const dbDayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1; // 0=Mon, 6=Sun

      const dUTC = Date.UTC(year, m - 1, day);

      const dayEvents = globalEvents.filter(e => {
        const start = Date.UTC(e.date.getFullYear(), e.date.getMonth(), e.date.getDate());
        const end = e.endDate ? Date.UTC(e.endDate.getFullYear(), e.endDate.getMonth(), e.endDate.getDate()) : start;
        return dUTC >= start && dUTC <= end;
      });

      // ONLY actual holidays or vacations count as global off
      const isGlobalOff = dayEvents.some(e => ["holiday", "vacation"].includes(e.eventType));

      if (dayEvents.length > 0) {
        eventsObj[dateKey] = dayEvents.map(e => ({
          id: e.id,
          title: e.title,
          eventType: e.eventType,
          isHolidayList: e.isHolidayList,
        }));
      }
      
      const daySlots = regularSlots.filter(s => s.dayOfWeek === dbDayOfWeek);
      const dayOverrides = overrides.filter(o => AttendanceService.toLocalIso(o.date) === dateKey);
      
      let expectedClasses = 0;
      const expectedSubjectIds = new Set<string>();

      for (const slot of daySlots) {
        const over = dayOverrides.find(o => o.originalSlotId === slot.id);
        if (over && (over.overrideType === "holiday" || over.overrideType === "cancelled")) {
          // skip
        } else {
          if (!isGlobalOff) {
            expectedClasses++;
            expectedSubjectIds.add(slot.subjectId);
          }
        }
      }
      
      const extras = dayOverrides.filter(o => {
        const oDateStr = AttendanceService.toLocalIso(o.date);
        return o.overrideType === "extra_class" && oDateStr === dateKey;
      });
      for (const o of extras) {
        if (o.subjectId) {
          expectedClasses++;
          expectedSubjectIds.add(o.subjectId);
        }
      }

      // Filter attendance records for this day
      const dayAtts = attendances.filter(a => AttendanceService.toLocalIso(a.date) === dateKey);

      // Add manual attendances (that don't match any expected slot/override) to expectedClasses
      for (const a of dayAtts) {
        if (!expectedSubjectIds.has(a.subjectId)) {
          expectedClasses++;
        }
      }

      if (dateKey === "2026-08-18") {
        console.log("DEBUG 2026-08-18:");
        console.log("expectedClasses:", expectedClasses);
        console.log("dayAtts:", dayAtts.map(a => a.date));
      }

      let status = "off";

      if (expectedClasses === 0) {
        status = "off";
        // Note: we still check unmapped attendances if someone manually marks an off day 
        const allDayAtts = attendances.filter(a => AttendanceService.toLocalIso(a.date) === dateKey);
        if (allDayAtts.length > 0) {
          let presentCount = 0;
          let absentCount = 0;
          for (const a of allDayAtts) {
            if (a.status === "present" || a.status === "medical" || a.status === "od") presentCount++;
            else if (a.status === "absent") absentCount++;
          }
          if (presentCount > 0 && absentCount === 0) status = "attended";
          else if (absentCount > 0 && presentCount === 0) status = "missed";
          else if (presentCount > 0 && absentCount > 0) status = "mixed";
        }
      } else if (dayAtts.length < expectedClasses) {
        status = "not_marked";
      } else {
        let presentCount = 0;
        let absentCount = 0;
        let offCount = 0;

        for (const a of dayAtts) {
          if (a.status === "present" || a.status === "medical" || a.status === "od") presentCount++;
          else if (a.status === "absent") absentCount++;
          else if (a.status === "off" || a.status === "cancelled") offCount++;
        }

        if (presentCount > 0 && absentCount === 0) status = "attended";
        else if (absentCount > 0 && presentCount === 0) status = "missed";
        else if (presentCount > 0 && absentCount > 0) status = "mixed";
        else status = "off";
      }

      // Get today's date string in the server's local timezone (or matching the client's)
      // A safe way is to compare dateKey with today's date formatted as YYYY-MM-DD
      const now = new Date();
      // Use IST offset (+5:30) or local offset
      const tzOffset = now.getTimezoneOffset() * 60000; 
      const localTodayStr = new Date(now.getTime() - tzOffset).toISOString().split("T")[0];
      
      if (dateKey > localTodayStr) {
        if (status === "not_marked") status = "future";
      }

      daysObj[dateKey] = status;
      if (dayAtts.length > 0) {
        detailsObj[dateKey] = dayAtts.map(a => ({
          id: a.id,
          subjectName: a.subject?.name || "Subject",
          status: a.status,
          remarks: a.remarks || null,
        }));
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
