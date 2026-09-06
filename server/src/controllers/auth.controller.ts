import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { setRefreshCookie, clearRefreshCookie } from "../utils/cookie";

export class AuthController { 

  static async forgotPassword(req: Request, res: Response) {
    try {
      const email = req.body.email;
      if (!email) return res.status(400).json({ message: "Email is required" });
      const result = await AuthService.forgotPassword(email);
      res.status(200).json({ message: "If an account exists, an OTP has been sent.", token: result.token });
    } catch (error: any) {
      res.status(500).json({ message: "Something went wrong" });
    }
  }

  static async resetPassword(req: Request, res: Response) {
    try {
      const { token, otp, newPassword } = req.body;
      if (!token || !otp || !newPassword) return res.status(400).json({ message: "Token, OTP, and new password are required" });
      
      await AuthService.resetPassword(token, otp, newPassword);
      res.status(200).json({ message: "Password reset successful" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async register(req: Request, res: Response) {
    try {
      const email = req.body.email || "";
      if (!email.endsWith("@iiitu.ac.in") && !email.endsWith("@gmail.com")) {
        return res.status(400).json({ message: "Only @iiitu.ac.in or @gmail.com emails are allowed." });
      }
      const { user, accessToken, refreshToken } = await AuthService.register(req.body, req);
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
      const { user, accessToken, refreshToken } = await AuthService.login(req.body, req);
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

      const { accessToken, refreshToken } = await AuthService.refresh(oldRefreshToken, req);
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

  static async googleNative(req: Request, res: Response) {
    try {
      const { idToken } = req.body;
      if (!idToken) return res.status(400).json({ message: "idToken is required" });

      const { user, accessToken, refreshToken } = await AuthService.googleNativeLogin(idToken, req);
      setRefreshCookie(res, refreshToken);
      res.status(200).json({ user, accessToken });
    } catch (error: any) {
      console.error("Google Native Auth Error:", error);
      res.status(401).json({ message: error.message || "Authentication failed" });
    }
  }
}
