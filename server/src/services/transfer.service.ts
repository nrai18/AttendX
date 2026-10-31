import { prisma } from "../lib/prisma";
import { normalizeTimeString } from "../utils/timeUtils";

export class TransferService {
  static async buildPayload(userId: string, contextType: string, dateRange?: { startDate: string, endDate: string }) {
    const hasDateFilter = Boolean(
      (contextType === "FULL_EXPORT" || contextType === "SCHEDULE_STATUS") &&
      dateRange?.startDate &&
      dateRange?.endDate
    );
    const dateFilter = hasDateFilter
      ? { gte: new Date(dateRange!.startDate), lte: new Date(dateRange!.endDate) }
      : undefined;

    // Single parallel roundtrip for semester (+ subjects, slots, overrides), events, and attendance logs
    const [semesterData, allEvents, rawLogs] = await Promise.all([
      prisma.semester.findFirst({
        where: { userId, isActive: true },
        include: {
          subjects: true,
          timetableSlots: true,
          overrides:
            contextType === "TIMETABLE_CALENDAR"
              ? false
              : {
                  where: dateFilter ? { date: dateFilter } : undefined,
                },
        },
      }),
      prisma.event.findMany({
        where: {
          userId,
          ...(dateFilter ? { date: dateFilter } : {}),
        },
      }),
      contextType === "FULL_EXPORT" || contextType === "SCHEDULE_STATUS"
        ? prisma.attendance.findMany({
            where: {
              userId,
              ...(dateFilter ? { date: dateFilter } : {}),
            },
            select: {
              date: true,
              subjectId: true,
              timetableSlotId: true,
              overrideId: true,
              status: true,
              remarks: true,
            },
          })
        : Promise.resolve([]),
    ]);

    if (!semesterData) throw new Error("No active semester found");
    if (!semesterData.timetableSlots || semesterData.timetableSlots.length === 0) {
      throw new Error("Cannot generate transfer code: Your active semester has no timetable data.");
    }

    const subjectMapById = new Map(semesterData.subjects.map((s) => [s.id, s]));
    const events = allEvents.filter((e) => !e.semesterId || e.semesterId === semesterData.id);
    const logs = rawLogs.filter((l) => subjectMapById.has(l.subjectId));
    const overrides = Array.isArray((semesterData as any).overrides) ? (semesterData as any).overrides : [];

    const payload: any = {
      semester: {
        name: semesterData.name,
        startDate: semesterData.startDate,
        endDate: semesterData.endDate,
      },
      subjects: semesterData.subjects.map((s) => ({
        code: s.code,
        name: s.name,
        credits: s.credits,
        faculty: s.faculty,
        colorHex: s.colorHex,
        targetAttendance: s.targetAttendance,
      })),
      slots: semesterData.timetableSlots.map((slot) => {
        const sub = subjectMapById.get(slot.subjectId);
        return {
          originalId: slot.id,
          subjectCode: sub?.code || "",
          subjectName: sub?.name || "Subject",
          dayOfWeek: slot.dayOfWeek,
          startTime: normalizeTimeString(slot.startTime, "09:00"),
          endTime: normalizeTimeString(slot.endTime, "10:00"),
          room: slot.room,
          slotType: slot.slotType,
          validFrom: slot.validFrom,
          validUntil: slot.validUntil,
        };
      }),
      overrides: contextType === "TIMETABLE_CALENDAR" ? [] : overrides.map((ov: any) => {
        const sub = ov.subjectId ? subjectMapById.get(ov.subjectId) : undefined;
        return {
          originalOverrideId: ov.id,
          date: ov.date.toISOString().split("T")[0],
          overrideType: ov.overrideType,
          originalSlotId: ov.originalSlotId ?? null,
          subjectCode: sub?.code ?? null,
          subjectName: sub?.name ?? null,
          startTime: ov.startTime ?? null,
          endTime: ov.endTime ?? null,
          reason: ov.reason ?? null,
        };
      }),
      academicCalendar: [],
      lectureLogs: [],
      metadata: {
        startDate: dateRange?.startDate || null,
        endDate: dateRange?.endDate || null,
      },
    };

    if (contextType === "FULL_EXPORT") {
      payload.academicCalendar = events;
      payload.lectureLogs = logs.map((log: any) => {
        const sub = subjectMapById.get(log.subjectId);
        const entry: any = {
          date: log.date.toISOString().split("T")[0],
          status: log.status,
        };
        if (sub?.code) entry.subjectCode = sub.code;
        else if (sub?.name) entry.subjectName = sub.name;
        if (log.timetableSlotId) entry.slot = log.timetableSlotId;
        if (log.overrideId) entry.overrideId = log.overrideId;
        if (log.remarks) entry.remarks = log.remarks;
        return entry;
      });
    } else if (contextType === "TIMETABLE_CALENDAR") {
      payload.academicCalendar = events.map((e: any) => ({
        title: e.title,
        eventType: e.eventType,
        date: e.date,
        endDate: e.endDate ?? null,
        isHolidayList: e.isHolidayList,
      }));
    } else if (contextType === "SCHEDULE_STATUS") {
      payload.academicCalendar = events.map((e: any) => ({
        title: e.title,
        eventType: e.eventType,
        date: e.date,
        endDate: e.endDate ?? null,
        isHolidayList: e.isHolidayList,
      }));

      payload.lectureLogs = logs.map((log: any) => {
        let status = log.status;
        let isConducted = false;

        if (status === "present" || status === "absent" || status === "medical" || status === "od") {
          status = "HELD";
          isConducted = true;
        } else if (status === "off" || status === "cancelled") {
          status = "CANCELLED";
          isConducted = false;
        }

        const sub = subjectMapById.get(log.subjectId);
        const entry: any = {
          date: log.date.toISOString().split("T")[0],
          status,
          isConducted,
        };
        if (sub?.code) entry.subjectCode = sub.code;
        else if (sub?.name) entry.subjectName = sub.name;
        if (log.timetableSlotId) entry.slot = log.timetableSlotId;
        if (log.overrideId) entry.overrideId = log.overrideId;
        return entry;
      });
    }

    return payload;
  }
}
