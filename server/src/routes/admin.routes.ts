import { Router } from "express";
import { AdminController } from "../controllers/admin.controller";
import { authenticate } from "../middleware/authenticate";
import { authorizeRole } from "../middleware/authorizeRole";

const router = Router();

// Strict RBAC: Only admin or superadmin can access these routes
router.use(authenticate, authorizeRole(["admin", "superadmin"]));

router.get("/feedbacks", AdminController.getFeedbackLogs);
router.get("/feedbacks/:id/logs", AdminController.downloadDecryptedLog);

export default router;
