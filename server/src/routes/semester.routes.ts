import { Router } from "express";
import { SemesterController } from "../controllers/semester.controller";
import { authenticate } from "../middleware/authenticate";

const router = Router();

router.use(authenticate);

router.get("/", SemesterController.list);
router.get("/active", SemesterController.getActive);
router.post("/", SemesterController.create);
router.delete("/:id", SemesterController.remove);

export default router;
