import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { authenticate } from "../middleware/authenticate";

const router = Router();

router.get("/me", authenticate, UserController.getMe);
router.patch("/me", authenticate, UserController.updateMe);
router.get("/onboarding-status", authenticate, UserController.getOnboardingStatus);
router.post("/reset-data", authenticate, UserController.resetData);
router.post("/reset-subject-attendance", authenticate, UserController.resetSubjectAttendance);
router.post("/reset-all-attendance", authenticate, UserController.resetAllAttendance);
router.post("/reset-timetable", authenticate, UserController.resetTimetable);
router.post("/reset-events", authenticate, UserController.resetEvents);

// Linked Devices / Sessions
router.get("/sessions", authenticate, UserController.getSessions);
router.delete("/sessions/:sessionId", authenticate, UserController.revokeSession);
router.delete("/sessions", authenticate, UserController.revokeAllOtherSessions);

export default router;
