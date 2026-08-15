import { prisma } from "../lib/prisma";

export class ClassroomService {
  /**
   * Generates a random 6-character alphanumeric code
   */
  private static generateJoinCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Creates a new classroom and adds the creator as an admin member.
   */
  static async createClassroom(userId: string, data: {
    name: string;
    section?: string;
    department?: string;
    batch?: string;
    semesterId?: string;
  }) {
    let joinCode = "";
    let isUnique = false;

    // Ensure the join code is unique
    while (!isUnique) {
      joinCode = this.generateJoinCode();
      const existing = await prisma.classroom.findUnique({ where: { joinCode } });
      if (!existing) isUnique = true;
    }

    // Create classroom and the initial admin member in a transaction
    return prisma.$transaction(async (tx) => {
      const classroom = await tx.classroom.create({
        data: {
          ...data,
          joinCode,
          createdById: userId,
        },
      });

      await tx.classroomMember.create({
        data: {
          classroomId: classroom.id,
          userId,
          role: "admin",
        },
      });

      return classroom;
    });
  }

  /**
   * Joins an existing classroom using a join code.
   */
  static async joinClassroom(userId: string, joinCode: string) {
    const classroom = await prisma.classroom.findUnique({
      where: { joinCode: joinCode.toUpperCase() },
    });

    if (!classroom) {
      throw new Error("Invalid join code");
    }

    const existingMember = await prisma.classroomMember.findUnique({
      where: {
        classroomId_userId: {
          classroomId: classroom.id,
          userId,
        },
      },
    });

    if (existingMember) {
      throw new Error("You are already a member of this classroom");
    }

    return prisma.classroomMember.create({
      data: {
        classroomId: classroom.id,
        userId,
        role: "member",
      },
      include: {
        classroom: true,
      }
    });
  }

  /**
   * Gets all classrooms the user is a member of.
   */
  static async getUserClassrooms(userId: string) {
    const members = await prisma.classroomMember.findMany({
      where: { userId },
      include: {
        classroom: {
          include: {
            _count: {
              select: { members: true },
            },
            createdBy: {
              select: { name: true, email: true },
            }
          }
        },
      },
      orderBy: {
        joinedAt: 'desc'
      }
    });

    return members.map(m => ({
      ...m.classroom,
      userRole: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  /**
   * Gets the feed (announcements and assignments) for a specific classroom.
   */
  static async getClassroomFeed(userId: string, classroomId: string) {
    // Verify membership
    const member = await prisma.classroomMember.findUnique({
      where: {
        classroomId_userId: {
          classroomId,
          userId,
        },
      },
    });

    if (!member) {
      throw new Error("Access denied: Not a member of this classroom");
    }

    const announcements = await prisma.announcement.findMany({
      where: { classroomId },
      include: {
        createdBy: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const assignments = await prisma.assignment.findMany({
      where: { classroomId },
      orderBy: { deadline: 'asc' },
      take: 20,
    });

    return {
      role: member.role,
      announcements,
      assignments,
    };
  }
}
