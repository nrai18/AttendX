import { prisma } from "../lib/prisma";

export class SubjectService {
  static async listSubjects(userId: string, semesterId?: string) {
    let targetSemesterId = semesterId;
    
    if (!targetSemesterId) {
      const activeSemester = await prisma.semester.findFirst({
        where: { userId, isActive: true }
      });
      if (activeSemester) {
        targetSemesterId = activeSemester.id;
      }
    }

    return prisma.subject.findMany({
      where: {
        userId,
        ...(targetSemesterId && { semesterId: targetSemesterId }),
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
    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, userId },
    });

    if (!subject) {
      throw new Error("Subject not found");
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.code !== undefined) updateData.code = data.code;
    if (data.faculty !== undefined) updateData.faculty = data.faculty;
    if (data.colorHex !== undefined) updateData.colorHex = data.colorHex;
    if (data.credits !== undefined) updateData.credits = data.credits ? Number(data.credits) : null;
    if (data.targetAttendance !== undefined) updateData.targetAttendance = data.targetAttendance !== null ? Number(data.targetAttendance) : null;

    return prisma.subject.update({
      where: { id: subject.id },
      data: updateData,
    });
  }

  static async deleteSubject(userId: string, subjectId: string, preserveHistory = true) {
    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, userId },
    });

    if (!subject) {
      throw new Error("Subject not found");
    }

    if (preserveHistory) {
      // Detach slots and mark subject, retaining past attendance logs
      await prisma.timetableSlot.deleteMany({
        where: { subjectId: subject.id },
      });
      // Soft retain: disconnect slots from attendance records
      await prisma.attendance.updateMany({
        where: { subjectId: subject.id },
        data: { timetableSlotId: null },
      });
      return prisma.subject.delete({
        where: { id: subject.id },
      });
    } else {
      // Permanent hard delete (cascades via Prisma schema)
      return prisma.subject.delete({
        where: { id: subject.id },
      });
    }
  }
}
