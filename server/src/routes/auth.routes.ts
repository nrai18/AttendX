import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

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
    const clientIp = ipKeyGenerator(req.ip || "127.0.0.1");
    const rawEmail = req.body?.email ? String(req.body.email).toLowerCase().trim() : "anonymous";
    return `${clientIp}_${rawEmail}`;
  },
  message: { message: "Too many password reset requests. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => {
    const clientIp = ipKeyGenerator(req.ip || "127.0.0.1");
    const rawToken = req.body?.token ? String(req.body.token).slice(-24) : "notoken";
    return `${clientIp}_${rawToken}`;
  },
  message: { message: "Too many OTP verification attempts. Please try again after 15 minutes." },
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
router.post("/validate-otp", otpVerifyLimiter, AuthController.validateOtp);
router.post("/reset-password", otpVerifyLimiter, AuthController.resetPassword);

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
        const expectedNonce = req.cookies?.oauth_nonce;
        res.clearCookie("oauth_nonce", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
        });

        if (req.query.state) {
          let parsedState: any = null;
          try {
            parsedState = JSON.parse(Buffer.from(req.query.state as string, "base64").toString());
          } catch (e) {}

          if (expectedNonce && (!parsedState || parsedState.nonce !== expectedNonce)) {
            return res.redirect(`${frontendUrl}/login?error=csrf_state_mismatch`);
          }

          if (parsedState?.lat && parsedState?.lon) {
            reqWithGps = Object.assign({}, req, {
              headers: { ...req.headers, "x-attendx-lat": parsedState.lat, "x-attendx-lon": parsedState.lon },
            }) as any;
          }
        }
        const { accessToken, refreshToken } = await AuthService.generateTokensForOAuth(user, reqWithGps);
        setRefreshCookie(res, refreshToken);

        // SEC-H02 FIX: Do not pass tokens in URL query (leaks to server logs).
        // Pass both access and refresh tokens in the URL hash fragment (#) so cross-origin/mobile browsers
        // that block third-party cookies still persist refreshToken in local auth store.
        res.redirect(`${frontendUrl}/login#oauth_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}`);
      } catch (error: any) {
        FailureLogRecorder.recordError(error, req);
        console.error("Google Auth Token Generation Error:", error);
        res.redirect(`${frontendUrl}/404?error=${encodeURIComponent(error?.message || "server")}`);
      }
    })(req, res, next);
  }
);

export default router;
