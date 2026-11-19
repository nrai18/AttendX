import { Response } from "express";
import { SubjectService } from "../services/subject.service";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { CacheService } from "../services/cache.service";

export class SubjectController {
  static async list(req: AuthenticatedRequest, res: Response) {
    try {
      const semesterId = req.query.semesterId as string | undefined;
      const userId = req.user!.userId;
      const subjects = await CacheService.getOrSet(
        userId,
        `subjects:${semesterId || "all"}`,
        () => SubjectService.listSubjects(userId, semesterId)
      );
      res.json(subjects);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to list subjects" });
    }
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
    try {
      const updated = await SubjectService.updateSubject(req.user!.userId, String(req.params.id), req.body);
      await CacheService.invalidateUser(req.user!.userId);
      res.json(updated);
    } catch (error: any) {
      const status = error.message === "Subject not found" ? 404 : 400;
      res.status(status).json({ error: error.message || "Failed to update subject" });
    }
  }

  static async merge(req: AuthenticatedRequest, res: Response) {
    try {
      const { merges } = req.body;
      if (!Array.isArray(merges)) {
        return res.status(400).json({ error: "Invalid payload: merges must be an array" });
      }
      const results = await SubjectService.mergeSubjects(req.user!.userId, merges);
      await CacheService.invalidateUser(req.user!.userId);
      res.json({ message: "Subjects merged successfully", results });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async remove(req: AuthenticatedRequest, res: Response) {
    try {
      await SubjectService.deleteSubject(req.user!.userId, String(req.params.id));
      await CacheService.invalidateUser(req.user!.userId);
      // Attendance has a required FK to Subject with onDelete: Cascade, so deleting a subject removes its logs.
      res.json({ message: "Subject removed successfully", preservedHistory: false });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to remove subject" });
    }
  }
}
