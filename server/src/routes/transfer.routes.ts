import { Router } from "express";
import { TransferController } from "../controllers/transfer.controller";
import { authenticate, cronAuth } from "../middleware/authenticate";

const router = Router();

router.post("/send", authenticate, TransferController.sendTransfer);
router.post("/retrieve", authenticate, TransferController.retrieveTransfer);
// SEC-03 FIX: cronAuth guards this with x-cron-secret header. No auth = 403.
router.get("/cron/cleanup", cronAuth, TransferController.cleanup);

export default router;
