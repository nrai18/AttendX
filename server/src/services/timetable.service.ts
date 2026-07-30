import { prisma } from "../lib/prisma";
import { GoogleGenAI, Type } from "@google/genai";
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

  static async processOcrImage(imageBuffer: Buffer, semesterId?: string, userId?: string) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured on the server.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const base64Image = imageBuffer.toString("base64");

    const schema = {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING, description: "Always return 'needs_setup'" },
        programElectives: {
          type: Type.ARRAY,
          description: "Groups of program elective subjects that share a time slot (e.g. ECSE303 vs ECSE304). Each group has an id, name, and options array.",
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    code: { type: Type.STRING },
                    title: { type: Type.STRING },
                    credits: { type: Type.NUMBER }
                  }
                }
              }
            }
          }
        },
        minorElectives: {
          type: Type.ARRAY,
          description: "Groups of minor elective subjects that share a time slot (e.g. SCMS301 vs SEMS301). Same structure as programElectives.",
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    code: { type: Type.STRING },
                    title: { type: Type.STRING },
                    credits: { type: Type.NUMBER }
                  }
                }
              }
            }
          }
        },
        labGroups: {
          type: Type.ARRAY,
          description: "Practical/lab groups found in the timetable, e.g. [{ id: 'lg1', name: 'Practical Group', options: ['G1', 'G2'] }]",
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            }
          }
        },
        rawSlots: {
          type: Type.ARRAY,
          description: "Every single timetable slot extracted from the image. dayOfWeek: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun. If a cell has multiple subjects stacked (electives), emit a SEPARATE slot object for EACH. group should be 'ALL' unless it is a practical for a specific group like 'G1' or 'G2'.",
          items: {
            type: Type.OBJECT,
            properties: {
              code: { type: Type.STRING, description: "Course code, e.g. ECSE304" },
              dayOfWeek: { type: Type.NUMBER, description: "0 for Monday, 1 for Tuesday, up to 6 for Sunday" },
              startTime: { type: Type.STRING, description: "24h HH:MM format, e.g. 09:00" },
              endTime: { type: Type.STRING, description: "24h HH:MM format, e.g. 09:50" },
              type: { type: Type.STRING, description: "'lecture', 'practical', or 'tutorial'" },
              room: { type: Type.STRING, description: "Room or lab number if visible, else empty string" },
              group: { type: Type.STRING, description: "'ALL' or specific group like 'G1', 'G2'" }
            }
          }
        }
      },
      required: ["status", "programElectives", "minorElectives", "labGroups", "rawSlots"]
    };

    const prompt = `You are an expert academic timetable extraction assistant. Carefully analyze this timetable image and extract every single class slot.

Rules:
1. Extract ALL lecture, practical/lab, and tutorial slots.
2. If a time cell contains multiple stacked subjects (like electives ECSE303/ECSE304 in the same box), emit a SEPARATE slot object for EACH subject in rawSlots AND group them into programElectives or minorElectives.
3. For practicals, identify which group (G1, G2, etc.) they belong to. If it applies to all, use 'ALL'.
4. Convert times to 24-hour HH:MM format.
5. Days: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6.
6. Set status to 'needs_setup'.
7. If no program electives are detected, return an empty array for programElectives.
8. If no minor electives are detected, return an empty array for minorElectives.
9. If no lab groups are detected, return an empty array for labGroups.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: base64Image } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    });

    if (!response.text) {
      throw new Error("Gemini returned empty response.");
    }

    const parsed = JSON.parse(response.text);

    // Enrich elective options with data from our local subject dictionary
    const enrichOptions = (options: any[]) => {
      if (!options) return;
      for (const opt of options) {
        if (opt.code && SUBJECT_DICTIONARY[opt.code]) {
          opt.title = SUBJECT_DICTIONARY[opt.code].title;
          opt.credits = SUBJECT_DICTIONARY[opt.code].credits;
        }
      }
    };

    if (parsed.programElectives) parsed.programElectives.forEach((pe: any) => enrichOptions(pe.options));
    if (parsed.minorElectives) parsed.minorElectives.forEach((me: any) => enrichOptions(me.options));

    return parsed;
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
