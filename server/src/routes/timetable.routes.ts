import { Router } from "express";
import { TimetableController } from "../controllers/timetable.controller";
import { authenticate } from "../middleware/authenticate";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticate);

router.get("/export/:semesterId", TimetableController.exportTimetable);
router.post("/import/:semesterId", TimetableController.importTimetable);
router.get("/:semesterId", TimetableController.getTimetable);
router.post("/slots", TimetableController.createSlot);
router.patch("/slots/:id", TimetableController.updateSlot);
router.post("/slots/swap", TimetableController.swapSlots);
router.delete("/slots/:id", TimetableController.deleteSlot);
router.post("/extra-class", TimetableController.addExtraClass);
router.delete("/extra-class/:id", TimetableController.deleteExtraClass);
router.post("/ocr-import", upload.single("image"), TimetableController.ocrImport);
router.post("/save-wizard", TimetableController.saveWizard);
router.delete("/semester/:semesterId/safe", TimetableController.safeDeleteTimetable);

export default router;
