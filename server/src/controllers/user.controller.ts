import { Response } from "express";
import { UserService } from "../services/user.service";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { CacheService } from "../services/cache.service";

export class UserController {
  static async getMe(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const user = await UserService.getProfile(userId);
      res.status(200).json(user);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  }

  static async updateMe(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const updatedUser = await UserService.updateProfile(userId, req.body);
      await CacheService.invalidateUser(userId);
      res.status(200).json(updatedUser);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async resetData(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const result = await UserService.resetData(userId);
      await CacheService.invalidateUser(userId);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to reset app data" });
    }
  }

  static async resetSubjectAttendance(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const { subjectIds } = req.body;
      if (!subjectIds || !Array.isArray(subjectIds) || subjectIds.length === 0) {
        return res.status(400).json({ message: "Invalid or empty subjectIds array" });
      }
      const result = await UserService.resetSubjectAttendance(userId, subjectIds);
      await CacheService.invalidateUser(userId);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to reset subject attendance" });
    }
  }

  static async resetAllAttendance(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const result = await UserService.resetAllAttendance(userId);
      await CacheService.invalidateUser(userId);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to reset all attendance" });
    }
  }
}
