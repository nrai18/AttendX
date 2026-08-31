import { Router } from "express";
import { TimetableController } from "../controllers/timetable.controller";
import { authenticate } from "../middleware/authenticate";
import multer from "multer";

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

router.use(authenticate);

router.get("/:semesterId", TimetableController.getTimetable);
router.post("/slots", TimetableController.createSlot);
router.patch("/slots/:id", TimetableController.updateSlot);
router.post("/slots/swap", TimetableController.swapSlots);
router.delete("/slots/:id", TimetableController.deleteSlot);
router.post("/slots/delete-batch", TimetableController.deleteSlotsBatch);
router.delete("/semester/:semesterId/subject/:subjectId/slots", TimetableController.deleteSubjectSlots);
router.post("/extra-class", TimetableController.addExtraClass);
router.delete("/extra-class/:id", TimetableController.deleteExtraClass);
router.post("/ocr-import", upload.any(), TimetableController.ocrImport);
router.post("/save-wizard", TimetableController.saveWizard);
router.get("/export/:semesterId", TimetableController.exportTimetable);
router.post("/import/:semesterId", TimetableController.importTimetable);
router.delete("/semester/:semesterId/safe", TimetableController.safeDeleteTimetable);
router.delete("/clear", TimetableController.safeDeleteTimetable);
router.delete("/safe", TimetableController.safeDeleteTimetable);
router.delete("/", TimetableController.safeDeleteTimetable);

export default router;
