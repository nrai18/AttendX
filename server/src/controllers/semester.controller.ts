import { Response } from "express";
import { SemesterService } from "../services/semester.service";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { CacheService } from "../services/cache.service";

export class SemesterController {
  static async list(req: AuthenticatedRequest, res: Response) {
    const semesters = await SemesterService.listSemesters(req.user!.userId);
    res.json(semesters);
  }

  static async getActive(req: AuthenticatedRequest, res: Response) {
    const active = await SemesterService.getActiveSemester(req.user!.userId);
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
}
