import { Response } from "express";
import { SubjectService } from "../services/subject.service";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { CacheService } from "../services/cache.service";

export class SubjectController {
  static async list(req: AuthenticatedRequest, res: Response) {
    const semesterId = req.query.semesterId as string | undefined;
    const subjects = await SubjectService.listSubjects(req.user!.userId, semesterId);
    res.json(subjects);
  }

  static async create(req: AuthenticatedRequest, res: Response) {
    try {
      const subject = await SubjectService.createSubject(req.user!.userId, req.body);
      await CacheService.invalidateUser(req.user!.userId);
      res.status(201).json(subject);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async update(req: AuthenticatedRequest, res: Response) {
    const updated = await SubjectService.updateSubject(req.user!.userId, String(req.params.id), req.body);
    await CacheService.invalidateUser(req.user!.userId);
    res.json(updated);
  }

  static async remove(req: AuthenticatedRequest, res: Response) {
    const preserveHistory = req.query.preserveHistory !== "false";
    await SubjectService.deleteSubject(req.user!.userId, String(req.params.id), preserveHistory);
    await CacheService.invalidateUser(req.user!.userId);
    res.json({ message: "Subject removed successfully", preservedHistory: preserveHistory });
  }
}
