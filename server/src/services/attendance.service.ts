import { prisma } from "../lib/prisma";

export class AttendanceService {
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
        subject: extra.subject,
        startTime: extra.startTime || "00:00",
        endTime: extra.endTime || "00:00",
        room: null,
        slotType: "lecture",
        status: existingAtt?.status || null,
        attendanceId: existingAtt?.id || null,
      });
    }

    // Sort by startTime
    return agenda.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  static async markAttendance(userId: string, data: {
    subjectId: string;
    date: string;
    status: any;
    timetableSlotId?: string;
    overrideId?: string;
  }) {
    const targetDate = new Date(data.date);
    
    // Check if record exists
    const existing = await prisma.attendance.findFirst({
      where: {
        userId,
        subjectId: data.subjectId,
        date: targetDate,
        ...(data.timetableSlotId ? { timetableSlotId: data.timetableSlotId } : {}),
        ...(data.overrideId ? { overrideId: data.overrideId } : {}),
      },
    });

    if (existing) {
      return prisma.attendance.update({
        where: { id: existing.id },
        data: { status: data.status },
      });
    }

    return prisma.attendance.create({
      data: {
        userId,
        subjectId: data.subjectId,
        date: targetDate,
        status: data.status,
        timetableSlotId: data.timetableSlotId,
        overrideId: data.overrideId,
      },
    });
  }

  static async getSubjectStats(userId: string, semesterId?: string) {
    const subjects = await prisma.subject.findMany({
      where: {
        userId,
        ...(semesterId ? { semesterId } : {}),
      },
      include: {
        attendance: true,
      },
    });

    return subjects.map(sub => {
      const allRecords = sub.attendance;
      const countableRecords = allRecords.filter(a => a.status === "present" || a.status === "absent" || a.status === "medical" || a.status === "od");
      const attended = countableRecords.filter(a => a.status === "present" || a.status === "medical" || a.status === "od").length;
      const missed = countableRecords.filter(a => a.status === "absent").length;
      const off = allRecords.filter(a => a.status === "off" || a.status === "cancelled").length;
      const total = countableRecords.length;

      let percentage = total > 0 ? (attended / total) * 100 : 0;
      const target = sub.targetAttendance || 75;

      // How many classes can still be missed while staying above target
      // attended / (total + x) >= target/100  => x = (attended - target*total/100) / (target/100)
      const canMiss = total > 0 ? Math.floor((attended - (target / 100) * total) / (target / 100)) : 0;
      // How many classes need to be attended to reach target
      // (attended + x) / (total + x) >= target/100 => x = (target*total - 100*attended) / (100 - target)
      const needAttend = percentage < target && target < 100
        ? Math.ceil(((target / 100) * total - attended) / (1 - target / 100))
        : 0;

      return {
        id: sub.id,
        name: sub.name,
        code: sub.code,
        colorHex: sub.colorHex,
        target,
        attended,
        missed,
        off,
        total,
        percentage,
        canMiss: canMiss > 0 ? canMiss : 0,
        needAttend: needAttend > 0 ? needAttend : 0,
      };
    });
  }

  static async getSingleSubjectStats(userId: string, subjectId: string) {
    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, userId },
      include: {
        semester: true,
        timetableSlots: true,
        attendance: true,
      }
    });

    if (!subject) throw new Error("Subject not found");

    const records = subject.attendance.filter(a => a.status === "present" || a.status === "absent" || a.status === "medical" || a.status === "od");
    const attended = records.filter(a => a.status === "present" || a.status === "medical" || a.status === "od").length;
    const total = records.length;
    let percentage = total > 0 ? (attended / total) * 100 : 0;

    // Calculate remaining classes in the semester
    let remainingClasses = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Only calculate if semester is active/future
    if (subject.semester && subject.semester.endDate >= today) {
      const startProjection = today > subject.semester.startDate ? today : subject.semester.startDate;
      const endDate = subject.semester.endDate;
      
      const slots = subject.timetableSlots;
      
      // Basic projection: count occurrences of each dayOfWeek from tomorrow to endDate
      // To avoid double counting today, we project from tomorrow.
      const tomorrow = new Date(startProjection);
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (tomorrow <= endDate) {
        for (let d = new Date(tomorrow); d <= endDate; d.setDate(d.getDate() + 1)) {
          // our DB uses 0=Mon, 6=Sun
          let dbDayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1;
          const slotsOnDay = slots.filter(s => s.dayOfWeek === dbDayOfWeek).length;
          remainingClasses += slotsOnDay;
        }
      }
    }

    return {
      id: subject.id,
      name: subject.name,
      code: subject.code,
      colorHex: subject.colorHex,
      target: subject.targetAttendance || 75,
      attended,
      total,
      percentage,
      remainingClasses
    };
  }

  static async getMonthlyCalendar(userId: string, monthStr: string) {
    const [year, m] = monthStr.split("-").map(Number);
    const startDate = new Date(year, m - 1, 1);
    const endDate = new Date(year, m, 0); 
    endDate.setHours(23, 59, 59, 999);

    const activeSemester = await prisma.semester.findFirst({
      where: { userId, isActive: true },
    });

    if (!activeSemester) {
      return { days: {}, stats: { days: {}, lectures: {} } };
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
      },
    });

    const globalEvents = await prisma.event.findMany({
      where: {
        OR: [
          { semesterId: activeSemester.id },
          { userId },
          { classroomId: null }
        ],
        date: { lte: endDate }
      }
    });

    const daysObj: Record<string, string> = {};
    const dayStats = { not_marked: 0, off: 0, missed: 0, attended: 0, mixed: 0 };
    const lectureStats = { off: 0, missed: 0, attended: 0, total: 0, percentage: 0 };

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split("T")[0]; // YYYY-MM-DD
      const jsDayOfWeek = d.getDay();
      const dbDayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1; // 0=Mon, 6=Sun

      const activeEvent = globalEvents.find(e => {
        const start = new Date(e.date).setHours(0,0,0,0);
        const end = e.endDate ? new Date(e.endDate).setHours(23,59,59,999) : new Date(e.date).setHours(23,59,59,999);
        return d.getTime() >= start && d.getTime() <= end;
      });
      const isGlobalOff = activeEvent && ["holiday", "vacation", "fest", "institute", "midsem", "endsem"].includes(activeEvent.eventType);
      
      const daySlots = regularSlots.filter(s => s.dayOfWeek === dbDayOfWeek);
      const dayOverrides = overrides.filter(o => o.date.getTime() === d.getTime());
      
      let expectedClasses = 0;

      for (const slot of daySlots) {
        const over = dayOverrides.find(o => o.originalSlotId === slot.id);
        if (over && (over.overrideType === "holiday" || over.overrideType === "cancelled")) {
          // skip
        } else {
          if (!isGlobalOff) expectedClasses++;
        }
      }
      
      const extras = dayOverrides.filter(o => o.overrideType === "extra_class");
      expectedClasses += extras.length;

      const dayAtts = attendances.filter(a => a.date.getTime() === d.getTime());

      let status = "off";

      if (expectedClasses === 0) {
        status = "off";
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

      const today = new Date();
      today.setHours(0,0,0,0);
      
      if (d > today) {
        if (status === "not_marked") status = "future";
      }

      daysObj[dateKey] = status;

      if (d <= today) {
        if (status === "not_marked") dayStats.not_marked++;
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
    }

    lectureStats.total = lectureStats.attended + lectureStats.missed;
    lectureStats.percentage = lectureStats.total > 0 ? (lectureStats.attended / lectureStats.total) * 100 : 0;

    return {
      days: daysObj,
      stats: {
        days: dayStats,
        lectures: lectureStats
      }
    };
  }
}
