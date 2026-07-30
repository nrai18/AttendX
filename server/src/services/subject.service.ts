import { prisma } from "../lib/prisma";

export class SubjectService {
  static async listSubjects(userId: string, semesterId?: string) {
    return prisma.subject.findMany({
      where: {
        userId,
        ...(semesterId && { semesterId }),
      },
      include: {
        timetableSlots: true,
        _count: { select: { attendance: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  static async createSubject(userId: string, data: any) {
    let semesterId = data.semesterId;

    if (!semesterId) {
      let activeSemester = await prisma.semester.findFirst({
        where: { userId, isActive: true }
      });
      
      if (!activeSemester) {
        // Auto-create a default semester for the dev user
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 6); // 6 months from now
        
        activeSemester = await prisma.semester.create({
          data: {
            userId,
            name: "Current Semester",
            startDate,
            endDate,
            isActive: true,
          }
        });
      }
      semesterId = activeSemester.id;
    }

    return prisma.subject.create({
      data: {
        userId,
        semesterId,
        name: data.name,
        code: data.code,
        credits: data.credits ? Number(data.credits) : undefined,
        faculty: data.faculty,
        colorHex: data.colorHex || "#8b5cf6",
        targetAttendance: data.targetAttendance ? Number(data.targetAttendance) : undefined,
      },
    });
  }

  static async updateSubject(userId: string, subjectId: string, data: any) {
    return prisma.subject.update({
      where: { id: subjectId, userId },
      data,
    });
  }

  static async deleteSubject(userId: string, subjectId: string, preserveHistory = true) {
    if (preserveHistory) {
      // Detach slots and mark subject, retaining past attendance logs
      await prisma.timetableSlot.deleteMany({
        where: { subjectId },
      });
      // Soft retain: disconnect slots from attendance records
      await prisma.attendance.updateMany({
        where: { subjectId },
        data: { timetableSlotId: null },
      });
      return prisma.subject.delete({
        where: { id: subjectId, userId },
      });
    } else {
      // Permanent hard delete (cascades via Prisma schema)
      return prisma.subject.delete({
        where: { id: subjectId, userId },
      });
    }
  }
}
