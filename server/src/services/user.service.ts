import { prisma } from "../lib/prisma";
import { TimetableService } from "./timetable.service";
import bcrypt from "bcryptjs";

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
        gender: true,
        birthday: true,
        passwordHash: true,
        googleId: true,
        createdAt: true,
      },
    });
    if (!user) throw new Error("User not found");
    const { passwordHash, ...rest } = user;
    return { ...rest, hasPassword: !!passwordHash };
  }

  static async updateProfile(userId: string, data: any) {
    const { newPassword, oldPassword, ...updateData } = data;

    if (newPassword) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("User not found");
      
      if (user.passwordHash) {
        if (!oldPassword) throw new Error("Current password is required to set a new password");
        const isValid = await bcrypt.compare(oldPassword, user.passwordHash);
        if (!isValid) throw new Error("Incorrect current password");
      }
      
      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (updateData.targetAttendance !== undefined) {
      await prisma.subject.updateMany({
        where: { userId },
        data: { targetAttendance: null }
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
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
        gender: true,
        birthday: true,
        passwordHash: true,
      },
    });

    const { passwordHash, ...rest } = updatedUser;
    return { ...rest, hasPassword: !!passwordHash };
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

  static async resetEvents(userId: string) {
    await prisma.event.deleteMany({
      where: { userId }
    });
    return { success: true, message: "Events cleared successfully." };
  }

  static async resetData(userId: string) {
    await prisma.attendance.deleteMany({ where: { userId } });
    await prisma.timetableOverride.deleteMany({ where: { semester: { userId } } });
    await prisma.timetableSlot.deleteMany({ where: { semester: { userId } } });
    await prisma.subject.deleteMany({ where: { userId } });
    await prisma.semester.deleteMany({ where: { userId } });
    await prisma.event.deleteMany({ where: { userId } });
    await prisma.assignmentCompletion.deleteMany({ where: { userId } });
    await prisma.assignment.deleteMany({ where: { userId } });
    await prisma.note.deleteMany({ where: { userId } });
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
