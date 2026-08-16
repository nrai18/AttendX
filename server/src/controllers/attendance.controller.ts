import { Response } from "express";
import { AttendanceService } from "../services/attendance.service";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { CacheService } from "../services/cache.service";

export class AttendanceController {
  static async getTodayAgenda(req: AuthenticatedRequest, res: Response) {
    const { date } = req.query;
    if (!date || typeof date !== "string") {
      return res.status(400).json({ message: "Date is required (YYYY-MM-DD)" });
    }

    const agenda = await CacheService.getOrSet(
      req.user!.userId,
      `agenda:${date}`,
      () => AttendanceService.getTodayAgenda(req.user!.userId, date)
    );
    res.json(agenda);
  }

  static async markAttendance(req: AuthenticatedRequest, res: Response) {
    const { subjectId, date, status, timetableSlotId, overrideId } = req.body;
    
    if (!subjectId || !date || !status) {
      return res.status(400).json({ message: "subjectId, date, and status are required" });
    }

    const record = await AttendanceService.markAttendance(req.user!.userId, {
      subjectId,
      date,
      status,
      timetableSlotId,
      overrideId,
    });
    
    await CacheService.invalidateUser(req.user!.userId);
    res.status(200).json(record);
  }

  static async getSubjectStats(req: AuthenticatedRequest, res: Response) {
    const { semesterId } = req.query;
    const stats = await CacheService.getOrSet(
      req.user!.userId,
      `stats:${semesterId || 'default'}`,
      () => AttendanceService.getSubjectStats(req.user!.userId, semesterId as string | undefined)
    );
    res.json(stats);
  }

  static async getSingleSubjectStats(req: AuthenticatedRequest, res: Response) {
    const { subjectId } = req.params;
    try {
      const stats = await CacheService.getOrSet(
        req.user!.userId,
        `singleStats:${subjectId}`,
        () => AttendanceService.getSingleSubjectStats(req.user!.userId, String(subjectId))
      );
      res.json(stats);
    } catch (error: any) {
      if (error.message === "Subject not found") {
        return res.status(404).json({ message: "Subject not found" });
      }
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  static async getMonthlyCalendar(req: AuthenticatedRequest, res: Response) {
    const { month } = req.query; // YYYY-MM
    if (!month || typeof month !== "string") {
      return res.status(400).json({ message: "month is required (YYYY-MM)" });
    }

    try {
      const calendar = await CacheService.getOrSet(
        req.user!.userId,
        `calendar:${month}`,
        () => AttendanceService.getMonthlyCalendar(req.user!.userId, month)
      );
      res.json(calendar);
    } catch (error: any) {
      console.error("Calendar Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  static async getAttendanceLogs(req: AuthenticatedRequest, res: Response) {
    const { subjectId, semesterId } = req.query;
    try {
      const logsData = await CacheService.getOrSet(
        req.user!.userId,
        `logs:${subjectId || 'all'}:${semesterId || 'all'}`,
        () => AttendanceService.getAttendanceLogs(req.user!.userId, {
          subjectId: subjectId as string | undefined,
          semesterId: semesterId as string | undefined,
        })
      );
      res.json(logsData);
    } catch (error: any) {
      console.error("Get logs error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
}
