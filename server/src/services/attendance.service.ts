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
      const records = sub.attendance.filter(a => a.status === "present" || a.status === "absent" || a.status === "medical" || a.status === "od");
      const attended = records.filter(a => a.status === "present" || a.status === "medical" || a.status === "od").length;
      const total = records.length;
      
      let percentage = total > 0 ? (attended / total) * 100 : 100;
      
      return {
        id: sub.id,
        name: sub.name,
        code: sub.code,
        colorHex: sub.colorHex,
        target: sub.targetAttendance || 75,
        attended,
        total,
        percentage,
      };
    });
  }
}
