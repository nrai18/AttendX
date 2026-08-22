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

  static async mergeSubjects(userId: string, merges: { targetId: string, sourceId: string }[]) {
    const results = [];
    
    // Execute merges sequentially to avoid deadlocks
    for (const merge of merges) {
      const { targetId, sourceId } = merge;
      
      if (sourceId === targetId) continue;
      
      try {
        await prisma.$transaction(async (tx) => {
          // Verify both exist and belong to the user
          const sourceSub = await tx.subject.findFirst({ where: { id: sourceId, userId } });
          const targetSub = await tx.subject.findFirst({ where: { id: targetId, userId } });
          
          if (!sourceSub || !targetSub) {
            throw new Error(`Subject not found for merge: ${sourceId} -> ${targetId}`);
          }
          
          // 1. Move Attendance Logs
          const sourceLogs = await tx.attendance.findMany({ where: { subjectId: sourceId } });
          const targetLogs = await tx.attendance.findMany({ where: { subjectId: targetId } });
          
          const sourceSlots = await tx.timetableSlot.findMany({ where: { subjectId: sourceId } });
          const targetSlots = await tx.timetableSlot.findMany({ where: { subjectId: targetId } });
          const combinedDaysOfWeek = new Set([...sourceSlots.map(s => s.dayOfWeek), ...targetSlots.map(s => s.dayOfWeek)]);
          
          for (const log of sourceLogs) {
            // Handle collision strictly against unique constraint: `[userId, subjectId, date, timetableSlotId]`
            const collision = targetLogs.find(t => 
              t.date.getTime() === log.date.getTime() && 
              t.timetableSlotId === log.timetableSlotId
            );
            
            if (collision) {
              if (collision.status === "void" && log.status !== "void") {
                await tx.attendance.update({
                  where: { id: collision.id },
                  data: { status: log.status, remarks: log.remarks }
                });
              }
              await tx.attendance.delete({ where: { id: log.id } });
            } else {
              const dayOfWeek = log.date.getDay() === 0 ? 6 : log.date.getDay() - 1;
              const hasSlot = combinedDaysOfWeek.has(dayOfWeek);
              
              await tx.attendance.update({
                where: { id: log.id },
                data: { 
                  subjectId: targetId,
                  ...(hasSlot ? {} : { remarks: "Extra class from merge" })
                }
              });
            }
          }
          
          // 2. Transfer all other relational data to targetId
          await tx.timetableSlot.updateMany({
            where: { subjectId: sourceId },
            data: { subjectId: targetId }
          });
          
          await tx.timetableOverride.updateMany({
            where: { subjectId: sourceId },
            data: { subjectId: targetId }
          });
          
          await tx.assignment.updateMany({
            where: { subjectId: sourceId },
            data: { subjectId: targetId }
          });
          
          await tx.note.updateMany({
            where: { subjectId: sourceId },
            data: { subjectId: targetId }
          });
          
          await tx.export.updateMany({
            where: { subjectId: sourceId },
            data: { subjectId: targetId }
          });
          
          // 3. Mark past unmarked slots as OFF for the newly combined subject
          const semester = await tx.semester.findUnique({ where: { id: targetSub.semesterId } });
          if (semester) {
            const start = new Date(semester.startDate);
            const today = new Date();
            today.setHours(0,0,0,0);
            
            const allTargetSlots = await tx.timetableSlot.findMany({ where: { subjectId: targetId } });
            const allOverrides = await tx.timetableOverride.findMany({ where: { semesterId: targetSub.semesterId } });
            const allTargetAtt = await tx.attendance.findMany({ where: { subjectId: targetId } });
            
            for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
              const targetDate = new Date(d);
              const dayOfWeek = targetDate.getDay() === 0 ? 6 : targetDate.getDay() - 1;
              const slotsForDay = allTargetSlots.filter(s => s.dayOfWeek === dayOfWeek);
              const overridesForDay = allOverrides.filter(o => 
                o.date.getTime() === targetDate.getTime() && 
                (o.subjectId === targetId || o.subjectId === null)
              );
              
              for (const slot of slotsForDay) {
                const relatedOverride = overridesForDay.find(o => o.originalSlotId === slot.id);
                if (relatedOverride && (relatedOverride.overrideType === "holiday" || relatedOverride.overrideType === "cancelled")) {
                  continue;
                }
                const slotIdToMatch = relatedOverride ? null : slot.id;
                const overrideIdToMatch = relatedOverride ? relatedOverride.id : null;
                const exactMatch = allTargetAtt.find(a => a.date.getTime() === targetDate.getTime() && 
                  ((slotIdToMatch && a.timetableSlotId === slotIdToMatch) || 
                   (overrideIdToMatch && a.overrideId === overrideIdToMatch)));
                const subjectMatch = allTargetAtt.find(a => a.date.getTime() === targetDate.getTime() && !a.timetableSlotId && !a.overrideId);
                
                if (!exactMatch && !subjectMatch) {
                  await tx.attendance.create({
                    data: {
                      userId,
                      subjectId: targetId,
                      timetableSlotId: slotIdToMatch,
                      overrideId: overrideIdToMatch,
                      date: targetDate,
                      status: "off",
                      remarks: "Auto-marked off (merged past class)"
                    }
                  });
                }
              }
              const extraClasses = overridesForDay.filter(o => o.overrideType === "extra_class" && o.subjectId === targetId);
              for (const extra of extraClasses) {
                 const exactMatch = allTargetAtt.find(a => a.date.getTime() === targetDate.getTime() && a.overrideId === extra.id);
                 if (!exactMatch) {
                     await tx.attendance.create({
                        data: {
                          userId,
                          subjectId: targetId,
                          overrideId: extra.id,
                          date: targetDate,
                          status: "off",
                          remarks: "Auto-marked off (merged past class)"
                        }
                     });
                 }
              }
            }
          }
          
          // 4. Delete the duplicate subject
          await tx.subject.delete({ where: { id: sourceId } });
        });
        
        results.push({ targetId, sourceId, merged: true });
      } catch (error: any) {
        console.error(`Failed to merge ${sourceId} into ${targetId}:`, error);
        throw error; // Let the controller catch it for the HTTP response
      }
    }
    
    return results;
  }
}
