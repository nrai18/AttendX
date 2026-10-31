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
    const d = new Date(deadline);
    const validDeadline = !isNaN(d.getTime()) ? d : new Date();
    const assignment = await prisma.assignment.create({
      data: {
        userId: (req as any).user.userId,
        title,
        description,
        deadline: validDeadline,
        priority: priority || "medium",
        subjectId,
      },
      include: {
        completions: true,
        subject: true,
      },
    });
    res.json(assignment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create assignment" });
  }
});

const updateHandler = async (req: any, res: any) => {
  try {
    const { title, description, deadline, priority, subjectId } = req.body;
    const assignment = await prisma.assignment.update({
      where: { id: (req.params.id as string), userId: (req as any).user.userId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(deadline !== undefined && { deadline: new Date(deadline) }),
        ...(priority !== undefined && { priority }),
        ...(subjectId !== undefined && { subjectId }),
      },
    });
    res.json(assignment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update assignment" });
  }
};

router.put("/:id", authenticate, updateHandler);
router.patch("/:id", authenticate, updateHandler);

router.delete("/:id", authenticate, async (req, res) => {
  try {
    const id = req.params.id as string;
    const userId = (req as any).user.userId;
    await prisma.assignmentCompletion.deleteMany({
      where: { assignmentId: id },
    });
    const result = await prisma.assignment.deleteMany({
      where: { id, userId },
    });
    res.json({ success: true, count: result.count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete assignment" });
  }
});

const toggleHandler = async (req: any, res: any) => {
  try {
    const assignmentId = (req.params.id as string);
    const userId = (req as any).user.userId;
    
    const existing = await prisma.assignmentCompletion.findUnique({
      where: { assignmentId_userId: { assignmentId: assignmentId as string, userId } }
    });

    if (existing) {
      await prisma.assignmentCompletion.delete({
        where: { id: existing.id }
      });
      res.json({ completed: false });
    } else {
      await prisma.assignmentCompletion.create({
        data: { assignmentId: assignmentId as string, userId }
      });
      res.json({ completed: true });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to toggle completion" });
  }
};

router.post("/:id/toggle", authenticate, toggleHandler);
router.post("/:id/complete", authenticate, toggleHandler);

export default router;
