import { Router } from "express";
import rateLimit from "express-rate-limit";
import { TransferController } from "../controllers/transfer.controller";
import { authenticate, cronAuth } from "../middleware/authenticate";

const router = Router();

const retrieveLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 25,
  message: { message: "Too many transfer code attempts. Please wait 5 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/send", authenticate, TransferController.sendTransfer);
router.post("/retrieve", authenticate, retrieveLimiter, TransferController.retrieveTransfer);
// SEC-03 FIX: cronAuth guards this with x-cron-secret header. No auth = 403.
router.get("/cron/cleanup", cronAuth, TransferController.cleanup);

export default router;
