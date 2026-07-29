import { Router } from "express";
import { TimetableController } from "../controllers/timetable.controller";
import { authenticate } from "../middleware/authenticate";

const router = Router();

router.use(authenticate);

router.get("/:semesterId", TimetableController.getTimetable);
router.post("/slots", TimetableController.createSlot);
router.delete("/slots/:id", TimetableController.deleteSlot);
router.post("/extra-class", TimetableController.addExtraClass);

export default router;
