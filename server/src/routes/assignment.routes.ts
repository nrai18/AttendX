import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";

const router = Router();


router.get("/", authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const assignments = await prisma.assignment.findMany({
      where: {
        OR: [
          { userId },
          {
            isShared: true,
            classroom: {
              deletedAt: null,
              members: { some: { userId } },
            },
          },
        ],
      },
      orderBy: { deadline: "asc" },
      include: {
        subject: true,
        completions: { where: { userId } },
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
    const userId = (req as any).user.userId;
    const { title, description, deadline, priority, subjectId, classroomId, isShared } = req.body;
    if (classroomId) {
      const membership = await prisma.classroomMember.findUnique({
        where: { classroomId_userId: { classroomId, userId } },
      });
      if (!membership) {
        return res.status(403).json({ error: "Not a member of this classroom" });
      }
    }
    const d = new Date(deadline);
    const validDeadline = !isNaN(d.getTime()) ? d : new Date();
    const assignment = await prisma.assignment.create({
      data: {
        userId,
        title,
        description,
        deadline: validDeadline,
        priority: priority || "medium",
        subjectId: subjectId || null,
        classroomId: classroomId || null,
        isShared: Boolean(isShared && classroomId),
      },
      include: {
        completions: { where: { userId } },
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
    const id = req.params.id as string;
    const userId = (req as any).user.userId;
    const existing = await prisma.assignment.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    const { title, description, deadline, priority, subjectId } = req.body;
    const assignment = await prisma.assignment.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(deadline !== undefined && { deadline: new Date(deadline) }),
        ...(priority !== undefined && { priority }),
        ...(subjectId !== undefined && { subjectId }),
      },
      include: {
        completions: true,
        subject: true,
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
    const assignmentId = req.params.id as string;
    const userId = (req as any).user.userId;

    const targetAssignment = await prisma.assignment.findFirst({
      where: {
        id: assignmentId,
        OR: [
          { userId },
          {
            isShared: true,
            classroom: {
              deletedAt: null,
              members: { some: { userId } },
            },
          },
        ],
      },
      select: { id: true },
    });
    if (!targetAssignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    const existing = await prisma.assignmentCompletion.findUnique({
      where: { assignmentId_userId: { assignmentId, userId } },
    });

    if (existing) {
      await prisma.assignmentCompletion.delete({
        where: { id: existing.id },
      });
      res.json({ completed: false });
    } else {
      await prisma.assignmentCompletion.create({
        data: { assignmentId, userId },
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
