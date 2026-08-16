import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { authenticate } from "../middleware/authenticate";

const router = Router();

router.get("/me", authenticate, UserController.getMe);
router.patch("/me", authenticate, UserController.updateMe);
router.post("/reset-data", authenticate, UserController.resetData);
router.post("/reset-subject-attendance", authenticate, UserController.resetSubjectAttendance);
router.post("/reset-all-attendance", authenticate, UserController.resetAllAttendance);
router.post("/reset-timetable", authenticate, UserController.resetTimetable);
router.post("/reset-events", authenticate, UserController.resetEvents);

export default router;
