import { Router } from "express";
import { ClassroomController } from "../controllers/classroom.controller";
import { authenticate } from "../middleware/authenticate";
import rateLimit from "express-rate-limit";

const router = Router();

const joinClassroomLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Max 20 join attempts per 15 min to prevent brute-forcing 6-character codes
  message: { message: "Too many classroom join attempts. Please wait 15 minutes before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authenticate);

router.post("/create", ClassroomController.createClassroom);
router.post("/join", joinClassroomLimiter, ClassroomController.joinClassroom);
router.get("/", ClassroomController.getUserClassrooms);
router.get("/:id/feed", ClassroomController.getClassroomFeed);
router.get("/:id/members", ClassroomController.getClassroomMembers);
router.patch("/:id", ClassroomController.updateClassroom);
router.patch("/:id/permissions", ClassroomController.updateBroadcastPermissions);
router.post("/:id/announcements", ClassroomController.createAnnouncement);
router.post("/:id/polls", ClassroomController.createPoll);
router.post("/:id/polls/:pollId/vote", ClassroomController.castPollVote);
router.post("/:id/polls/:pollId/stop", ClassroomController.stopPoll);
router.get("/:id/polls/:pollId/votes", ClassroomController.getPollVotes);
router.delete("/:id/polls/:pollId", ClassroomController.deletePoll);
router.delete("/:id/leave", ClassroomController.leaveClassroom);
router.delete("/:id", ClassroomController.deleteClassroom);

export default router;
