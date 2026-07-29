import { Router } from "express";
import { AttendanceController } from "../controllers/attendance.controller";
import { authenticate } from "../middleware/authenticate";

const router = Router();

router.use(authenticate);

router.get("/today", AttendanceController.getTodayAgenda);
router.post("/mark", AttendanceController.markAttendance);
router.get("/stats", AttendanceController.getSubjectStats);

export default router;
