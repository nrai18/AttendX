import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { prisma } from "../lib/prisma";
import { setRefreshCookie, clearRefreshCookie } from "../utils/cookie";

export class AuthController { 

  static async forgotPassword(req: Request, res: Response) {
    try {
      const email = String(req.body.email || "").toLowerCase().trim();
      if (!email) return res.status(400).json({ message: "Email is required" });

      const allowedDomainsStr = process.env.ALLOWED_DOMAINS || "iiitu.ac.in,gmail.com";
      const allowedDomains = allowedDomainsStr.split(",").map(d => d.trim().toLowerCase());
      const emailDomain = email.split("@")[1];
      if (!emailDomain || (!allowedDomains.includes("*") && !allowedDomains.includes(emailDomain))) {
        return res.status(400).json({ message: "Email domain is not authorized for this platform." });
      }

      const result = await AuthService.forgotPassword(email);
      res.status(200).json({ message: "If an account exists, an OTP has been sent.", token: result.token });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      const { FailureLogRecorder } = require("../utils/failureLogRecorder");
      FailureLogRecorder.recordError(error, req);
      res.status(500).json({ message: "Something went wrong" });
    }
  }

  
  static async validateOtp(req: Request, res: Response) {
    try {
      const { token, otp } = req.body;
      if (!token || !otp) return res.status(400).json({ message: "Token and OTP are required" });
      const isValid = await AuthService.validateOtp(token, String(otp).trim());
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
      
      await AuthService.resetPassword(token, String(otp).trim(), newPassword);
      res.status(200).json({ message: "Password reset successful" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  private static isTransientInfraError(error: any): boolean {
    const code = String(error?.code || "").toUpperCase();
    const msg = String(error?.message || "").toLowerCase();
    return (
      ["P1001", "P1002", "P1008", "P1017", "P2024", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "UND_ERR_CONNECT_TIMEOUT"].includes(code) ||
      msg.includes("can't reach database") ||
      msg.includes("connection terminated") ||
      msg.includes("timed out") ||
      msg.includes("timeout") ||
      msg.includes("fetch failed") ||
      msg.includes("socket hang up") ||
      msg.includes("econnreset") ||
      msg.includes("network error") ||
      msg.includes("getfederatedsignoncerts")
    );
  }

  static async login(req: Request, res: Response) {
    try {
      const email = String(req.body.email || "").toLowerCase().trim();
      
      const allowedDomainsStr = process.env.ALLOWED_DOMAINS || "iiitu.ac.in,gmail.com";
      const allowedDomains = allowedDomainsStr.split(",").map(d => d.trim().toLowerCase());
      const emailDomain = email.split("@")[1];
      if (!emailDomain || (!allowedDomains.includes("*") && !allowedDomains.includes(emailDomain))) {
        return res.status(401).json({ message: "Email domain is not authorized for this platform." });
      }
      const { user, accessToken, refreshToken } = await AuthService.login({ ...req.body, email }, req);
      setRefreshCookie(res, refreshToken);
      res.status(200).json({ user, accessToken, refreshToken });
    } catch (error: any) {
      if (AuthController.isTransientInfraError(error)) {
        console.warn("Login transient backend error:", error?.message || error);
        res.setHeader("Retry-After", "2");
        return res.status(503).json({ message: "Server is warming up, please retry in a moment.", transient: true });
      }
      res.status(401).json({ message: error.message });
    }
  }

  static async refresh(req: Request, res: Response) {
    try {
      // Prioritize explicit body token from client store over potentially stale/mismatched cookie
      const oldRefreshToken = req.body.refreshToken || req.cookies.refreshToken;
      if (!oldRefreshToken) {
        return res.status(401).json({ message: "No refresh token provided" });
      }

      const { accessToken, refreshToken } = await AuthService.refresh(oldRefreshToken, req);
      setRefreshCookie(res, refreshToken);
      res.status(200).json({ accessToken, refreshToken });
    } catch (error: any) {
      const msg = error?.message || "";
      const isAuthFailure =
        msg === "Invalid or expired refresh token. Please login again." ||
        msg === "User not found" ||
        msg === "No refresh token provided";
      if (isAuthFailure) {
        clearRefreshCookie(res);
        res.status(401).json({ message: msg });
      } else {
        // Database timeout or other server error (e.g., Prisma "Invalid `prisma...` invocation")
        console.error("Refresh error:", error);
        res.setHeader("Retry-After", "2");
        res.status(503).json({ message: "Database temporarily reconnecting, please retry in a moment", transient: true });
      }
    }
  }

  static async logout(req: Request, res: Response) {
    try {
      const { invalidateSessionCache } = require("../middleware/authenticate");
      // 1. Try to delete session using the access token's sessionId.
      // SEC-02 FIX: Use verifyAccessTokenIgnoreExpiration() (signature-verified) NOT jwt.decode()
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        try {
          const { verifyAccessTokenIgnoreExpiration } = require("../utils/jwt");
          const payload = verifyAccessTokenIgnoreExpiration(token);
          if (payload?.sessionId) {
            invalidateSessionCache(payload.sessionId);
            await prisma.refreshToken.deleteMany({ where: { id: payload.sessionId } });
          }
        } catch (e) {
          // Token invalid (bad signature) — ignore.
        }
      }

      // 2. Also delete using explicit body refreshToken or cookie refreshToken
      const bodyOrCookieRefreshToken = req.body?.refreshToken || req.cookies?.refreshToken;
      if (bodyOrCookieRefreshToken) {
        await AuthService.logout(bodyOrCookieRefreshToken);
      }

      clearRefreshCookie(res);
      res.status(200).json({ message: "Logged out successfully" });
    } catch (error: any) {
      clearRefreshCookie(res);
      res.status(200).json({ message: "Logged out successfully" });
    }
  }

  static async googleNative(req: Request, res: Response) {
    try {
      const { idToken } = req.body;
      if (!idToken) return res.status(400).json({ message: "idToken is required" });

      const { user, accessToken, refreshToken } = await AuthService.googleNativeLogin(idToken, req);
      setRefreshCookie(res, refreshToken);
      res.status(200).json({ user, accessToken, refreshToken });
    } catch (error: any) {
      console.error("Google Native Auth Error:", error);
      if (AuthController.isTransientInfraError(error)) {
        res.setHeader("Retry-After", "2");
        return res.status(503).json({
          message: "Server is warming up or temporarily unreachable. Retrying...",
          transient: true,
        });
      }
      res.status(401).json({ message: error.message || "Authentication failed" });
    }
  }
}
