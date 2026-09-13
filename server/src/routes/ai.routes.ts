import { Router } from "express";
import { AiController } from "../controllers/ai.controller";
import { authenticate } from "../middleware/authenticate";

const router = Router();

router.post("/chat", authenticate, AiController.chat);

export default router;
