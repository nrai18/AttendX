import { prisma } from "../lib/prisma";
import { PushNotificationService } from "./push_notification.service";

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

    if (!classroom || classroom.deletedAt) {
      throw new Error("Invalid join code or this classroom has been disbanded");
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
      isDeleted: Boolean(m.classroom.deletedAt),
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
      include: {
        classroom: {
          select: {
            id: true,
            name: true,
            section: true,
            department: true,
            batch: true,
            deletedAt: true,
            createdById: true,
            broadcastPermission: true,
            allowedPosterIds: true,
            deniedPosterIds: true,
          },
        },
      },
    });

    if (!member) {
      throw new Error("Access denied: Not a member of this classroom");
    }

    const isCrOrAdmin = member.role === "admin" || member.classroom.createdById === userId;
    const perm = member.classroom.broadcastPermission || "admins";
    const allowedList = member.classroom.allowedPosterIds || [];
    const deniedList = member.classroom.deniedPosterIds || [];

    let canPost = false;
    if (isCrOrAdmin) {
      canPost = true;
    } else if (perm === "everyone") {
      canPost = true;
    } else if (perm === "only_selected") {
      canPost = allowedList.includes(userId);
    } else if (perm === "everyone_except") {
      canPost = !deniedList.includes(userId);
    } else {
      canPost = false;
    }

    const announcements = await prisma.announcement.findMany({
      where: { classroomId },
      include: {
        createdBy: {
          select: { name: true },
        },
      },
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 50,
    });

    const assignments = await prisma.assignment.findMany({
      where: { classroomId },
      orderBy: { deadline: 'asc' },
      take: 20,
    });

    return {
      role: member.role,
      classroom: member.classroom,
      canPost,
      broadcastPermission: perm,
      allowedPosterIds: allowedList,
      deniedPosterIds: deniedList,
      isDeleted: Boolean(member.classroom.deletedAt),
      announcements: announcements.map((ann) => ({
        ...ann,
        content: ann.body,
        importance: ann.isPinned ? "high" : "low",
      })),
      assignments,
    };
  }

  /**
   * Retrieves all enrolled peers/members of a classroom with their profile details.
   */
  static async getClassroomMembers(userId: string, classroomId: string) {
    const isEnrolled = await prisma.classroomMember.findUnique({
      where: {
        classroomId_userId: {
          classroomId,
          userId,
        },
      },
    });

    if (!isEnrolled) {
      const err = new Error("Access denied: You must be enrolled in this classroom to view members");
      (err as any).status = 403;
      throw err;
    }

    const members = await prisma.classroomMember.findMany({
      where: { classroomId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            rollNumber: true,
            department: true,
            batch: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' }, // 'admin' comes before 'member'
        { joinedAt: 'asc' },
      ],
    });

    return {
      classroomId,
      totalCount: members.length,
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        name: m.user.name,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
        rollNumber: m.user.rollNumber,
        department: m.user.department,
        batch: m.user.batch,
      })),
    };
  }

  /**
   * Updates broadcasting permissions for a classroom (CR/Admin only).
   * Supports: "admins" | "everyone" | "only_selected" | "everyone_except"
   */
  static async updateBroadcastPermissions(
    userId: string,
    classroomId: string,
    data: {
      broadcastPermission: "admins" | "everyone" | "only_selected" | "everyone_except";
      allowedPosterIds?: string[];
      deniedPosterIds?: string[];
    }
  ) {
    const member = await prisma.classroomMember.findUnique({
      where: {
        classroomId_userId: {
          classroomId,
          userId,
        },
      },
    });

    if (!member || member.role !== "admin") {
      const err = new Error("Only classroom admins can adjust broadcast permissions");
      (err as any).status = 403;
      throw err;
    }

    const validModes = ["admins", "everyone", "only_selected", "everyone_except"];
    const mode = (validModes.includes(data.broadcastPermission) ? data.broadcastPermission : "admins") as any;

    const updated = await prisma.classroom.update({
      where: { id: classroomId },
      data: {
        broadcastPermission: mode,
        allowedPosterIds: Array.isArray(data.allowedPosterIds) ? data.allowedPosterIds : [],
        deniedPosterIds: Array.isArray(data.deniedPosterIds) ? data.deniedPosterIds : [],
      },
      select: {
        id: true,
        broadcastPermission: true,
        allowedPosterIds: true,
        deniedPosterIds: true,
      },
    });

    return updated;
  }

  /**
   * Creates an announcement for a classroom (CR/Admin or authorized member).
   */
  static async createAnnouncement(userId: string, classroomId: string, data: {
    title: string;
    content: string;
    importance?: "low" | "medium" | "high";
  }) {
    const member = await prisma.classroomMember.findUnique({
      where: {
        classroomId_userId: {
          classroomId,
          userId,
        },
      },
      include: {
        classroom: true,
      },
    });

    if (!member) {
      const err = new Error("Access denied: You are not enrolled in this classroom");
      (err as any).status = 403;
      throw err;
    }

    if (member.classroom.deletedAt) {
      const err = new Error("Cannot post announcements in a disbanded classroom");
      (err as any).status = 400;
      throw err;
    }

    const isCrOrAdmin = member.role === "admin" || member.classroom.createdById === userId;
    const perm = member.classroom.broadcastPermission || "admins";
    const allowedList = member.classroom.allowedPosterIds || [];
    const deniedList = member.classroom.deniedPosterIds || [];

    let canPost = false;
    if (isCrOrAdmin) {
      canPost = true;
    } else if (perm === "everyone") {
      canPost = true;
    } else if (perm === "only_selected") {
      canPost = allowedList.includes(userId);
    } else if (perm === "everyone_except") {
      canPost = !deniedList.includes(userId);
    } else {
      canPost = false;
    }

    if (!canPost) {
      const err = new Error("Only authorized members can post announcements in this classroom");
      (err as any).status = 403;
      throw err;
    }

    const isHigh = data.importance === "high";

    const announcement = await prisma.announcement.create({
      data: {
        classroomId,
        title: data.title,
        body: data.content,
        category: "academic",
        isPinned: isHigh,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: { name: true },
        },
        classroom: {
          select: { name: true, section: true },
        },
      },
    });

    // Send high-priority FCM notification asynchronously to all enrolled members
    const importancePrefix = data.importance === "high" ? "🚨 Urgent Notice: " : data.importance === "medium" ? "📢 Notice: " : "";
    const classroomTag = announcement.classroom?.section 
      ? `${announcement.classroom.name} (Sec ${announcement.classroom.section})` 
      : announcement.classroom?.name || "Classroom";
    const pushTitle = `${importancePrefix}${classroomTag}`;
    const pushBody = `${data.title} — ${data.content}`.slice(0, 150);

    PushNotificationService.sendToClassroomMembers(
      classroomId,
      userId,
      pushTitle,
      pushBody,
      {
        type: "classroom_announcement",
        classroomId,
        announcementId: announcement.id,
        importance: data.importance || "low",
        route: `/classrooms/${classroomId}`,
        url: `/classrooms/${classroomId}`,
      }
    ).catch((err) => {
      console.error("[ClassroomAnnouncement] FCM push dispatch error:", err);
    });

    return {
      ...announcement,
      content: announcement.body,
      importance: data.importance || (announcement.isPinned ? "high" : "low"),
    };
  }

  /**
   * Disbands/deletes a classroom (CR/Admin only).
   * Notifies all enrolled peers via FCM push and marks the classroom as disbanded.
   */
  static async deleteClassroom(userId: string, classroomId: string) {
    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!classroom) {
      throw new Error("Classroom not found");
    }

    const currentMember = classroom.members.find((m) => m.userId === userId);
    if (classroom.createdById !== userId && (!currentMember || currentMember.role !== "admin")) {
      const err = new Error("Only classroom admins can delete or disband this classroom");
      (err as any).status = 403;
      throw err;
    }

    // Set deletedAt timestamp to mark as disbanded
    await prisma.classroom.update({
      where: { id: classroomId },
      data: { deletedAt: new Date() },
    });

    // Notify all enrolled peers via high-priority FCM
    const peers = classroom.members.filter((m) => m.userId !== userId);
    if (peers.length > 0) {
      const adminName = classroom.createdBy?.name || "Class Representative";
      const tag = classroom.section ? `${classroom.name} (Sec ${classroom.section})` : classroom.name;
      const pushTitle = `⚠️ Classroom Disbanded: ${tag}`;
      const pushBody = `${adminName} has disbanded this section hub. Please remove it from your dashboard.`;

      PushNotificationService.sendToClassroomMembers(
        classroomId,
        userId,
        pushTitle,
        pushBody,
        {
          type: "classroom_deleted",
          classroomId,
          classroomName: classroom.name,
          route: "/classrooms",
          url: "/classrooms",
        }
      ).catch((err) => {
        console.error("[DeleteClassroom] FCM notification dispatch error:", err);
      });
    }

    // Remove the admin's own membership so it's instantly cleared from their dashboard
    await prisma.classroomMember.deleteMany({
      where: {
        classroomId,
        userId,
      },
    });

    return {
      success: true,
      message: "Classroom disbanded and enrolled peers notified",
    };
  }

  /**
   * Leaves or removes a classroom from the user's dashboard (peers cleanup).
   */
  static async leaveClassroom(userId: string, classroomId: string) {
    await prisma.classroomMember.deleteMany({
      where: {
        classroomId,
        userId,
      },
    });

    // If classroom was already marked deleted and all members have cleaned up, purge it
    const remaining = await prisma.classroomMember.count({
      where: { classroomId },
    });
    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      select: { deletedAt: true },
    });

    if (classroom?.deletedAt && remaining === 0) {
      await prisma.classroom.delete({ where: { id: classroomId } }).catch(() => {});
    }

    return {
      success: true,
      message: "Classroom removed from your dashboard",
    };
  }
}
