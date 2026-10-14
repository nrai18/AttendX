import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import rateLimit from "express-rate-limit";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { message: "Too many login attempts from this IP, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    const rawEmail = req.body?.email ? String(req.body.email).toLowerCase().trim() : "anonymous";
    return `${req.ip}_${rawEmail}`;
  },
  message: { message: "Too many password reset requests. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// SEC-M08 FIX: Add rate limiting to /refresh to prevent token brute-forcing
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 refreshes per 15 min per IP
  message: { message: "Too many token refresh attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/login", loginLimiter, AuthController.login);
router.post("/refresh", refreshLimiter, AuthController.refresh);
router.post("/logout", AuthController.logout);
router.post("/forgot-password", forgotPasswordLimiter, AuthController.forgotPassword);
router.post("/validate-otp", loginLimiter, AuthController.validateOtp);
router.post("/reset-password", loginLimiter, AuthController.resetPassword);

// Google OAuth routes (Native Mobile)
router.post("/google/native", loginLimiter, AuthController.googleNative);

// Google OAuth routes
import passport from "../middleware/passport";
import { AuthService } from "../services/auth.service";
import { setRefreshCookie } from "../utils/cookie";
import { FailureLogRecorder } from "../utils/failureLogRecorder";

import crypto from "crypto";

router.get("/google", (req, res, next) => {
  const { lat, lon } = req.query;
  const nonce = crypto.randomBytes(16).toString("hex");
  // SEC-M06 FIX: Set HTTP-only cookie with nonce to prevent Login CSRF
  res.cookie("oauth_nonce", nonce, { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === "production", 
    sameSite: "lax", 
    maxAge: 10 * 60 * 1000 
  });
  const state = Buffer.from(JSON.stringify({ lat, lon, nonce })).toString("base64");
  passport.authenticate("google", { scope: ["profile", "email"], state })(req, res, next);
});

router.get(
  "/google/callback",
  (req, res, next) => {
    passport.authenticate("google", { session: false }, async (err: any, user: any, info: any) => {
      const frontendUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === "production" ? "https://attendx.tech" : "http://localhost:5173");

      if (err || !user) {
        FailureLogRecorder.recordError(err || new Error(info?.message || "Google OAuth Verification Failed"), req);
        console.error("[Google OAuth Callback Error]:", err || info);
        const errMsg = err?.message || info?.message || "domain";
        return res.redirect(`${frontendUrl}/404?error=${encodeURIComponent(errMsg)}`);
      }

      try {
        let reqWithGps = req;
        if (req.query.state) {
          try {
            const { lat, lon } = JSON.parse(Buffer.from(req.query.state as string, "base64").toString());
            if (lat && lon) {
              reqWithGps = Object.assign({}, req, {
                headers: { ...req.headers, "x-attendx-lat": lat, "x-attendx-lon": lon },
              }) as any;
            }
          } catch (e) {}
        }
        const { accessToken, refreshToken } = await AuthService.generateTokensForOAuth(user, reqWithGps);
        setRefreshCookie(res, refreshToken);

        // SEC-H02 FIX: Do not pass access token in URL query (leaks to server logs).
        // Pass it in the URL hash fragment (#) instead, which is never sent to the server.
        res.redirect(`${frontendUrl}/login#oauth_token=${accessToken}`);
      } catch (error: any) {
        FailureLogRecorder.recordError(error, req);
        console.error("Google Auth Token Generation Error:", error);
        res.redirect(`${frontendUrl}/404?error=${encodeURIComponent(error?.message || "server")}`);
      }
    })(req, res, next);
  }
);

export default router;
