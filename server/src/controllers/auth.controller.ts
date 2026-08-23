import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { setRefreshCookie, clearRefreshCookie } from "../utils/cookie";

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const email = req.body.email || "";
      if (!email.endsWith("@iiitu.ac.in") && !email.endsWith("@gmail.com")) {
        return res.status(400).json({ message: "Only @iiitu.ac.in or @gmail.com emails are allowed." });
      }
      const { user, accessToken, refreshToken } = await AuthService.register(req.body);
      setRefreshCookie(res, refreshToken);
      res.status(201).json({ user, accessToken });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const email = req.body.email || "";
      if (!email.endsWith("@iiitu.ac.in") && !email.endsWith("@gmail.com")) {
        return res.status(401).json({ message: "Only @iiitu.ac.in or @gmail.com emails are allowed." });
      }
      const { user, accessToken, refreshToken } = await AuthService.login(req.body);
      setRefreshCookie(res, refreshToken);
      res.status(200).json({ user, accessToken });
    } catch (error: any) {
      res.status(401).json({ message: error.message });
    }
  }

  static async refresh(req: Request, res: Response) {
    try {
      const oldRefreshToken = req.cookies.refreshToken;
      if (!oldRefreshToken) {
        return res.status(401).json({ message: "No refresh token provided" });
      }

      const { accessToken, refreshToken } = await AuthService.refresh(oldRefreshToken);
      setRefreshCookie(res, refreshToken);
      res.status(200).json({ accessToken });
    } catch (error: any) {
      clearRefreshCookie(res);
      res.status(401).json({ message: error.message });
    }
  }

  static async logout(req: Request, res: Response) {
    try {
      const refreshToken = req.cookies.refreshToken;
      await AuthService.logout(refreshToken);
      clearRefreshCookie(res);
      res.status(200).json({ message: "Logged out successfully" });
    } catch (error: any) {
      res.status(500).json({ message: "Logout failed" });
    }
  }

}
