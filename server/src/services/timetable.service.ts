import { prisma } from "../lib/prisma";

export class TimetableService {
  static async getTimetable(semesterId: string) {
    return prisma.timetableSlot.findMany({
      where: { semesterId },
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
  }

  static async createSlot(data: any) {
    return prisma.timetableSlot.create({
      data: {
        semesterId: data.semesterId,
        subjectId: data.subjectId,
        dayOfWeek: Number(data.dayOfWeek),
        startTime: data.startTime,
        endTime: data.endTime,
        room: data.room,
        slotType: data.slotType || "lecture",
      },
      include: { subject: true },
    });
  }

  static async deleteSlot(slotId: string, preserveHistory = true) {
    if (preserveHistory) {
      // Retain past attendance logs by unlinking slot ID
      await prisma.attendance.updateMany({
        where: { timetableSlotId: slotId },
        data: { timetableSlotId: null },
      });
    }
    return prisma.timetableSlot.delete({
      where: { id: slotId },
    });
  }

  static async addExtraClass(data: {
    semesterId: string;
    subjectId: string;
    date: string;
    startTime?: string;
    endTime?: string;
    reason?: string;
  }) {
    return prisma.timetableOverride.create({
      data: {
        semesterId: data.semesterId,
        subjectId: data.subjectId,
        date: new Date(data.date),
        overrideType: "extra_class",
        startTime: data.startTime || "17:30",
        endTime: data.endTime || "18:20",
        reason: data.reason || "Ad-hoc extra class",
      },
      include: { subject: true },
    });
  }
}
