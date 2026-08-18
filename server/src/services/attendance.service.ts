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

    if (data.status === "not_marked" || data.status === "clear") {
      if (existing) {
        await prisma.attendance.delete({ where: { id: existing.id } });
        return { message: "Attendance cleared", id: existing.id, status: "not_marked" };
      }
      return { message: "No attendance to clear", status: "not_marked" };
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

    const logs: any[] = [];

    // Loop dates from today down to semStart (newest first)
    const pad = (n: number) => String(n).padStart(2, '0');
    for (let d = new Date(today); d >= semStart; d.setDate(d.getDate() - 1)) {
      const dateKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1;

      const dateFormatted = d.toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      for (const sub of subjects) {
        const stats = subjectStatsMap[sub.id];

        const regularSlots = sub.timetableSlots.filter(s => s.dayOfWeek === dayOfWeek);
        const dateOverrides = overrides.filter(
          o => o.subjectId === sub.id && new Date(o.date).toISOString().split("T")[0] === dateKey
        );
        const dateAttendance = attendanceRecords.filter(
          a => a.subjectId === sub.id && new Date(a.date).toISOString().split("T")[0] === dateKey
        );

        for (const slot of regularSlots) {
          const override = dateOverrides.find(o => o.originalSlotId === slot.id);
          if (override && (override.overrideType === "holiday" || override.overrideType === "cancelled")) {
            continue;
          }

          const att = dateAttendance.find(a => a.timetableSlotId === slot.id || (override && a.overrideId === override.id));
          
          logs.push({
            id: att?.id || `slot-${slot.id}-${dateKey}`,
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
            slotType: slot.slotType ? slot.slotType.charAt(0).toUpperCase() + slot.slotType.slice(1) : "Lecture",
            startTime: slot.startTime,
            endTime: slot.endTime,
            status: att?.status || "not_marked",
            remarks: att?.remarks || null,
            timetableSlotId: slot.id,
            overrideId: override?.id || undefined,
            attendanceId: att?.id || undefined,
          });
        }

        const extraOverrides = dateOverrides.filter(o => o.overrideType === "extra_class");
        for (const extra of extraOverrides) {
          const att = dateAttendance.find(a => a.overrideId === extra.id);
          logs.push({
            id: att?.id || `extra-${extra.id}-${dateKey}`,
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
            status: att?.status || "not_marked",
            remarks: att?.remarks || null,
            timetableSlotId: undefined,
            overrideId: extra.id,
            attendanceId: att?.id || undefined,
          });
        }

        const matchedAttIds = logs.filter(l => l.attendanceId).map(l => l.attendanceId);
        const unmatchedAtts = dateAttendance.filter(a => !matchedAttIds.includes(a.id));
        for (const att of unmatchedAtts) {
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
            slotType: "Lecture",
            startTime: "00:00",
            endTime: "00:00",
            status: att.status,
            remarks: att.remarks || null,
            attendanceId: att.id,
          });
        }
      }
    }

    return {
      logs,
      subjects: Object.values(subjectStatsMap),
    };
  }

  static async getSubjectStats(userId: string, semesterId?: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const globalTarget = user?.targetAttendance || 75;

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
      const target = sub.targetAttendance !== null ? sub.targetAttendance : globalTarget;

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
      target: subject.targetAttendance !== null ? subject.targetAttendance : globalTarget,
      attended,
      total,
      percentage,
      remainingClasses
    };
  }

  static async getMonthlyCalendar(userId: string, monthStr: string) {
    const [year, m] = monthStr.split("-").map(Number);
    const startDate = new Date(Date.UTC(year, m - 1, 1));
    const endDate = new Date(Date.UTC(year, m, 0, 23, 59, 59, 999)); 

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

    const daysObj: Record<string, string> = {};
    const detailsObj: Record<string, Array<{ id: string; subjectName: string; status: string; remarks: string | null }>> = {};
    const eventsObj: Record<string, Array<{ id: string; title: string; eventType: string }>> = {};
    const dayStats = { not_marked: 0, off: 0, missed: 0, attended: 0, mixed: 0 };
    const lectureStats = { off: 0, missed: 0, attended: 0, total: 0, percentage: 0 };

    for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
      const dateKey = d.toISOString().split("T")[0]; // YYYY-MM-DD
      const jsDayOfWeek = d.getUTCDay();
      const dbDayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1; // 0=Mon, 6=Sun

      const dayEvents = globalEvents.filter(e => {
        const start = new Date(e.date).setUTCHours(0,0,0,0);
        const end = e.endDate ? new Date(e.endDate).setUTCHours(23,59,59,999) : new Date(e.date).setUTCHours(23,59,59,999);
        return d.getTime() >= start && d.getTime() <= end;
      });

      // ONLY actual holidays or vacations count as global off
      const isGlobalOff = dayEvents.some(e => ["holiday", "vacation"].includes(e.eventType));

      if (dayEvents.length > 0) {
        eventsObj[dateKey] = dayEvents.map(e => ({
          id: e.id,
          title: e.title,
          eventType: e.eventType,
        }));
      }
      
      const daySlots = regularSlots.filter(s => s.dayOfWeek === dbDayOfWeek);
      const dayOverrides = overrides.filter(o => o.date.toISOString().split("T")[0] === dateKey);
      
      let expectedClasses = 0;

      for (const slot of daySlots) {
        const over = dayOverrides.find(o => o.originalSlotId === slot.id);
        if (over && (over.overrideType === "holiday" || over.overrideType === "cancelled")) {
          // skip
        } else {
          if (!isGlobalOff) expectedClasses++;
        }
      }
      
      const extras = dayOverrides.filter(o => {
        const oDateStr = new Date(o.date).toISOString().split("T")[0];
        return o.overrideType === "extra_class" && oDateStr === dateKey;
      });
      expectedClasses += extras.length;

      const dayAtts = attendances.filter(a => {
        const aDateStr = new Date(a.date).toISOString().split("T")[0];
        return aDateStr === dateKey;
      });

      if (dateKey === "2026-08-18") {
        console.log("DEBUG 2026-08-18:");
        console.log("expectedClasses:", expectedClasses);
        console.log("dayAtts:", dayAtts.map(a => a.date));
        console.log("all attendances:", attendances.map(a => a.date));
      }

      let status = "off";

      if (expectedClasses === 0) {
        status = "off";
        // If there are attendances on an off day (e.g., extra class without override, or just manually marked)
        if (dayAtts.length > 0) {
          let presentCount = 0;
          let absentCount = 0;
          for (const a of dayAtts) {
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
      days: daysObj,
      details: detailsObj,
      events: eventsObj,
      stats: {
        days: dayStats,
        lectures: lectureStats
      }
    };
  }
}
