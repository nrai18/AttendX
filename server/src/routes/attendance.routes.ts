import { Router } from "express";
import { AttendanceController } from "../controllers/attendance.controller";
import { authenticate } from "../middleware/authenticate";

const router = Router();

router.use(authenticate);

router.get("/today", AttendanceController.getTodayAgenda);
router.post("/mark", AttendanceController.markAttendance);
router.delete("/mark", AttendanceController.markAttendance); // Catch-all if frontend switched to DELETE
router.get("/stats", AttendanceController.getSubjectStats);
router.get("/stats/:subjectId", AttendanceController.getSingleSubjectStats);
router.post("/boundaries", AttendanceController.updateBoundaries);
router.get("/calendar", AttendanceController.getMonthlyCalendar);
router.get("/logs", AttendanceController.getAttendanceLogs);
router.get("/insights", AttendanceController.getPredictiveInsights);

export default router;
