import { Router } from "express";
import { SystemController } from "../controllers/system.controller";
import { cronAuth } from "../middleware/authenticate";

const router = Router();

router.get("/config", SystemController.getConfig);
router.get("/update", SystemController.getUpdateManifest);
router.get("/download-update", SystemController.downloadUpdate);
router.get("/cron/birthdays", cronAuth, SystemController.triggerBirthdayCron);
router.post("/cron/birthdays", cronAuth, SystemController.triggerBirthdayCron);

export default router;
