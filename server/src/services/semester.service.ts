import { prisma } from "../lib/prisma";
import { CacheService } from "./cache.service";

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
      // Wipes all associated attendance
      const deletedSemester = await prisma.semester.delete({
        where: { id: semester.id },
      });
      await CacheService.invalidateUser(userId);
      return deletedSemester;
    } else {
      // Soft-delete or detach slots while retaining historical attendance
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
}
