import { prisma } from "../lib/prisma";
import { SUBJECT_DICTIONARY } from "../utils/subjectDictionary";

export class TimetableService {
  static async getTimetable(semesterId: string) {
    return prisma.timetableSlot.findMany({
      where: { semesterId },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
            faculty: true,
            colorHex: true,
          },
        },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  }

  static async createSlot(data: any) {
    return prisma.timetableSlot.create({
      data: {
        semesterId: data.semesterId,
        subjectId: data.subjectId,
        dayOfWeek: Number(data.dayOfWeek),
        startTime: data.startTime,
        endTime: data.endTime,
        room: data.room,
        slotType: data.slotType || "lecture",
      },
      include: { subject: true },
    });
  }

  static async updateSlot(slotId: string, data: any) {
    return prisma.timetableSlot.update({
      where: { id: slotId },
      data: {
        subjectId: data.subjectId,
        dayOfWeek: data.dayOfWeek !== undefined ? Number(data.dayOfWeek) : undefined,
        startTime: data.startTime,
        endTime: data.endTime,
        room: data.room,
        slotType: data.slotType,
      },
      include: { subject: true },
    });
  }

  static async swapSlots(slotAId: string, slotBId: string) {
    const slotA = await prisma.timetableSlot.findUnique({ where: { id: slotAId } });
    const slotB = await prisma.timetableSlot.findUnique({ where: { id: slotBId } });

    if (!slotA || !slotB) {
      throw new Error("One or both slots not found");
    }

    // Ensure they are on the same day for simplicity, though not strictly required
    if (slotA.dayOfWeek !== slotB.dayOfWeek) {
      throw new Error("Cannot swap slots across different days");
    }

    // Swap the times using a transaction
    return prisma.$transaction([
      prisma.timetableSlot.update({
        where: { id: slotAId },
        data: {
          startTime: slotB.startTime,
          endTime: slotB.endTime,
        }
      }),
      prisma.timetableSlot.update({
        where: { id: slotBId },
        data: {
          startTime: slotA.startTime,
          endTime: slotA.endTime,
        }
      })
    ]);
  }

  static async deleteSlot(slotId: string, preserveHistory = true) {
    if (preserveHistory) {
      // Retain past attendance logs by unlinking slot ID
      await prisma.attendance.updateMany({
        where: { timetableSlotId: slotId },
        data: { timetableSlotId: null },
      });
    }
    return prisma.timetableSlot.delete({
      where: { id: slotId },
    });
  }

  static async addExtraClass(data: {
    semesterId: string;
    subjectId: string;
    date: string;
    startTime?: string;
    endTime?: string;
    reason?: string;
  }) {
    return prisma.timetableOverride.create({
      data: {
        semesterId: data.semesterId,
        subjectId: data.subjectId,
        date: new Date(data.date),
        overrideType: "extra_class",
        startTime: data.startTime || "17:30",
        endTime: data.endTime || "18:20",
        reason: data.reason || "Ad-hoc extra class",
      },
      include: { subject: true },
    });
  }

