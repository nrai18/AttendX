import { prisma } from "../lib/prisma";
import { COURSE_CURRICULUM, resolveSubjectName } from "../utils/subjectDictionary";
import { GoogleGenAI, Type } from "@google/genai";

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

  static async processOcrImage(
    imageBuffer: Buffer, 
    mimeType: string, 
    semesterId: string, 
    userId: string,
    semesterName: string = "Semester 5",
    userDepartment: string = "Electronics & Communication Engineering"
  ) {
    // If GEMINI_API_KEY is not defined, fallback to structured mock timetable
    if (!process.env.GEMINI_API_KEY) {
      console.log("GEMINI_API_KEY is not defined. Falling back to mock structured timetable.");
      return this.getMockOcrResponse(semesterId);
    }

    try {
      console.log("Calling Gemini API for Layout-Aware Timetable Extraction...");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const base64Image = imageBuffer.toString("base64");

      const schema = {
        type: Type.OBJECT,
        properties: {
          status: { type: Type.STRING, description: "Always return 'needs_setup'" },
          programElectives: {
            type: Type.ARRAY,
            description: "Groups of program elective subjects that share a time slot. Empty if none.",
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
            description: "Groups of minor elective subjects that share a time slot. Empty if none.",
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
            description: "Practical/lab groups found in the timetable.",
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
            description: "Every single timetable slot extracted from the image. dayOfWeek: 0=Mon ... 6=Sun. If multiple electives share a box, output separate slot entries.",
            items: {
              type: Type.OBJECT,
              properties: {
                code: { type: Type.STRING, description: "Course code, e.g. ECSE304" },
                dayOfWeek: { type: Type.NUMBER, description: "0 for Monday ... 6 for Sunday" },
                startTime: { type: Type.STRING, description: "24h HH:MM format" },
                endTime: { type: Type.STRING, description: "24h HH:MM format" },
                type: { type: Type.STRING, description: "'lecture', 'practical', or 'tutorial'" },
                room: { type: Type.STRING },
                group: { type: Type.STRING, description: "'ALL' or specific group like 'G1', 'G2'" }
              }
            }
          }
        },
        required: ["status", "programElectives", "minorElectives", "labGroups", "rawSlots"]
      };

      const prompt = `You are an expert academic timetable extraction assistant.
You are given a multi-page academic timetable PDF or timetable image.
First, identify the correct page or section that matches the following student configuration:
- Semester/Year: Look for a page/header matching "${semesterName}" (e.g., Semester 3, Semester 5, Semester 7).
- Branch/Department: Look for a page/header matching "${userDepartment}" (e.g. "Computer Science and Engineering", "Electronics and Communication Engineering", or "Information Technology").

Once you have identified the single page matching these criteria, carefully extract every single class slot from THAT SPECIFIC PAGE ONLY. Ignore all other pages.

Rules:
1. Extract ALL lecture, practical/lab, and tutorial slots.
2. If a time cell contains multiple stacked subjects (like electives ECSE303/ECSE304 in the same box), emit a SEPARATE slot object for EACH subject in rawSlots AND group them into programElectives or minorElectives.
3. For practicals, identify which group (G1, G2, etc.) they belong to. If it applies to all, use 'ALL'.
4. Convert times to 24-hour HH:MM format.
5. Days: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6.
6. Set status to 'needs_setup'.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { mimeType: mimeType, data: base64Image } }
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

      // Enrich elective options with titles from curriculum dictionary
      const enrichOptions = (options: any[]) => {
        if (!options) return;
        for (const opt of options) {
          if (opt.code && COURSE_CURRICULUM[opt.code]) {
            opt.title = COURSE_CURRICULUM[opt.code];
          }
        }
      };

      if (parsed.programElectives) parsed.programElectives.forEach((pe: any) => enrichOptions(pe.options));
      if (parsed.minorElectives) parsed.minorElectives.forEach((me: any) => enrichOptions(me.options));

      return parsed;
    } catch (error) {
      console.error("Gemini API error during OCR:", error);
      console.log("Falling back to structured mock data due to API failure.");
      return this.getMockOcrResponse(semesterId);
    }
  }

  /**
   * Helper to return layout-aware mock data based on the semester to ensure reliable local test state.
   */
  private static getMockOcrResponse(semesterId: string) {
    return {
      status: "needs_setup",
      programElectives: [
        {
          id: "pe1",
          name: "Program Elective",
          options: [
            { code: "ECSE303", title: COURSE_CURRICULUM["ECSE303"] },
            { code: "ECSE304", title: COURSE_CURRICULUM["ECSE304"] }
          ]
        }
      ],
      minorElectives: [
        {
          id: "me1",
          name: "Minor Elective",
          options: [
            { code: "SCMS301", title: COURSE_CURRICULUM["SCMS301"] },
            { code: "SEMS301", title: COURSE_CURRICULUM["SEMS301"] }
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
    // 1. Fetch semester info to apply dynamic Year-Specific mapping logic
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId }
    });

    const normalizedName = semester ? semester.name.toLowerCase() : "";
    const match = normalizedName.match(/(?:semester|sem)\s*(\d+)/i) || normalizedName.match(/(\d+)/);
    const semesterNumber = match ? parseInt(match[1], 10) : 5; // Default to 5

    // 2. Filter slots based on user selections and mapping rules
    const { programElectiveCode, minorElectiveCode, labGroup } = selections;
    
    const colors = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e", "#06b6d4", "#3b82f6", "#6366f1", "#a855f7", "#ec4899"];
    let colorIndex = 0;

    const filteredSlots = rawSlots.filter(slot => {
      // General lab group filter (applies to all practicals with lab group sub-divisions)
      if (slot.group && slot.group !== "ALL" && slot.group !== labGroup) return false;

      // Semester 5 elective resolution
      if (semesterNumber === 5) {
        // Resolve Program Electives (ECSE303 vs ECSE304)
        if ((slot.code === "ECSE303" || slot.code === "ECSE304") && slot.code !== programElectiveCode) return false;
        // Resolve Minor Electives (SCMS301 vs SEMS301)
        if ((slot.code === "SCMS301" || slot.code === "SEMS301") && slot.code !== minorElectiveCode) return false;
      }

      // Semester 3 and 7 have no electives configured in this phase, so they bypass PE filtering
      return true;
    });

    const createdSlots = [];
    const subjectsMap = new Map(); // code -> subjectId

    for (const slot of filteredSlots) {
      const isLab = slot.type === "practical";
      const baseTitle = resolveSubjectName(slot.code);

      const actualCode = isLab ? `${slot.code}_LAB` : slot.code;
      const actualTitle = isLab && !baseTitle.toLowerCase().includes("lab")
        ? `${baseTitle} Lab`
        : baseTitle;
      const actualCredits = 3; // Default; update when credits data is available

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
