import { prisma } from "../lib/prisma";

export class SemesterService {
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

    return prisma.semester.create({
      data: {
        userId,
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isActive: data.isActive ?? true,
      },
    });
  }

  static async getActiveSemester(userId: string) {
    return prisma.semester.findFirst({
      where: { userId, isActive: true },
      include: { subjects: true },
    });
  }

  static async deleteSemester(userId: string, semesterId: string, wipeAttendance = false) {
    if (wipeAttendance) {
      // Wipes all associated attendance
      return prisma.semester.delete({
        where: { id: semesterId, userId },
      });
    } else {
      // Soft-delete or detach slots while retaining historical attendance
      await prisma.timetableSlot.deleteMany({
        where: { semesterId },
      });
      return prisma.semester.update({
        where: { id: semesterId, userId },
        data: { isActive: false },
      });
    }
  }
}
