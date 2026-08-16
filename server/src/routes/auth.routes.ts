import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";

const router = Router();

router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/refresh", AuthController.refresh);
router.post("/logout", AuthController.logout);

// Google OAuth routes
import passport from "../middleware/passport";

router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/login?error=domain" }),
  (req, res) => {
    // In a real app, generate JWT and redirect
    res.redirect("/today?login=success");
  }
);

export default router;
