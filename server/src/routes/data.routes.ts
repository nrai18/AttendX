import { Router } from "express";
import { DataController } from "../controllers/data.controller";
import { authenticate } from "../middleware/authenticate";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticate);

router.get("/export", DataController.exportData);
router.post("/import", upload.single("file"), DataController.importData);

export default router;
