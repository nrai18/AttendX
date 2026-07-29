import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { setRefreshCookie, clearRefreshCookie } from "../utils/cookie";

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      if (!req.body.email || !req.body.email.endsWith("@iiitu.ac.in")) {
        return res.status(400).json({ message: "Only @iiitu.ac.in emails are allowed." });
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
      if (!req.body.email || !req.body.email.endsWith("@iiitu.ac.in")) {
        return res.status(401).json({ message: "Only @iiitu.ac.in emails are allowed." });
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

  static async googleCallback(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/login?error=oauth_failed`);
      }

      const { accessToken, refreshToken } = await AuthService.generateTokensForOAuth(req.user);
      setRefreshCookie(res, refreshToken);
      
      // Redirect to frontend. The frontend will call /refresh to get the token or we can pass it in hash.
      // But actually, we just set the refresh cookie, so frontend can just call /refresh on mount.
      res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/?oauth=success`);
    } catch (error: any) {
      res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/login?error=${encodeURIComponent(error.message)}`);
    }
  }
}
