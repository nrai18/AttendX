import { prisma } from "../lib/prisma";
import { CacheService } from "./cache.service";

export class SubjectService {
  static async listSubjects(userId: string, semesterId?: string) {
    let targetSemesterId = semesterId;
    
    if (!targetSemesterId) {
      const activeSemester = await CacheService.getOrSet(
        userId,
        "semesters:active",
        () =>
          prisma.semester.findFirst({
            where: { userId, isActive: true }
          })
      );
      if (activeSemester) {
        targetSemesterId = activeSemester.id;
      }
    }

    if (targetSemesterId) {
      const fullSubjects = await CacheService.getOrSet(
        userId,
        `subjects:full:${targetSemesterId}`,
        () =>
          prisma.subject.findMany({
            where: {
              userId,
              semesterId: targetSemesterId,
            },
            include: {
              attendance: true,
              semester: true,
              timetableSlots: true,
            },
          })
      );
      return [...fullSubjects]
        .sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""))
        .map((s: any) => ({
          ...s,
          _count: { attendance: Array.isArray(s.attendance) ? s.attendance.length : 0 },
        }));
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

    if (semesterId) {
      const ownsSemester = await prisma.semester.findFirst({
        where: { id: semesterId, userId }
      });
      if (!ownsSemester) throw new Error("Forbidden: Semester does not belong to user");
    } else {
      let activeSemester = await prisma.semester.findFirst({
        where: { userId, isActive: true }
      });
      
      if (!activeSemester) {
        throw new Error("No active semester found. Please create and activate a semester first.");
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
      // Ghost subject: Already deleted from subjects table. Clean up any dangling references.
      await prisma.attendance.deleteMany({ where: { subjectId, userId } }).catch(() => null);
      await prisma.timetableSlot.deleteMany({ where: { subjectId, semester: { userId } } }).catch(() => null);
      await prisma.timetableOverride.deleteMany({ where: { subjectId, semester: { userId } } }).catch(() => null);
      return { success: true, message: "Ghost subject cleaned up successfully", ghost: true };
    }

    // Safely decouple or clean up references that do not cascade automatically
    try {
      const subjectSlots = await prisma.timetableSlot.findMany({
        where: { subjectId: subject.id },
        select: { id: true },
      });
      const slotIds = subjectSlots.map((s) => s.id);

      const subjectOverrides = await prisma.timetableOverride.findMany({
        where: {
          OR: [
            { subjectId: subject.id },
            ...(slotIds.length > 0 ? [{ originalSlotId: { in: slotIds } }] : []),
          ],
        },
        select: { id: true },
      });
      const overrideIds = subjectOverrides.map((o) => o.id);

      // Detach or delete attendance references BEFORE deleting overrides and slots
      if (preserveHistory) {
        await prisma.attendance.updateMany({
          where: {
            OR: [
              { subjectId: subject.id },
              ...(slotIds.length > 0 ? [{ timetableSlotId: { in: slotIds } }] : []),
              ...(overrideIds.length > 0 ? [{ overrideId: { in: overrideIds } }] : []),
            ],
          },
          data: { timetableSlotId: null, overrideId: null },
        });
      } else {
        await prisma.attendance.deleteMany({
          where: {
            OR: [
              { subjectId: subject.id },
              ...(slotIds.length > 0 ? [{ timetableSlotId: { in: slotIds } }] : []),
              ...(overrideIds.length > 0 ? [{ overrideId: { in: overrideIds } }] : []),
            ],
          },
        });
      }

      if (overrideIds.length > 0) {
        await prisma.timetableOverride.deleteMany({ where: { id: { in: overrideIds } } });
      }
      await Promise.all([
        prisma.timetableSlot.deleteMany({ where: { subjectId: subject.id } }),
        prisma.assignment.updateMany({ where: { subjectId: subject.id }, data: { subjectId: null } }),
        prisma.note.updateMany({ where: { subjectId: subject.id }, data: { subjectId: null } }),
        prisma.export.deleteMany({ where: { subjectId: subject.id } }),
      ]);
    } catch (e) {}

    return prisma.subject.delete({
      where: { id: subject.id },
    });
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
          
          // 1. Process Timetable Slots & Slot Deduplication
          const sourceSlots = await tx.timetableSlot.findMany({ where: { subjectId: sourceId } });
          const targetSlots = await tx.timetableSlot.findMany({ where: { subjectId: targetId } });
          
          const normTime = (t?: string) => (t || "").trim().padStart(5, "0");
          const slotMapping = new Map<string, string>(); // sourceSlotId -> targetSlotId

          for (const sSlot of sourceSlots) {
            // Find duplicate slot in target (same day, same start and end time)
            const matchingTargetSlot = targetSlots.find(tSlot => 
              tSlot.dayOfWeek === sSlot.dayOfWeek &&
              normTime(tSlot.startTime) === normTime(sSlot.startTime) &&
              normTime(tSlot.endTime) === normTime(sSlot.endTime) &&
              ((tSlot.validUntil === null && sSlot.validUntil === null) ||
               (tSlot.validUntil !== null && sSlot.validUntil !== null))
            );

            if (matchingTargetSlot) {
              // Re-point references from duplicate slot to matching target slot
              slotMapping.set(sSlot.id, matchingTargetSlot.id);
              await tx.timetableOverride.updateMany({
                where: { originalSlotId: sSlot.id },
                data: { originalSlotId: matchingTargetSlot.id }
              });
              await tx.attendance.updateMany({
                where: { timetableSlotId: sSlot.id },
                data: { timetableSlotId: matchingTargetSlot.id }
              });
              await tx.timetableSlot.delete({ where: { id: sSlot.id } });
            } else {
              // Unique slot that target didn't have: transfer ownership to target subject
              await tx.timetableSlot.update({
                where: { id: sSlot.id },
                data: { subjectId: targetId }
              });
            }
          }

          // 2. Move Attendance Logs & Resolve Collisions
          const sourceLogs = await tx.attendance.findMany({ where: { subjectId: sourceId } });
          const targetLogs = await tx.attendance.findMany({ where: { subjectId: targetId } });
          
          const dateKeyOf = (d: Date | string) => {
            const dt = new Date(d);
            return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
          };

          for (const log of sourceLogs) {
            const mappedSlotId = slotMapping.get(log.timetableSlotId || "") || log.timetableSlotId;
            const logDateKey = dateKeyOf(log.date);

            // Handle collision strictly against unique constraint: `[userId, subjectId, date, timetableSlotId]`
            const collision = targetLogs.find(t => 
              dateKeyOf(t.date) === logDateKey && 
              (t.timetableSlotId || null) === (mappedSlotId || null)
            );
            
            if (collision) {
              const isLogAttended = ["present", "absent", "medical", "od"].includes(log.status);
              const isColAttended = ["present", "absent", "medical", "od"].includes(collision.status);

              if (isLogAttended && !isColAttended) {
                // Real attendance overrides cancelled/off placeholder
                await tx.attendance.update({
                  where: { id: collision.id },
                  data: { status: log.status, remarks: log.remarks || collision.remarks }
                });
                collision.status = log.status;
              } else if (log.remarks && !collision.remarks) {
                await tx.attendance.update({
                  where: { id: collision.id },
                  data: { remarks: log.remarks }
                });
              }
              // Delete source log to avoid @@unique collision
              await tx.attendance.delete({ where: { id: log.id } });
            } else {
              await tx.attendance.update({
                where: { id: log.id },
                data: { 
                  subjectId: targetId,
                  timetableSlotId: mappedSlotId
                }
              });
              // Register into targetLogs so subsequent sourceLogs check against it
              targetLogs.push({ ...log, subjectId: targetId, timetableSlotId: mappedSlotId });
            }
          }
          
          // 3. Transfer all other relational data to targetId
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
          
          // 4. Delete the duplicate source subject cleanly
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
