import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { prisma } from "../lib/prisma";
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

  
  static async validateOtp(req: Request, res: Response) {
    try {
      const { token, otp } = req.body;
      if (!token || !otp) return res.status(400).json({ message: "Token and OTP are required" });
      const isValid = await AuthService.validateOtp(token, otp);
      if (!isValid) return res.status(400).json({ message: "Invalid OTP" });
      res.status(200).json({ message: "OTP valid" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
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

  static async login(req: Request, res: Response) {
    try {
      const email = req.body.email || "";
      
      const allowedDomainsStr = process.env.ALLOWED_DOMAINS || "iiitu.ac.in,gmail.com";
      const allowedDomains = allowedDomainsStr.split(",").map(d => d.trim());
      const emailDomain = email.split("@")[1];
      if (!emailDomain || !allowedDomains.includes(emailDomain)) {
        return res.status(401).json({ message: "Domain not allowed. Allowed domains: " + allowedDomainsStr });
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
      if (
        error.message.includes("Invalid") || 
        error.message.includes("expired") || 
        error.message.includes("not found")
      ) {
        clearRefreshCookie(res);
        res.status(401).json({ message: error.message });
      } else {
        // Database timeout or other server error
        console.error("Refresh error (500):", error);
        res.status(500).json({ message: "Internal server error during refresh" });
      }
    }
  }

  static async logout(req: Request, res: Response) {
    try {
      // 1. Try to delete session using the access token's sessionId
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        try {
          const jwt = require("jsonwebtoken");
          const payload = jwt.decode(token);
          if (payload && payload.sessionId) {
            const deleted = await prisma.refreshToken.deleteMany({ where: { id: payload.sessionId } });
            console.log("Logout deleted sessions by ID:", deleted.count);
          }
        } catch (e) { console.error("Error in logout deletion by token:", e); }
      }

      // 2. Try the refresh token cookie
      const refreshToken = req.cookies.refreshToken;
      if (refreshToken) {
        await AuthService.logout(refreshToken);
      }

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
