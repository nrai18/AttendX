import { Router } from "express";
import { getUpdates } from "../controllers/system.controller";

const router = Router();
router.get("/update", getUpdates);

export default router;

