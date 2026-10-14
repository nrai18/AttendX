import { Router } from "express";
import { SemesterController } from "../controllers/semester.controller";
import { authenticate } from "../middleware/authenticate";

const router = Router();

router.use(authenticate);

router.get("/", SemesterController.list);
router.get("/active", SemesterController.getActive);
router.get("/transition-status", SemesterController.getTransitionStatus);
router.post("/transition", SemesterController.transition);
router.post("/notify-transition", SemesterController.notifyTransition);
router.post("/", SemesterController.create);
router.patch("/:id/activate", SemesterController.activate);
router.delete("/:id", SemesterController.remove);

export default router;
