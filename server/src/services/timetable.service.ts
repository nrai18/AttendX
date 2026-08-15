import { prisma } from "../lib/prisma";
import {
  COURSE_CURRICULUM,
  resolveSubjectName,
} from "../utils/subjectDictionary";
import { GoogleGenAI, Type } from "@google/genai";

const SUBJECT_COLORS = [
  "#1d4ed8",
  "#7c3aed",
  "#db2777",
  "#0f766e",
  "#ea580c",
  "#16a34a",
  "#b45309",
  "#2563eb",
];

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

  private static async getSemesterForUser(
    userId: string,
    semesterId?: string | null,
  ) {
    if (semesterId) {
      const semester = await prisma.semester.findFirst({
        where: { id: semesterId, userId },
      });
      if (!semester) {
        throw new Error("Semester not found");
      }
      return semester;
    }

    const activeSemester = await prisma.semester.findFirst({
      where: { userId, isActive: true },
    });

    if (activeSemester) {
      return activeSemester;
    }

    const latestSemester = await prisma.semester.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    if (!latestSemester) {
      throw new Error("No semester found for user");
    }

    return latestSemester;
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
        dayOfWeek:
          data.dayOfWeek !== undefined ? Number(data.dayOfWeek) : undefined,
        startTime: data.startTime,
        endTime: data.endTime,
        room: data.room,
        slotType: data.slotType,
      },
      include: { subject: true },
    });
  }

  static async swapSlots(slotAId: string, slotBId: string) {
    const slotA = await prisma.timetableSlot.findUnique({
      where: { id: slotAId },
    });
    const slotB = await prisma.timetableSlot.findUnique({
      where: { id: slotBId },
    });

    if (!slotA || !slotB) {
      throw new Error("One or both slots not found");
    }

    if (slotA.dayOfWeek !== slotB.dayOfWeek) {
      throw new Error("Cannot swap slots across different days");
    }

    return prisma.$transaction(async (tx) => {
      const updatedA = await tx.timetableSlot.update({
        where: { id: slotAId },
        data: {
          startTime: slotB.startTime,
          endTime: slotB.endTime,
        },
      });
      const updatedB = await tx.timetableSlot.update({
        where: { id: slotBId },
        data: {
          startTime: slotA.startTime,
          endTime: slotA.endTime,
        },
      });
      return [updatedA, updatedB];
    });
  }

  static async deleteSlot(slotId: string, preserveHistory = true) {
    if (preserveHistory) {
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
    semesterId?: string;
    subjectId: string;
    date: string;
    startTime?: string;
    endTime?: string;
    reason?: string;
    userId?: string;
  }) {
    const semester = data.semesterId
      ? await prisma.semester.findFirst({ where: { id: data.semesterId } })
      : data.userId
        ? await this.getSemesterForUser(data.userId, null)
        : null;

    if (!semester) {
      throw new Error("Semester not found");
    }

    return prisma.timetableOverride.create({
      data: {
        semesterId: semester.id,
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

  static async exportTimetable(userId: string, semesterId?: string) {
    const semester = await this.getSemesterForUser(userId, semesterId);
    const [subjects, slots, overrides] = await Promise.all([
      prisma.subject.findMany({
        where: { userId, semesterId: semester.id },
        orderBy: { createdAt: "asc" },
      }),
      prisma.timetableSlot.findMany({
        where: { semesterId: semester.id },
        include: { subject: true },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      }),
      prisma.timetableOverride.findMany({
        where: { semesterId: semester.id },
        include: { subject: true },
        orderBy: { date: "asc" },
      }),
    ]);

    return {
      semester,
      subjects,
      slots,
      overrides,
      exportedAt: new Date().toISOString(),
    };
  }

  static async importTimetable(
    userId: string,
    semesterId: string,
    payload: any,
  ) {
    const semester = await prisma.semester.findFirst({
      where: { id: semesterId, userId },
    });

    if (!semester) {
      throw new Error("Semester not found");
    }

    const subjectsPayload = Array.isArray(payload?.subjects)
      ? payload.subjects
      : [];
    const slotsPayload = Array.isArray(payload?.slots) ? payload.slots : [];

    const subjectIdByCode = new Map<string, string>();
    for (const subjectData of subjectsPayload) {
      if (!subjectData?.code) continue;
      const existingSubject = await prisma.subject.findFirst({
        where: { semesterId, userId, code: subjectData.code },
      });

      const subject = existingSubject
        ? await prisma.subject.update({
            where: { id: existingSubject.id },
            data: {
              name: subjectData.name || subjectData.code,
              credits: subjectData.credits ?? 3,
              faculty: subjectData.faculty,
              colorHex: subjectData.colorHex || existingSubject.colorHex,
            },
          })
        : await prisma.subject.create({
            data: {
              semesterId,
              userId,
              code: subjectData.code,
              name: subjectData.name || subjectData.code,
              credits: subjectData.credits ?? 3,
              faculty: subjectData.faculty,
              colorHex:
                subjectData.colorHex ||
                SUBJECT_COLORS[subjectIdByCode.size % SUBJECT_COLORS.length],
            },
          });

      subjectIdByCode.set(subjectData.code, subject.id);
    }

    const slotSubjectIds: string[] = Array.from(
      new Set(
        slotsPayload
          .map(
            (slot: any) =>
              slot?.subject?.code || slot?.subjectCode || slot?.code,
          )
          .filter((code: any): code is string => Boolean(code)),
      ),
    );

    const subjectsToUnlink = await prisma.subject.findMany({
      where: { semesterId, userId, code: { in: slotSubjectIds } },
      select: { id: true },
    });
    const subjectIdsToUnlink = subjectsToUnlink.map((subject) => subject.id);

    if (subjectIdsToUnlink.length > 0) {
      await prisma.attendance.updateMany({
        where: { timetableSlotId: { not: null } },
        data: { timetableSlotId: null },
      });
    }

    await prisma.timetableSlot.deleteMany({
      where: { semesterId },
    });

    const createdSlots = [];
    for (const slot of slotsPayload) {
      const code = slot?.subject?.code || slot?.subjectCode || slot?.code;
      if (!code) continue;

      let subjectId = subjectIdByCode.get(code);
      if (!subjectId) {
        let subject = await prisma.subject.findFirst({
          where: { semesterId, userId, code },
        });
        if (!subject) {
          subject = await prisma.subject.create({
            data: {
              semesterId,
              userId,
              code,
              name: slot?.subject?.name || slot?.name || code,
              credits: slot?.subject?.credits ?? slot?.credits ?? 3,
              colorHex:
                slot?.subject?.colorHex ||
                SUBJECT_COLORS[subjectIdByCode.size % SUBJECT_COLORS.length],
            },
          });
        }
        subjectId = subject.id;
        subjectIdByCode.set(code, subjectId);
      }

      createdSlots.push(
        await prisma.timetableSlot.create({
          data: {
            semesterId,
            subjectId,
            dayOfWeek: Number(slot.dayOfWeek),
            startTime: slot.startTime,
            endTime: slot.endTime,
            room: slot.room,
            slotType: slot.slotType || slot.type || "lecture",
          },
          include: { subject: true },
        }),
      );
    }

    return createdSlots;
  }

  static async processOcrImage(
    imageBuffer: Buffer,
    mimeType: string,
    semesterId: string,
    userId: string,
    semesterName: string = "Semester 5",
    userDepartment: string = "Electronics & Communication Engineering",
  ) {
    if (!process.env.GEMINI_API_KEY) {
      console.log(
        "GEMINI_API_KEY is not defined. Falling back to mock structured timetable.",
      );
      return this.getMockOcrResponse(semesterId);
    }

    try {
      console.log(
        "Calling Gemini API for Layout-Aware Timetable Extraction...",
      );
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const base64Image = imageBuffer.toString("base64");

      const schema = {
        type: Type.OBJECT,
        properties: {
          status: {
            type: Type.STRING,
            description: "Always return 'needs_setup'",
          },
          programElectives: {
            type: Type.ARRAY,
            description:
              "Groups of program elective subjects that share a time slot. Empty if none.",
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
                      credits: { type: Type.NUMBER },
                    },
                  },
                },
              },
            },
          },
          minorElectives: {
            type: Type.ARRAY,
            description:
              "Groups of minor elective subjects that share a time slot. Empty if none.",
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
                      credits: { type: Type.NUMBER },
                    },
                  },
                },
              },
            },
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
                  items: { type: Type.STRING },
                },
              },
            },
          },
          rawSlots: {
            type: Type.ARRAY,
            description:
              "Every single timetable slot extracted from the image. dayOfWeek: 0=Mon ... 6=Sun. If multiple electives share a box, output separate slot entries.",
            items: {
              type: Type.OBJECT,
              properties: {
                code: {
                  type: Type.STRING,
                  description: "Course code, e.g. ECSE304",
                },
                dayOfWeek: {
                  type: Type.NUMBER,
                  description: "0 for Monday ... 6 for Sunday",
                },
                startTime: {
                  type: Type.STRING,
                  description: "24h HH:MM format",
                },
                endTime: { type: Type.STRING, description: "24h HH:MM format" },
                type: {
                  type: Type.STRING,
                  description: "'lecture', 'practical', or 'tutorial'",
                },
                room: { type: Type.STRING },
                group: {
                  type: Type.STRING,
                  description: "'ALL' or specific group like 'G1', 'G2'",
                },
                section: {
                  type: Type.STRING,
                  description:
                    "Section label e.g. 'A', 'B'. Use 'ALL' if applies to all sections.",
                },
              },
            },
          },
          sections: {
            type: Type.ARRAY,
            description:
              "List of distinct section labels found on this timetable page (e.g. ['A','B']). Return [] if no separate sections exist.",
            items: { type: Type.STRING },
          },
        },
        required: [
          "status",
          "programElectives",
          "minorElectives",
          "labGroups",
          "rawSlots",
          "sections",
        ],
      };

      const prompt = `You are an expert academic timetable extraction assistant.
You are given a multi-page academic timetable PDF or timetable image.
First, identify the correct page or section that matches the following student configuration:
- Semester/Year: Look for a page/header matching "${semesterName}" (e.g., Semester 3, Semester 5, Semester 7).
- Branch/Department: Look for a page/header matching "${userDepartment}" (e.g. "Computer Science and Engineering", "Electronics and Communication Engineering", or "Information Technology").

Once you have identified the page matching these criteria, scan for ALL sections (e.g., Section A, Section B) on that page.

Rules:
1. Extract ALL lecture, practical/lab, and tutorial slots.
2. If a time cell contains multiple stacked subjects (like electives ECSE303/ECSE304 in the same box), emit a SEPARATE slot object for EACH subject in rawSlots AND group them into programElectives or minorElectives.
3. For practicals, identify which group (G1, G2, etc.) they belong to. If it applies to all, use 'ALL'.
4. Convert times to 24-hour HH:MM format.
5. Days: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6.
6. Set status to 'needs_setup'.
7. In the 'sections' field, list every distinct section label found on this page (e.g. ["A","B"]). If the page has no section split, return [].
8. In each rawSlot, set the 'section' field to the section label it belongs to (e.g. 'A'), or 'ALL' if it applies to all sections.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { mimeType: mimeType, data: base64Image } },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      });

      if (!response.text) {
        throw new Error("Gemini returned empty response.");
      }

      const parsed = JSON.parse(response.text);

      const enrichOptions = (options: any[]) => {
        if (!options) return;
        for (const opt of options) {
          if (opt.code && COURSE_CURRICULUM[opt.code]) {
            opt.title = COURSE_CURRICULUM[opt.code];
          }
        }
      };

      if (parsed.programElectives)
        parsed.programElectives.forEach((pe: any) => enrichOptions(pe.options));
      if (parsed.minorElectives)
        parsed.minorElectives.forEach((me: any) => enrichOptions(me.options));

      return parsed;
    } catch (error) {
      console.error("Gemini API error during OCR:", error);
      console.log("Falling back to structured mock data due to API failure.");
      return this.getMockOcrResponse(semesterId);
    }
  }

  private static getMockOcrResponse(semesterId: string) {
    return {
      status: "needs_setup",
      programElectives: [
        {
          id: "pe1",
          name: "Program Elective",
          options: [
            { code: "ECSE303", title: COURSE_CURRICULUM["ECSE303"] },
            { code: "ECSE304", title: COURSE_CURRICULUM["ECSE304"] },
          ],
        },
      ],
      minorElectives: [
        {
          id: "me1",
          name: "Minor Elective",
          options: [
            { code: "SCMS301", title: COURSE_CURRICULUM["SCMS301"] },
            { code: "SEMS301", title: COURSE_CURRICULUM["SEMS301"] },
          ],
        },
      ],
      labGroups: [
        {
          id: "lg1",
          name: "Practical Group",
          options: ["G1", "G2"],
        },
      ],
      rawSlots: [
        {
          code: "ECSE303",
          dayOfWeek: 0,
          startTime: "09:00",
          endTime: "09:50",
          type: "lecture",
          room: "125",
          group: "ALL",
        },
        {
          code: "ECSE304",
          dayOfWeek: 0,
          startTime: "09:00",
          endTime: "09:50",
          type: "lecture",
          room: "328",
          group: "ALL",
        },
        {
          code: "ECMC301",
          dayOfWeek: 0,
          startTime: "09:50",
          endTime: "10:40",
          type: "lecture",
          room: "326",
          group: "ALL",
        },
        {
          code: "ICAE301",
          dayOfWeek: 0,
          startTime: "14:00",
          endTime: "15:40",
          type: "practical",
          room: "5",
          group: "ALL",
        },
        {
          code: "SCMS301",
          dayOfWeek: 0,
          startTime: "16:30",
          endTime: "17:20",
          type: "lecture",
          room: "228",
          group: "ALL",
        },
      ],
    };
  }

  static async saveWizardTimetable(
    userId: string,
    semesterId: string,
    selections: any,
    rawSlots: any[],
  ) {
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId },
    });

    const {
      programElectiveCode,
      minorElectiveCode,
      labGroup,
      section,
      programElectiveCodes = [] as string[],
      minorElectiveCodes = [] as string[],
    } = selections;

    const normalizedLabGroup = (labGroup || "").trim().toUpperCase();
    let colorIndex = 0;
    const colors = SUBJECT_COLORS;

    // Helper to calculate end times dynamically if Gemini misses them
    const calculateEndTime = (time: string, isLab: boolean) => {
      if (!time || !time.includes(":")) return "00:00";
      const [h, m] = time.split(":").map(Number);
      const durationMins = isLab ? 100 : 50;
      const totalMins = h * 60 + m + durationMins;
      const endH = Math.floor(totalMins / 60) % 24;
      const endM = totalMins % 60;
      return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
    };

    const filteredSlots = rawSlots.filter((slot: any) => {
      const slotGroup = (slot.group || "ALL").trim().toUpperCase();
      if (slotGroup !== "ALL" && slotGroup !== normalizedLabGroup) return false;

      if (section) {
        const slotSection = (slot.section || "ALL").trim().toUpperCase();
        const userSection = section.trim().toUpperCase();
        if (slotSection !== "ALL" && slotSection !== userSection) return false;
      }

      if (
        programElectiveCodes.length > 0 &&
        programElectiveCodes.includes(slot.code)
      ) {
        if (slot.code !== programElectiveCode) return false;
      }

      if (
        minorElectiveCodes.length > 0 &&
        minorElectiveCodes.includes(slot.code)
      ) {
        if (slot.code !== minorElectiveCode) return false;
      }

      return true;
    });

    const createdSlots = [];
    const subjectsMap = new Map();
    const seenSlots = new Set();

    for (const slot of filteredSlots) {
      const isLab = slot.type === "practical" || slot.type === "lab";

      // Auto-fill endTime if the AI failed to extract it properly
      if (
        !slot.endTime ||
        slot.endTime === "undefined" ||
        slot.endTime.trim() === ""
      ) {
        slot.endTime = calculateEndTime(slot.startTime, isLab);
      }

      const slotKey = `${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}`;
      if (seenSlots.has(slotKey)) continue;
      seenSlots.add(slotKey);

      const baseTitle = resolveSubjectName(slot.code);
      const actualCode = isLab ? `${slot.code}_LAB` : slot.code;
      const actualTitle =
        isLab && !baseTitle.toLowerCase().includes("lab")
          ? `${baseTitle} Lab`
          : baseTitle;

      let subjectId = subjectsMap.get(actualCode);

      if (!subjectId) {
        let subject = await prisma.subject.findFirst({
          where: { semesterId, userId, code: actualCode },
        });

        if (!subject) {
          subject = await prisma.subject.create({
            data: {
              semesterId,
              userId,
              name: actualTitle,
              code: actualCode,
              credits: 3,
              colorHex: colors[colorIndex % colors.length],
            },
          });
          colorIndex++;
        } else if (subject.name !== actualTitle) {
          subject = await prisma.subject.update({
            where: { id: subject.id },
            data: { name: actualTitle },
          });
        }
        subjectId = subject.id;
        subjectsMap.set(actualCode, subjectId);
      }

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
        include: { subject: true },
      });
      createdSlots.push(newSlot);
    }

    return createdSlots;
  }

  static async safeDeleteTimetable(userId: string, semesterId: string) {
    const slots = await prisma.timetableSlot.findMany({
      where: { semesterId },
      select: { id: true },
    });
    const slotIds = slots.map((s) => s.id);

    const overrides = await prisma.timetableOverride.findMany({
      where: { semesterId },
      select: { id: true },
    });
    const overrideIds = overrides.map((o) => o.id);

    if (slotIds.length > 0) {
      await prisma.attendance.updateMany({
        where: { userId, timetableSlotId: { in: slotIds } },
        data: { timetableSlotId: null },
      });
    }

    if (overrideIds.length > 0) {
      await prisma.attendance.updateMany({
        where: { userId, overrideId: { in: overrideIds } },
        data: { overrideId: null },
      });
    }

    // Interactive transaction guarantees safety and prevents the array promise bug
    const result = await prisma.$transaction(async (tx) => {
      const overrideDelete = await tx.timetableOverride.deleteMany({
        where: { semesterId },
      });
      const slotDelete = await tx.timetableSlot.deleteMany({
        where: { semesterId },
      });

      return {
        deletedOverrides: overrideDelete.count,
        deletedSlots: slotDelete.count,
      };
    });

    return result;
  }
}
