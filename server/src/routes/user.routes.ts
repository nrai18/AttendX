import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { authenticate } from "../middleware/authenticate";

const router = Router();

router.get("/me", authenticate, UserController.getMe);
router.patch("/me", authenticate, UserController.updateMe);
router.post("/reset-data", authenticate, UserController.resetData);

export default router;
