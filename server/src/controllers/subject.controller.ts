import { Response } from "express";
import { SubjectService } from "../services/subject.service";
import { AuthenticatedRequest } from "../middleware/authenticate";

export class SubjectController {
  static async list(req: AuthenticatedRequest, res: Response) {
    const semesterId = req.query.semesterId as string | undefined;
    const subjects = await SubjectService.listSubjects(req.user!.userId, semesterId);
    res.json(subjects);
  }

  static async create(req: AuthenticatedRequest, res: Response) {
    const subject = await SubjectService.createSubject(req.user!.userId, req.body);
    res.status(201).json(subject);
  }

  static async update(req: AuthenticatedRequest, res: Response) {
    const updated = await SubjectService.updateSubject(req.user!.userId, req.params.id, req.body);
    res.json(updated);
  }

  static async remove(req: AuthenticatedRequest, res: Response) {
    const preserveHistory = req.query.preserveHistory !== "false";
    await SubjectService.deleteSubject(req.user!.userId, req.params.id, preserveHistory);
    res.json({ message: "Subject removed successfully", preservedHistory: preserveHistory });
  }
}
