import { Router } from "express";
import { ClassroomController } from "../controllers/classroom.controller";
import { authenticate } from "../middleware/authenticate";

const router = Router();

router.use(authenticate);

router.post("/create", ClassroomController.createClassroom);
router.post("/join", ClassroomController.joinClassroom);
router.get("/", ClassroomController.getUserClassrooms);
router.get("/:id/feed", ClassroomController.getClassroomFeed);

export default router;
