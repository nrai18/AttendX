import { prisma } from "../lib/prisma";
import { TimetableService } from "./timetable.service";

export class UserService {
  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        rollNumber: true,
        avatarUrl: true,
        role: true,
        department: true,
        batch: true,
        targetAttendance: true,
        theme: true,
        createdAt: true,
      },
    });
    if (!user) throw new Error("User not found");
    return user;
  }

  static async updateProfile(userId: string, data: any) {
    if (data.targetAttendance !== undefined) {
      await prisma.subject.updateMany({
        where: { userId },
        data: { targetAttendance: null }
      });
    }

    return prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        rollNumber: true,
        avatarUrl: true,
        role: true,
        department: true,
        batch: true,
        targetAttendance: true,
        theme: true,
      },
    });
  }

  static async resetTimetable(userId: string) {
    const semesters = await prisma.semester.findMany({
      where: { userId },
      select: { id: true }
    });

    for (const sem of semesters) {
      await TimetableService.safeDeleteTimetable(userId, sem.id);
    }
    await TimetableService.safeDeleteTimetable(userId);

    return { success: true, message: "Timetable schedule cleared successfully." };
  }

  static async resetData(userId: string) {
    await prisma.attendance.deleteMany({ where: { userId } });
    await prisma.timetableOverride.deleteMany({ where: { semester: { userId } } });
    await prisma.timetableSlot.deleteMany({ where: { semester: { userId } } });
    await prisma.subject.deleteMany({ where: { userId } });
    await prisma.semester.deleteMany({ where: { userId } });
    return { success: true, message: "All app data reset successfully." };
  }

  static async resetSubjectAttendance(userId: string, subjectIds: string[]) {
    await prisma.attendance.deleteMany({
      where: {
        userId,
        subjectId: { in: subjectIds },
      },
    });
    return { success: true, message: "Subject attendance reset successfully." };
  }

  static async resetAllAttendance(userId: string) {
    await prisma.attendance.deleteMany({
      where: { userId },
    });
    return { success: true, message: "All attendance records reset successfully." };
  }
}
