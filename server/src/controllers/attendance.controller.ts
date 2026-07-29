import { Response } from "express";
import { AttendanceService } from "../services/attendance.service";
import { AuthenticatedRequest } from "../middleware/authenticate";

export class AttendanceController {
  static async getTodayAgenda(req: AuthenticatedRequest, res: Response) {
    const { date } = req.query;
    if (!date || typeof date !== "string") {
      return res.status(400).json({ message: "Date is required (YYYY-MM-DD)" });
    }

    const agenda = await AttendanceService.getTodayAgenda(req.user!.userId, date);
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
    
    res.status(200).json(record);
  }

  static async getSubjectStats(req: AuthenticatedRequest, res: Response) {
    const { semesterId } = req.query;
    const stats = await AttendanceService.getSubjectStats(req.user!.userId, semesterId as string | undefined);
    res.json(stats);
  }
}
