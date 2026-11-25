import { Response } from "express";
import { SemesterService } from "../services/semester.service";
import { WrapService } from "../services/wrap.service";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { CacheService } from "../services/cache.service";

export class SemesterController {
  static async list(req: AuthenticatedRequest, res: Response) {
    const userId = req.user!.userId;
    const semesters = await CacheService.getOrSet(
      userId,
      "semesters:list",
      () => SemesterService.listSemesters(userId)
    );
    res.json(semesters);
  }

  static async getActive(req: AuthenticatedRequest, res: Response) {
    const userId = req.user!.userId;
    const active = await CacheService.getOrSet(
      userId,
      "semesters:active",
      () => SemesterService.getActiveSemester(userId)
    );
    res.json(active);
  }

  static async create(req: AuthenticatedRequest, res: Response) {
    const semester = await SemesterService.createSemester(req.user!.userId, req.body);
    await CacheService.invalidateUser(req.user!.userId);
    res.status(201).json(semester);
  }

  static async activate(req: AuthenticatedRequest, res: Response) {
    const semester = await SemesterService.activateSemester(req.user!.userId, String(req.params.id));
    await CacheService.invalidateUser(req.user!.userId);
    res.json(semester);
  }

  static async remove(req: AuthenticatedRequest, res: Response) {
    const wipe = req.query.wipe === "true";
    await SemesterService.deleteSemester(req.user!.userId, String(req.params.id), wipe);
    await CacheService.invalidateUser(req.user!.userId);
    res.json({ message: "Semester deleted successfully" });
  }

  static async getTransitionStatus(req: AuthenticatedRequest, res: Response) {
    const userId = req.user!.userId;
    const status = await SemesterService.getTransitionStatus(userId);
    res.json(status);
  }

  static async transition(req: AuthenticatedRequest, res: Response) {
    const userId = req.user!.userId;
    const result = await SemesterService.transitionToNextSemester(userId, req.body);
    await CacheService.invalidateUser(userId);
    res.json(result);
  }

  static async notifyTransition(req: AuthenticatedRequest, res: Response) {
    const userId = req.user!.userId;
    const sent = await SemesterService.sendSemesterEndNotification(userId);
    res.json({ success: sent, message: sent ? "Semester completion notification sent" : "No notification sent" });
  }

  static async getWrap(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const semesterId = typeof req.query.semesterId === "string" ? req.query.semesterId : undefined;
      const data = await WrapService.getWrapSummary(userId, semesterId);
      if (!data) {
        return res.status(404).json({ message: "No active semester found for Wrap." });
      }
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to generate semester wrap." });
    }
  }

  static async generateWrapAiCopy(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const providedSnapshot = req.body?.snapshot;
      const aiCopy = await WrapService.generateAiCopy(userId, providedSnapshot);
      res.json(aiCopy);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to generate AI wrap copy." });
    }
  }
}
