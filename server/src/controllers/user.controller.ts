import { Response } from "express";
import { UserService } from "../services/user.service";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { CacheService } from "../services/cache.service";

export class UserController {
  static async getMe(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const user = await UserService.getProfile(userId);
      res.status(200).json(user);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  }
  static async getOnboardingStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const { prisma } = require("../lib/prisma");

      const activeSemester = await prisma.semester.findFirst({ where: { userId, isActive: true } });
      const hasSemester = !!activeSemester;
      
      let hasSubjects = false;
      let hasTimetable = false;
      let hasCalendar = false;
      let hasAttendance = false;

      if (hasSemester) {
        const subCount = await prisma.subject.count({ where: { semesterId: activeSemester.id } });
        hasSubjects = subCount > 0;

        const ttCount = await prisma.timetableSlot.count({ where: { semesterId: activeSemester.id } });
        hasTimetable = ttCount > 0;

        const evCount = await prisma.event.count({ where: { semesterId: activeSemester.id } });
        hasCalendar = evCount > 0;

        const attCount = await prisma.attendance.count({ where: { userId, subject: { semesterId: activeSemester.id } } });
        hasAttendance = attCount > 0;
      }

      res.status(200).json({ hasSemester, hasSubjects, hasTimetable, hasCalendar, hasAttendance });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async updateMe(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const updatedUser = await UserService.updateProfile(userId, req.body);
      await CacheService.invalidateUser(userId);
      res.status(200).json(updatedUser);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async resetData(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const result = await UserService.resetData(userId);
      await CacheService.invalidateUser(userId);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to reset app data" });
    }
  }

  static async resetSubjectAttendance(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const { subjectIds } = req.body;
      if (!subjectIds || !Array.isArray(subjectIds) || subjectIds.length === 0) {
        return res.status(400).json({ message: "Invalid or empty subjectIds array" });
      }
      const result = await UserService.resetSubjectAttendance(userId, subjectIds);
      await CacheService.invalidateUser(userId);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to reset subject attendance" });
    }
  }

  static async resetAllAttendance(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const result = await UserService.resetAllAttendance(userId);
      await CacheService.invalidateUser(userId);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to reset all attendance" });
    }
  }

  static async resetTimetable(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const result = await UserService.resetTimetable(userId);
      await CacheService.invalidateUser(userId);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to reset timetable" });
    }
  }

  static async resetEvents(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const result = await UserService.resetEvents(userId);
      await CacheService.invalidateUser(userId);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to reset events" });
    }
  }

  static async getSessions(req: AuthenticatedRequest, res: Response) { console.log("getSessions called!");
    try {
      const userId = req.user!.userId;
      const sessionId = req.user!.sessionId;
      const sessions = await UserService.getSessions(userId, sessionId);
      res.status(200).json(sessions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async revokeAllOtherSessions(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const sessionId = req.user!.sessionId;
      if (!sessionId) throw new Error("Current session missing");
      const result = await UserService.revokeAllOtherSessions(userId, sessionId);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async revokeSession(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const { sessionId } = req.params;
      const result = await UserService.revokeSession(userId, sessionId);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}
