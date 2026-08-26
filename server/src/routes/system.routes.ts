import { Router } from "express";
import { SystemController } from "../controllers/system.controller";

const router = Router();

router.get("/update", SystemController.getUpdateManifest);
router.get("/download-update", SystemController.downloadUpdate);

export default router;
