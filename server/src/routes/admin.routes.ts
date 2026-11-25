import { Router } from "express";
import { AdminController } from "../controllers/admin.controller";
import { authenticate } from "../middleware/authenticate";
import { authorizeRole } from "../middleware/authorizeRole";

const router = Router();

// Strict RBAC: Only admin or superadmin can access these routes
router.use(authenticate, authorizeRole(["admin", "superadmin"]));

router.get("/feedbacks", AdminController.getFeedbackLogs);
router.get("/feedbacks/:id/logs", AdminController.downloadDecryptedLog);
router.post("/broadcast", AdminController.broadcastNotification);

// Academic Calendars & Holiday Lists (2026, 2027, 2028 Even/Odd) Management
router.get("/templates", AdminController.listAcademicTemplates);
router.get("/templates/holidays/:year", AdminController.getHolidayTemplate);
router.put("/templates/holidays/:year", AdminController.updateHolidayTemplate);
router.get("/templates/calendars/:year/:semesterType", AdminController.getAcademicCalendarTemplate);
router.put("/templates/calendars/:year/:semesterType", AdminController.updateAcademicCalendarTemplate);
router.post("/templates/propagate", AdminController.propagateAcademicTemplates);

export default router;
