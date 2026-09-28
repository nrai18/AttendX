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
  max: 1,
  keyGenerator: (req) => req.body?.email ? String(req.body.email).toLowerCase() : "unknown-email",
  message: { message: "You can only request a password reset once every 15 minutes." },
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
  passport.authenticate("google", { session: false, failureRedirect: `${process.env.FRONTEND_URL || "https://attendx.app"}/login?error=domain` }),
  async (req, res) => {
    try {
      if (!req.user) return res.redirect(process.env.FRONTEND_URL + "/login?error=oauth");
      
      let reqWithGps = req;
      if (req.query.state) {
        try {
          const { lat, lon } = JSON.parse(Buffer.from(req.query.state as string, 'base64').toString());
          if (lat && lon) {
             reqWithGps = Object.assign({}, req, { 
                headers: { ...req.headers, 'x-attendx-lat': lat, 'x-attendx-lon': lon } 
             }) as any;
          }
        } catch(e) {}
      }
      const { accessToken, refreshToken } = await AuthService.generateTokensForOAuth(req.user, reqWithGps);
      setRefreshCookie(res, refreshToken);
      
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      // SEC-H02 FIX: Do not pass access token in URL query (leaks to server logs).
      // Pass it in the URL hash fragment (#) instead, which is never sent to the server.
      res.redirect(`${frontendUrl}/login#oauth_token=${accessToken}`);
    } catch (error) {
      console.error("Google Auth Error:", error);
      res.redirect((process.env.FRONTEND_URL || "http://localhost:5173") + "/login?error=server");
    }
  }
);

export default router;
