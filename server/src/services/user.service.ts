import { prisma } from "../lib/prisma";

export class UserService {
  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        rollNumber: true,
        avatarUrl: true,
        role: true,
        department: true,
        batch: true,
        targetAttendance: true,
        theme: true,
        createdAt: true,
      },
    });
    if (!user) throw new Error("User not found");
    return user;
  }

  static async updateProfile(userId: string, data: any) {
    return prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        rollNumber: true,
        avatarUrl: true,
        role: true,
        department: true,
        batch: true,
        targetAttendance: true,
        theme: true,
      },
    });
  }
}
