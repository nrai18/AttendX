import { prisma } from "../lib/prisma";
import { TimetableService } from "./timetable.service";
import bcrypt from "bcryptjs";

export class UserService { 

  static async deleteAccount(userId: string) {
    const fsPromises = require('fs/promises');
    const path = require('path');

    // 1. Delete stored documents from filesystem
    const docs = await prisma.storedDocument.findMany({ where: { userId } });
    for (const doc of docs) {
      if (doc.fileUrl.startsWith('/uploads/')) {
        try {
          const filePath = path.join(process.cwd(), doc.fileUrl);
          await fsPromises.unlink(filePath).catch(() => {});
        } catch(e) {}
      }
    }

    // 2. Delete classrooms created by this user
    await prisma.classroom.deleteMany({ where: { createdById: userId } });
    
    // 3. Delete announcements and events created by user
    await prisma.announcement.deleteMany({ where: { createdById: userId } });
    await prisma.event.deleteMany({ where: { userId } });

    // 4. Delete the user (this cascades to mostly everything else like attendance, subjects, etc.)
    await prisma.user.delete({ where: { id: userId } });
  }

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

  static async getSessions(userId: string, sessionId?: string) {
    let user: { autoTerminateMonths?: number | null } | null = null;
    try {
      user = await prisma.user.findUnique({ where: { id: userId }, select: { autoTerminateMonths: true } }) as any;
    } catch (error) {
      // Ignore if Prisma client is not fully generated yet
    }
    if (user?.autoTerminateMonths) {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - user.autoTerminateMonths);
      await prisma.refreshToken.deleteMany({
        where: {
          userId,
          lastActive: { lt: cutoffDate },
          id: sessionId ? { not: sessionId } : undefined
        }
      });
    }
    const sessions = await prisma.refreshToken.findMany({
      where: { userId },
      orderBy: { lastActive: "desc" },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        location: true,
        deviceType: true,
        os: true,
        browser: true,
        lastActive: true,
        createdAt: true
      }
    });

    return sessions.map((s: any) => {
      let { os, browser, deviceType, location } = s;

      // Normalize stale "web" os value stored in old sessions
      if (os === 'web') {
        os = 'Browser';
        browser = 'Browser';
        deviceType = 'desktop';
      }

      // Normalize stale "Unknown OS" or null
      if (!os || os === 'Unknown OS') {
        os = 'Unknown Device';
      }

      // If location looks like a raw geoip dump with just country code or unknown, prefer showing nothing
      if (location === 'Unknown Location' || location === ', ') {
        location = null;
      }

      return {
        ...s,
        os,
        browser,
        deviceType,
        location,
        isCurrent: s.id === sessionId
      };
    });
  }

  static async revokeSession(userId: string, sessionId: string) {
    await prisma.refreshToken.deleteMany({ where: { userId, id: sessionId } });
    return { success: true };
  }

  static async revokeAllOtherSessions(userId: string, currentSessionId: string) {
    await prisma.refreshToken.deleteMany({ where: { userId, id: { not: currentSessionId } } });
    return { success: true };
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
    const fsPromises = require('fs/promises');
    const path = require('path');

    // Delete stored documents from filesystem
    const docs = await prisma.storedDocument.findMany({ where: { userId } });
    for (const doc of docs) {
      if (doc.fileUrl.startsWith('/uploads/')) {
        try {
          const filePath = path.join(process.cwd(), doc.fileUrl);
          await fsPromises.unlink(filePath).catch((e: any) => {
            if (e.code !== 'ENOENT') console.error("Failed to delete physical file during reset:", e);
          });
        } catch (err) {
          console.error("Failed to delete file during reset:", doc.fileUrl, err);
        }
      }
    }

    await prisma.storedDocument.deleteMany({ where: { userId } });
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
