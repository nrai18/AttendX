import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";

const router = Router();


router.get("/", authenticate, async (req, res) => {
  try {
    const assignments = await prisma.assignment.findMany({
      where: { userId: (req as any).user.userId },
      orderBy: { deadline: "asc" },
      include: {
        subject: true,
        completions: true,
      },
    });
    res.json(assignments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch assignments" });
  }
});

router.post("/", authenticate, async (req, res) => {
  try {
    const { title, description, deadline, priority, subjectId } = req.body;
    const assignment = await prisma.assignment.create({
      data: {
        userId: (req as any).user.userId,
        title,
        description,
        deadline: new Date(deadline),
        priority: priority || "medium",
        subjectId,
      },
    });
    res.json(assignment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create assignment" });
  }
});

router.delete("/:id", authenticate, async (req, res) => {
  try {
    await prisma.assignment.delete({
      where: { id: req.params.id, userId: (req as any).user.userId },
    });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete assignment" });
  }
});

router.post("/:id/toggle", authenticate, async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const userId = (req as any).user.userId;
    
    const existing = await prisma.assignmentCompletion.findUnique({
      where: { assignmentId_userId: { assignmentId, userId } }
    });

    if (existing) {
      await prisma.assignmentCompletion.delete({
        where: { id: existing.id }
      });
      res.json({ completed: false });
    } else {
      await prisma.assignmentCompletion.create({
        data: { assignmentId, userId }
      });
      res.json({ completed: true });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to toggle completion" });
  }
});

export default router;
