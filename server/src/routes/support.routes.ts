import { Router } from "express";
import { SupportController } from "../controllers/support.controller";
import { authenticate } from "../middleware/authenticate";

const router = Router();
router.use(authenticate);

router.post("/feedback", SupportController.submitFeedback);

export default router;
