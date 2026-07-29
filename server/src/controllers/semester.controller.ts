import { Response } from "express";
import { SemesterService } from "../services/semester.service";
import { AuthenticatedRequest } from "../middleware/authenticate";

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
    res.status(201).json(semester);
  }

  static async remove(req: AuthenticatedRequest, res: Response) {
    const wipe = req.query.wipe === "true";
    await SemesterService.deleteSemester(req.user!.userId, req.params.id, wipe);
    res.json({ message: "Semester deleted successfully" });
  }
}
