import { Router } from "express";
import { TransferController } from "../controllers/transfer.controller";
import { authenticate } from "../middleware/authenticate";

const router = Router();

router.post("/send", authenticate, TransferController.sendTransfer);
router.post("/retrieve", authenticate, TransferController.retrieveTransfer);
router.get("/cron/cleanup", TransferController.cleanup);

export default router;
