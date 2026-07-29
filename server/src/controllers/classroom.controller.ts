import { Response } from "express";
import { ClassroomService } from "../services/classroom.service";
import { AuthenticatedRequest } from "../middleware/authenticate";

export class ClassroomController {
  static async createClassroom(req: AuthenticatedRequest, res: Response) {
    try {
      const { name, section, department, batch, semesterId } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Classroom name is required" });
      }

      const classroom = await ClassroomService.createClassroom(req.user!.userId, {
        name,
        section,
        department,
        batch,
        semesterId,
      });

      res.status(201).json(classroom);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async joinClassroom(req: AuthenticatedRequest, res: Response) {
    try {
      const { joinCode } = req.body;
      if (!joinCode) {
        return res.status(400).json({ message: "Join code is required" });
      }

      const member = await ClassroomService.joinClassroom(req.user!.userId, joinCode);
      res.status(200).json(member);
    } catch (error: any) {
      if (error.message.includes("Invalid join code") || error.message.includes("already a member")) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to join classroom" });
    }
  }

  static async getUserClassrooms(req: AuthenticatedRequest, res: Response) {
    try {
      const classrooms = await ClassroomService.getUserClassrooms(req.user!.userId);
      res.json(classrooms);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch classrooms" });
    }
  }

  static async getClassroomFeed(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const feed = await ClassroomService.getClassroomFeed(req.user!.userId, id);
      res.json(feed);
    } catch (error: any) {
      if (error.message.includes("Access denied")) {
        return res.status(403).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to fetch classroom feed" });
    }
  }
}
