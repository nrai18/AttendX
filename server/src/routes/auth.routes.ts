import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";

const router = Router();

router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/refresh", AuthController.refresh);
router.post("/logout", AuthController.logout);

// Google OAuth routes
import passport from "../middleware/passport";
import { AuthService } from "../services/auth.service";
import { setRefreshCookie } from "../utils/cookie";

router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/login?error=domain" }),
  async (req, res) => {
    try {
      if (!req.user) return res.redirect(process.env.FRONTEND_URL + "/login?error=oauth");
      
      const { accessToken, refreshToken } = await AuthService.generateTokensForOAuth(req.user);
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
