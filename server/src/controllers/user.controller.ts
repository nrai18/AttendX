import { Response } from "express";
import { UserService } from "../services/user.service";
import { AuthenticatedRequest } from "../middleware/authenticate";

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
      res.status(200).json(updatedUser);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
}
