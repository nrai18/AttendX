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
      const feed = await ClassroomService.getClassroomFeed(req.user!.userId, String(id));
      res.json(feed);
    } catch (error: any) {
      if (error.message.includes("Access denied")) {
        return res.status(403).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to fetch classroom feed" });
    }
  }

  static async getClassroomMembers(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const members = await ClassroomService.getClassroomMembers(req.user!.userId, String(id));
      res.json(members);
    } catch (error: any) {
      console.error("[ClassroomController] getClassroomMembers error:", error);
      if (error.status === 403 || error.message.includes("Access denied")) {
        return res.status(403).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to fetch classroom members" });
    }
  }

  static async updateBroadcastPermissions(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { broadcastPermission, allowedPosterIds, deniedPosterIds } = req.body;
      const updated = await ClassroomService.updateBroadcastPermissions(req.user!.userId, String(id), {
        broadcastPermission,
        allowedPosterIds,
        deniedPosterIds,
      });
      res.json(updated);
    } catch (error: any) {
      console.error("[ClassroomController] updateBroadcastPermissions error:", error);
      if (error.status === 403 || error.message.includes("Only classroom admins")) {
        return res.status(403).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to update broadcast permissions" });
    }
  }

  static async createAnnouncement(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { title, content, importance } = req.body;
      if (!title || !content) {
        return res.status(400).json({ message: "Title and content are required" });
      }

      const announcement = await ClassroomService.createAnnouncement(req.user!.userId, String(id), {
        title,
        content,
        importance,
      });

      res.status(201).json(announcement);
    } catch (error: any) {
      console.error("[ClassroomController] createAnnouncement error:", error);
      if (error.status === 403 || error.message.includes("Only") || error.message.includes("restricted")) {
        return res.status(403).json({ message: error.message || "Posting restricted in this section" });
      }
      res.status(500).json({ message: error.message || "Failed to create announcement" });
    }
  }

  static async deleteClassroom(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const result = await ClassroomService.deleteClassroom(req.user!.userId, String(id));
      res.json(result);
    } catch (error: any) {
      console.error("[ClassroomController] deleteClassroom error:", error);
      if (error.status === 403 || error.message.includes("Only classroom admins")) {
        return res.status(403).json({ message: error.message });
      }
      res.status(500).json({ message: error.message || "Failed to delete classroom" });
    }
  }

  static async leaveClassroom(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const result = await ClassroomService.leaveClassroom(req.user!.userId, String(id));
      res.json(result);
    } catch (error: any) {
      console.error("[ClassroomController] leaveClassroom error:", error);
      res.status(500).json({ message: error.message || "Failed to leave classroom" });
    }
  }
}