  static async processOcrImage(imageBuffer: Buffer, semesterId: string, userId: string) {
    // Stage 1: Smart OCR Extraction
    // Simulating an AI parsing the exact IIIT-U schedule provided by the user.
    // It groups conflicts (electives, lab groups) for the Setup Wizard to resolve.
    
    return {
      status: "needs_setup",
      programElectives: [
        {
          id: "pe1",
          name: "Program Elective",
          options: [
            { code: "ECSE303", title: SUBJECT_DICTIONARY["ECSE303"].title, credits: SUBJECT_DICTIONARY["ECSE303"].credits },
            { code: "ECSE304", title: SUBJECT_DICTIONARY["ECSE304"].title, credits: SUBJECT_DICTIONARY["ECSE304"].credits }
          ]
        }
      ],
      minorElectives: [
        {
          id: "me1",
          name: "Minor Elective",
          options: [
            { code: "SCMS301", title: SUBJECT_DICTIONARY["SCMS301"].title, credits: SUBJECT_DICTIONARY["SCMS301"].credits },
            { code: "SEMS301", title: SUBJECT_DICTIONARY["SEMS301"].title, credits: SUBJECT_DICTIONARY["SEMS301"].credits }
          ]
        }
      ],
      labGroups: [
        {
          id: "lg1",
          name: "Practical Group",
          options: ["G1", "G2"]
        }
      ],
      rawSlots: [
        // Monday
        { code: "ECSE303", dayOfWeek: 0, startTime: "09:00", endTime: "09:50", type: "lecture", room: "125", group: "ALL" },
        { code: "ECSE304", dayOfWeek: 0, startTime: "09:00", endTime: "09:50", type: "lecture", room: "328", group: "ALL" },
        { code: "ECMC301", dayOfWeek: 0, startTime: "09:50", endTime: "10:40", type: "lecture", room: "326", group: "ALL" },
        { code: "ICAE301", dayOfWeek: 0, startTime: "14:00", endTime: "15:40", type: "practical", room: "5", group: "ALL" },
        { code: "SCMS301", dayOfWeek: 0, startTime: "16:30", endTime: "17:20", type: "lecture", room: "228", group: "ALL" },
        // Tuesday
        { code: "ICVA301", dayOfWeek: 1, startTime: "09:00", endTime: "09:50", type: "lecture", room: "226", group: "ALL" },
        { code: "ECSE301", dayOfWeek: 1, startTime: "09:50", endTime: "10:40", type: "lecture", room: "226", group: "ALL" },
        { code: "ECSE304", dayOfWeek: 1, startTime: "11:00", endTime: "12:40", type: "practical", room: "104", group: "G1" },
        { code: "ECSE301", dayOfWeek: 1, startTime: "14:00", endTime: "15:40", type: "practical", room: "104", group: "G1" },
        { code: "SEMS301", dayOfWeek: 1, startTime: "14:50", endTime: "15:40", type: "lecture", room: "133", group: "ALL" },
        { code: "SCMS301", dayOfWeek: 1, startTime: "15:40", endTime: "16:30", type: "lecture", room: "228", group: "ALL" },
        // Wednesday
        { code: "ECSE304", dayOfWeek: 2, startTime: "09:50", endTime: "10:40", type: "lecture", room: "125", group: "ALL" },
        { code: "ICAE301", dayOfWeek: 2, startTime: "11:00", endTime: "12:40", type: "practical", room: "5", group: "ALL" },
        { code: "ECSE301", dayOfWeek: 2, startTime: "14:00", endTime: "15:40", type: "practical", room: "104", group: "G2" },
        { code: "ECMC301", dayOfWeek: 2, startTime: "15:40", endTime: "16:30", type: "lecture", room: "329", group: "ALL" },
        { code: "SCMS301", dayOfWeek: 2, startTime: "16:30", endTime: "17:20", type: "lecture", room: "227", group: "ALL" },
        // Thursday
        { code: "ECSE301", dayOfWeek: 3, startTime: "09:00", endTime: "09:50", type: "lecture", room: "125", group: "ALL" },
        { code: "ECSE303", dayOfWeek: 3, startTime: "09:50", endTime: "10:40", type: "lecture", room: "226", group: "ALL" },
        { code: "ECSE304", dayOfWeek: 3, startTime: "09:50", endTime: "10:40", type: "lecture", room: "325", group: "ALL" },
        { code: "SEMS301", dayOfWeek: 3, startTime: "11:50", endTime: "12:40", type: "lecture", room: "133", group: "ALL" },
        { code: "ECMC301", dayOfWeek: 3, startTime: "14:00", endTime: "15:40", type: "practical", room: "104", group: "G2" },
        { code: "ICVA301", dayOfWeek: 3, startTime: "15:40", endTime: "16:30", type: "lecture", room: "230", group: "ALL" },
        // Friday
        { code: "ECSE301", dayOfWeek: 4, startTime: "09:00", endTime: "09:50", type: "lecture", room: "326", group: "ALL" },
        { code: "ECMC301", dayOfWeek: 4, startTime: "09:50", endTime: "10:40", type: "lecture", room: "126", group: "ALL" },
        { code: "ECMC301", dayOfWeek: 4, startTime: "11:00", endTime: "12:40", type: "practical", room: "104", group: "G1" },
        { code: "ECSE303", dayOfWeek: 4, startTime: "14:00", endTime: "14:50", type: "lecture", room: "126", group: "ALL" },
        { code: "ECSE304", dayOfWeek: 4, startTime: "14:00", endTime: "15:40", type: "practical", room: "104", group: "G2" },
        { code: "ICVA301", dayOfWeek: 4, startTime: "16:30", endTime: "17:20", type: "lecture", room: "329", group: "ALL" },
      ]
    };
  }

