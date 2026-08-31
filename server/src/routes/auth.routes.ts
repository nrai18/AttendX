import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import rateLimit from "express-rate-limit";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: "Too many login attempts from this IP, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/register", loginLimiter, AuthController.register);
router.post("/login", loginLimiter, AuthController.login);
router.post("/refresh", AuthController.refresh);
router.post("/logout", AuthController.logout);

// Google OAuth routes (Native Mobile)
router.post("/google/native", loginLimiter, AuthController.googleNative);

// Google OAuth routes
import passport from "../middleware/passport";
import { AuthService } from "../services/auth.service";
import { setRefreshCookie } from "../utils/cookie";

router.get("/google", (req, res, next) => {
  const { lat, lon } = req.query;
  const state = (lat && lon) ? Buffer.from(JSON.stringify({ lat, lon })).toString('base64') : undefined;
  passport.authenticate("google", { scope: ["profile", "email"], state })(req, res, next);
});

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/login?error=domain" }),
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
      res.redirect(`${frontendUrl}/login?token=${accessToken}`);
    } catch (error) {
      console.error("Google Auth Error:", error);
      res.redirect((process.env.FRONTEND_URL || "http://localhost:5173") + "/login?error=server");
    }
  }
);

export default router;
