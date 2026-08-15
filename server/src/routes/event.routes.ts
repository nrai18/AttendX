import { Router } from "express";
import multer from "multer";
import { EventController } from "../controllers/event.controller";
import { authenticate } from "../middleware/authenticate";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticate);

router.get("/", EventController.getEvents);
router.post("/ocr-import", upload.single("file"), EventController.ocrImport);
router.post("/save-wizard", EventController.saveWizard);
router.get("/today-status", EventController.getTodayStatus);
router.post("/clear", EventController.clearAllEvents);
router.delete("/all", EventController.clearAllEvents);
router.delete("/", EventController.clearAllEvents);

export default router;