  static async saveWizardTimetable(userId: string, semesterId: string, selections: any, rawSlots: any[]) {
    // Filter slots based on user selections
    const { programElectiveCode, minorElectiveCode, labGroup } = selections;
    
    const colors = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e", "#06b6d4", "#3b82f6", "#6366f1", "#a855f7", "#ec4899"];
    let colorIndex = 0;

    const filteredSlots = rawSlots.filter(slot => {
      // Filter out unselected Program Electives (ECSE303 vs ECSE304)
      if ((slot.code === "ECSE303" || slot.code === "ECSE304") && slot.code !== programElectiveCode) return false;
      // Filter out unselected Minor Electives (SCMS301 vs SEMS301)
      if ((slot.code === "SCMS301" || slot.code === "SEMS301") && slot.code !== minorElectiveCode) return false;
      // Filter out wrong lab groups
      if (slot.group !== "ALL" && slot.group !== labGroup) return false;
      return true;
    });

    const createdSlots = [];
    const subjectsMap = new Map(); // code -> subjectId

    for (const slot of filteredSlots) {
      const isLab = slot.type === "practical";
      const dictInfo = SUBJECT_DICTIONARY[slot.code] || { title: slot.code, credits: 3 };
      
      const actualCode = isLab ? `${slot.code}_LAB` : slot.code;
      const baseTitle = dictInfo.title;
      const actualTitle = isLab && !baseTitle.toLowerCase().includes("lab") 
        ? `${baseTitle} Lab` 
        : baseTitle;
      const actualCredits = dictInfo.credits || 3;

      let subjectId = subjectsMap.get(actualCode);

      if (!subjectId) {
        // Find or create subject
        let subject = await prisma.subject.findFirst({
          where: { semesterId, userId, code: actualCode }
        });

        if (!subject) {
          subject = await prisma.subject.create({
            data: {
              semesterId,
              userId,
              name: actualTitle,
              code: actualCode,
              credits: actualCredits,
              colorHex: colors[colorIndex % colors.length],
            }
          });
          colorIndex++;
        } else if (subject.name !== actualTitle) {
          // Fix old mock data names
          subject = await prisma.subject.update({
            where: { id: subject.id },
            data: { name: actualTitle }
          });
        }
        subjectId = subject.id;
        subjectsMap.set(actualCode, subjectId);
      }

      // Create timetable slot
      const newSlot = await prisma.timetableSlot.create({
        data: {
          semesterId,
          subjectId,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          room: slot.room,
          slotType: slot.type,
        },
        include: { subject: true }
      });
      createdSlots.push(newSlot);
    }

    return createdSlots;
  }

  static async safeDeleteTimetable(userId: string, semesterId: string) {
    // 1. Fetch all slot and override IDs for this semester
    const slots = await prisma.timetableSlot.findMany({
      where: { semesterId },
      select: { id: true }
    });
    const slotIds = slots.map(s => s.id);

    const overrides = await prisma.timetableOverride.findMany({
      where: { semesterId },
      select: { id: true }
    });
    const overrideIds = overrides.map(o => o.id);

    // 2. Unlink attendance records to safely preserve history
    if (slotIds.length > 0) {
      await prisma.attendance.updateMany({
        where: { userId, timetableSlotId: { in: slotIds } },
        data: { timetableSlotId: null }
      });
    }

    if (overrideIds.length > 0) {
      await prisma.attendance.updateMany({
        where: { userId, overrideId: { in: overrideIds } },
        data: { overrideId: null }
      });
    }

    // 3. Wipe overrides and slots
    await prisma.timetableOverride.deleteMany({
      where: { semesterId }
    });

    await prisma.timetableSlot.deleteMany({
      where: { semesterId }
    });
  }
}
