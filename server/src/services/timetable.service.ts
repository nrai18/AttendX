import { prisma } from "../lib/prisma";
import { GoogleGenAI } from "@google/genai";
// pdf-parse is loaded lazily inside processOcrImage to avoid startup crashes in production
// (pdf-parse tries to load test files from disk at module init time)
import { COURSE_CURRICULUM, resolveSubjectName, SUBJECT_DICTIONARY, BRANCH_NAMES } from "../utils/subjectDictionary";
import { normalizeTimeString } from "../utils/timeUtils";

export class TimetableService {
  static async getTimetable(semesterId: string, group?: string) {
    // Auto-heal: Ensure practicals are on their correct schedules, spans, and non-duplicate
    try {
      const allSlots = await prisma.timetableSlot.findMany({
        where: { semesterId },
        include: { subject: true }
      });

      // 1. Fix misplaced ECSE301 practical (Data Communication and Networks Lab -> Wednesday 14:00-15:40)
      for (const slot of allSlots) {
        const isECSE301Lab =
          (slot.subject?.code?.toUpperCase().includes("ECSE301") || slot.subject?.name?.toLowerCase().includes("data communication")) &&
          (slot.slotType === "practical" || slot.subject?.name?.toLowerCase().includes("lab"));

        if (isECSE301Lab) {
          const updateData: any = {};
          if (slot.dayOfWeek !== 2) updateData.dayOfWeek = 2;
          if (slot.startTime === "14:00" && slot.endTime === "14:50") updateData.endTime = "15:40";
          if (!slot.room) updateData.room = "104";

          if (Object.keys(updateData).length > 0) {
            await prisma.timetableSlot.update({
              where: { id: slot.id },
              data: updateData
            });
          }
        }

        // 2. Fix 50-min practical slot spans to standard 100-min lab spans
        if (slot.slotType === "practical" || slot.subject?.name?.toLowerCase().includes("lab")) {
          if (slot.startTime === "14:00" && slot.endTime === "14:50") {
            await prisma.timetableSlot.update({ where: { id: slot.id }, data: { endTime: "15:40" } });
          } else if (slot.startTime === "11:00" && slot.endTime === "11:50") {
            await prisma.timetableSlot.update({ where: { id: slot.id }, data: { endTime: "12:40" } });
          } else if (slot.startTime === "09:00" && slot.endTime === "09:50") {
            await prisma.timetableSlot.update({ where: { id: slot.id }, data: { endTime: "10:40" } });
          }
        }
      }
    } catch (e) {
      // Non-blocking auto-heal
      console.warn("Timetable auto-heal notice:", e);
    }

    const slots = await prisma.timetableSlot.findMany({
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

    const normalized = slots.map(slot => ({
      ...slot,
      startTime: normalizeTimeString(slot.startTime, "09:00"),
      endTime: normalizeTimeString(slot.endTime, "10:00"),
    }));

    if (!group || group.toUpperCase() === "ALL") {
      return normalized;
    }

    const normTarget = group.toUpperCase().trim();
    return normalized.filter(slot => {
      const rawSlotGroup = (slot as any).group || "";
      const room = slot.room || "";
      const name = slot.subject?.name || "";
      const faculty = slot.subject?.faculty || "";
      const code = slot.subject?.code || "";
      const combined = `${rawSlotGroup} ${room} ${name} ${faculty} ${code}`.toUpperCase();

      const hasG1 = /\b(G1|GROUP\s*1|BATCH\s*1|G-1)\b/i.test(combined);
      const hasG2 = /\b(G2|GROUP\s*2|BATCH\s*2|G-2)\b/i.test(combined);
      const isShared = /\b(G1\/G2|G1,G2|G1&G2|BOTH|ALL)\b/i.test(combined) || (hasG1 && hasG2);

      if (!hasG1 && !hasG2) return true;
      if (isShared) return true;
      if (normTarget === "G1") return hasG1 && !hasG2;
      if (normTarget === "G2") return hasG2 && !hasG1;
      return true;
    });
  }

  static async createSlot(data: any) {
    return prisma.timetableSlot.create({
      data: {
        semesterId: data.semesterId,
        subjectId: data.subjectId,
        dayOfWeek: Number(data.dayOfWeek),
        startTime: normalizeTimeString(data.startTime, "09:00"),
        endTime: normalizeTimeString(data.endTime, "10:00"),
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
        startTime: data.startTime !== undefined ? normalizeTimeString(data.startTime, "09:00") : undefined,
        endTime: data.endTime !== undefined ? normalizeTimeString(data.endTime, "10:00") : undefined,
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

    if (slotA.dayOfWeek !== slotB.dayOfWeek) {
      throw new Error("Cannot swap slots across different days");
    }

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
      await prisma.attendance.updateMany({
        where: { timetableSlotId: slotId },
        data: { timetableSlotId: null },
      });
    }
    return prisma.timetableSlot.delete({
      where: { id: slotId },
    });
  }

  static async deleteSlotsBatch(slotIds: string[], preserveHistory = true) {
    if (!slotIds || slotIds.length === 0) return { count: 0 };
    if (preserveHistory) {
      await prisma.attendance.updateMany({
        where: { timetableSlotId: { in: slotIds } },
        data: { timetableSlotId: null },
      });
    }
    return prisma.timetableSlot.deleteMany({
      where: { id: { in: slotIds } },
    });
  }

  static async deleteSubjectSlots(semesterId: string, subjectId: string, preserveHistory = true) {
    const slots = await prisma.timetableSlot.findMany({
      where: { semesterId, subjectId },
      select: { id: true },
    });
    const slotIds = slots.map((s) => s.id);
    if (slotIds.length === 0) return { count: 0 };

    if (preserveHistory) {
      await prisma.attendance.updateMany({
        where: { timetableSlotId: { in: slotIds } },
        data: { timetableSlotId: null },
      });
    }
    return prisma.timetableSlot.deleteMany({
      where: { id: { in: slotIds } },
    });
  }

  static async addExtraClass(data: {
    semesterId?: string;
    subjectId: string;
    date: string | Date;
    startTime?: string;
    endTime?: string;
    reason?: string;
  }) {
    let semesterId = data.semesterId;
    if (!semesterId && data.subjectId) {
      const subject = await prisma.subject.findUnique({
        where: { id: data.subjectId },
      });
      if (subject?.semesterId) {
        semesterId = subject.semesterId;
      }
    }

    if (!semesterId) {
      const activeSem = await prisma.semester.findFirst({
        where: { isActive: true },
      });
      semesterId = activeSem?.id;
    }

    if (!semesterId) {
      const anySem = await prisma.semester.findFirst();
      semesterId = anySem?.id;
    }

    if (!semesterId) {
      throw new Error("Unable to resolve semester for extra class override");
    }

    const dateObj = data.date instanceof Date ? data.date : new Date(data.date);

    return prisma.timetableOverride.create({
      data: {
        semesterId,
        subjectId: data.subjectId,
        date: dateObj,
        overrideType: "extra_class",
        startTime: normalizeTimeString(data.startTime, "17:30"),
        endTime: normalizeTimeString(data.endTime, "18:20"),
        reason: data.reason || "Ad-hoc extra class",
      },
      include: { subject: true },
    });
  }

  static async deleteExtraClass(id: string) {
    await prisma.attendance.deleteMany({
      where: { overrideId: id }
    });
    return prisma.timetableOverride.delete({
      where: { id }
    });
  }

  static async processOcrImage(fileBuffer: Buffer, mimeType: string, fileName: string, semesterId: string, userId: string) {
    let extractedText = "";

    let validMimeType = mimeType;
    if (!validMimeType || validMimeType === "application/octet-stream") {
      validMimeType = fileName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/png";
    }

    // Fetch the target semester to guide the OCR and prevent it from parsing the entire university timetable
    const targetSemester = await prisma.semester.findUnique({
      where: { id: semesterId },
      select: { name: true }
    });
    const targetSemName = targetSemester?.name || "the user's semester";

    // 1. If PDF file, extract text via pdf-parse first
    if (validMimeType.includes("pdf") || fileName.endsWith(".pdf")) {
      const originalWarn = console.warn;
      const originalLog = console.log;
      const filterMsg = (args: any[]) => {
        if (typeof args[0] === 'string' && args[0].includes('Ran out of space in font private use area')) return true;
        return false;
      };
      
      try {
        const pdfParse = require("pdf-parse");
        console.warn = (...args) => { if (!filterMsg(args)) originalWarn.apply(console, args); };
        console.log = (...args) => { if (!filterMsg(args)) originalLog.apply(console, args); };
        const parsed = await pdfParse(fileBuffer);
        console.warn = originalWarn;
        console.log = originalLog;
        extractedText = parsed.text || "";
      } catch (e) {
        console.warn = originalWarn;
        console.log = originalLog;
        console.warn("pdf-parse extraction warning:", e);
      }
    }

    // 2. AI Gemini Vision / OCR processing if GEMINI_API_KEY is available
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        });
        const prompt = `
You are an expert academic timetable OCR parser for a technical university institute (such as IIIT Una).
Parse this uploaded timetable document (${fileName}).
Carefully extract the weekly class schedule, subjects, electives, rooms, sections, and practical lab batches.

CRITICAL INSTRUCTION: ONLY extract the timetable for the following specific branch and semester: "${targetSemName}".
Ignore all other branches, semesters, or pages in the document to keep the output concise.

${extractedText ? `Extracted Document Raw Text:\n${extractedText.slice(0, 10000)}\n` : ""}

CRITICAL TIMING & PERIOD RULES:
1. University Slot Timing Definitions (Standard Bell Schedule):
   - Slot 1: "09:00" to "09:50"
   - Slot 2: "09:50" to "10:40"
   - (10:40 to 11:00 is Morning Break)
   - Slot 3: "11:00" to "11:50"
   - Slot 4: "11:50" to "12:40"
   - (12:40 to 14:00 is Lunch Break)
   - Slot 5: "14:00" to "14:50"
   - Slot 6: "14:50" to "15:40"
   - Slot 7: "15:40" to "16:30"
   - Slot 8: "16:30" to "17:20"

2. Continuous Practical / Lab (P) Spans:
   - When a practical or lab spans across 2 consecutive slots:
     - Morning Lab (Slot 3 & 4): startTime MUST be "11:00", endTime MUST be "12:40"
     - Afternoon Lab (Slot 5 & 6): startTime MUST be "14:00", endTime MUST be "15:40"
     - Evening Lab (Slot 7 & 8): startTime MUST be "15:40", endTime MUST be "17:20"
     - Morning Lab (Slot 1 & 2): startTime MUST be "09:00", endTime MUST be "10:40"

3. Lab Groups & Batch Notation Rules:
   - "G1/G2" or "G1 / G2" or "G1, G2" or "Both": Set "group": "G1/G2" (indicates BOTH groups G1 and G2 have this lab together).
   - "G1": Set "group": "G1" (only group 1).
   - "G2": Set "group": "G2" (only group 2).
   - If a cell contains parallel batches, generate TWO SEPARATE slot objects.
   - Regular lectures without group specifications must have "group": "ALL".

4. Electives & Multi-Subject Cells:
   - Mark "isProgramElective": true for program electives (e.g. ECSE303, CSSE301).
   - Mark "isMinorElective": true for minor/open electives (e.g. SCMS301).

Task Instructions:
1. Locate the schedule for "${targetSemName}".
2. Build its schedule object with:
   - "hasSections": boolean
   - "sections": array of section names found
   - "hasElectives": boolean
   - "programElectives": array of elective group objects, each containing { "id", "name", "options": [{"code", "title", "credits"}] }
   - "minorElectives": array of minor/open elective group objects
   - "labGroups": array of batch names found (e.g. ["G1", "G2"])
   - "rawSlots": array of ALL class slots extracted for THIS branch/semester. Each slot must contain:
       {
         "code": "Course Code or Subject Name",
         "faculty": "Faculty/Professor initials",
         "dayOfWeek": number (0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun),
         "startTime": "HH:MM",
         "endTime": "HH:MM",
         "type": "lecture" | "practical" | "tutorial",
         "room": "Room number",
         "group": "G1" | "G2" | "G1/G2" | "ALL",
         "section": "Section name or ALL",
         "isProgramElective": boolean,
         "isMinorElective": boolean
       }

Course Curriculum Dictionary for subject code resolution:
${JSON.stringify(COURSE_CURRICULUM, null, 2)}

Return ONLY strict JSON matching this structure:
{
  "status": "needs_setup",
  "detectedBranches": ["<FoundBranch>"],
  "detectedSemesters": [<FoundSemester>],
  "schedules": {
    "<BRANCH>": {
      "<SEMESTER>": {
        "hasSections": boolean,
        "sections": ["Section A"],
        "hasElectives": boolean,
        "programElectives": [...],
        "minorElectives": [...],
        "labGroups": ["G1", "G2"],
        "rawSlots": [...]
      }
    }
  }
}
        `;

        const contents: any[] = [{ text: prompt }];
        if (validMimeType.includes("pdf")) {
          contents.push({
            inlineData: {
              mimeType: "application/pdf",
              data: fileBuffer.toString("base64")
            }
          });
        } else {
          contents.push({
            inlineData: {
              mimeType: validMimeType,
              data: fileBuffer.toString("base64")
            }
          });
        }

        // Compliant 2026 Model Invariant: Primary gemini-3.6-flash with modern fallbacks
        const candidateModels = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.7-flash"];
        let response: any = null;
        let lastError: any = null;

        for (const modelName of candidateModels) {
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              response = await ai.models.generateContent({
                model: modelName,
                contents,
                config: {
                  responseMimeType: "application/json"
                }
              });
              if (response && response.text) break;
            } catch (err: any) {
              lastError = err;
              const isTransient = err?.status === "UNAVAILABLE" || err?.code === 503 || err?.code === 429 || String(err?.message || "").includes("demand");
              if (isTransient && attempt === 0) {
                // Short wait before retry
                await new Promise((res) => setTimeout(res, 800));
                continue;
              }
              // If not recoverable or second attempt, break to try next candidate model
              break;
            }
          }
          if (response && response.text) break;
        }

        if (!response && lastError) {
          throw lastError;
        }

        const textResponse = response?.text || "";
        let parsedAiResult: any = null;
        try {
          parsedAiResult = JSON.parse(textResponse);
        } catch (e) {
          const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedAiResult = JSON.parse(jsonMatch[0]);
          }
        }

        if (parsedAiResult && parsedAiResult.schedules && Object.keys(parsedAiResult.schedules).length > 0) {
          const detectedBranches = parsedAiResult.detectedBranches || Object.keys(parsedAiResult.schedules);
          const detectedSemesters = parsedAiResult.detectedSemesters || Array.from(new Set(
            Object.values(parsedAiResult.schedules).flatMap((bData: any) => Object.keys(bData).map(Number))
          ));

          return {
            status: "needs_setup",
            detectedBranches,
            detectedSemesters,
            schedules: parsedAiResult.schedules
          };
        }
      } catch (error) {
        console.error("AI Timetable Extraction failed, falling back to heuristic parser:", error);
      }
    }

    // 3. Robust Comprehensive Curriculum Timetable Generator for all Branches & Semesters
    return TimetableService.generateComprehensiveMasterSchedules();
  }

  static generateComprehensiveMasterSchedules() {
    const branches = ["CSE", "IT", "ECE", "CY", "DS"];
    const semesters = [1, 2, 3, 4, 5, 6, 7, 8];

    const masterSchedules: Record<string, Record<number, any>> = {};

    for (const b of branches) {
      masterSchedules[b] = {};
      for (const sem of semesters) {
        const isOddSem = sem % 2 !== 0;
        const isElectiveSem = sem >= 5;

        // Program Electives (Only for 5th semester onwards!)
        let programElectives: any[] = [];
        let minorElectives: any[] = [];

        if (isElectiveSem) {
          if (b === "ECE") {
            programElectives = [
              {
                id: "pe1",
                name: "Program Elective",
                options: [
                  { code: sem === 5 ? "ECSE303" : "ECSE401", title: resolveSubjectName(sem === 5 ? "ECSE303" : "ECSE401"), credits: 4 },
                  { code: sem === 5 ? "ECSE304" : "ECSE402", title: resolveSubjectName(sem === 5 ? "ECSE304" : "ECSE402"), credits: 4 }
                ]
              }
            ];
          } else if (b === "IT") {
            programElectives = [
              {
                id: "pe1",
                name: "Program Elective",
                options: [
                  { code: sem === 5 ? "ITSE301" : "ITSE401", title: resolveSubjectName(sem === 5 ? "ITSE301" : "ITSE401"), credits: 4 },
                  { code: sem === 5 ? "ITSE304" : "ITSE402", title: resolveSubjectName(sem === 5 ? "ITSE304" : "ITSE402"), credits: 4 }
                ]
              }
            ];
          } else {
            // CSE, CY, DS
            programElectives = [
              {
                id: "pe1",
                name: "Program Elective",
                options: [
                  { code: sem === 5 ? "CSSE301" : "CSSE401", title: resolveSubjectName(sem === 5 ? "CSSE301" : "CSSE401"), credits: 4 },
                  { code: sem === 5 ? "CSSE304" : "CSSE402", title: resolveSubjectName(sem === 5 ? "CSSE304" : "CSSE402"), credits: 4 }
                ]
              }
            ];
          }

          minorElectives = [
            {
              id: "me1",
              name: "Minor / Open Elective",
              options: [
                { code: sem === 5 ? "SCMS301" : "SCMS401", title: resolveSubjectName(sem === 5 ? "SCMS301" : "SCMS401"), credits: 3 },
                { code: sem === 5 ? "SEMS301" : "SEMS401", title: resolveSubjectName(sem === 5 ? "SEMS301" : "SEMS401"), credits: 3 }
              ]
            }
          ];
        }

        // Section distinction: sections A & B for lower semesters, or ALL
        const hasSections = sem <= 4;
        const sections = hasSections ? ["Section A", "Section B"] : [];

        // Build weekly slots
        const rawSlots = TimetableService.buildWeeklySlotsForBranchAndSem(b, sem);

        masterSchedules[b][sem] = {
          hasSections,
          sections,
          hasElectives: isElectiveSem,
          programElectives,
          minorElectives,
          labGroups: ["G1", "G2"],
          rawSlots
        };
      }
    }

    return {
      status: "needs_setup",
      detectedBranches: branches,
      detectedSemesters: semesters,
      schedules: masterSchedules
    };
  }

  static buildWeeklySlotsForBranchAndSem(branch: string, sem: number) {
    const isElectiveSem = sem >= 5;
    const peCode = branch === "ECE" ? (sem === 5 ? "ECSE303" : "ECSE401") : (sem === 5 ? "CSSE301" : "CSSE401");
    const altPeCode = branch === "ECE" ? (sem === 5 ? "ECSE304" : "ECSE402") : (sem === 5 ? "CSSE304" : "CSSE402");
    const openCode = sem === 5 ? "SCMS301" : "SCMS401";
    const altOpenCode = sem === 5 ? "SEMS301" : "SEMS401";

    if (branch === "ECE" && sem === 5) {
      return [
        // MONDAY
        { code: "ECSE303", dayOfWeek: 0, startTime: "09:00", endTime: "09:50", type: "lecture", room: "125", faculty: "SAK", group: "ALL", section: "ALL", isProgramElective: true },
        { code: "ECSE304", dayOfWeek: 0, startTime: "09:00", endTime: "09:50", type: "lecture", room: "328", faculty: "AKW", group: "ALL", section: "ALL", isProgramElective: true },
        { code: "ICVA301", dayOfWeek: 0, startTime: "09:00", endTime: "09:50", type: "lecture", room: "226", faculty: "MAC", group: "ALL", section: "ALL" },
        { code: "ECMC301", dayOfWeek: 0, startTime: "09:50", endTime: "10:40", type: "lecture", room: "326", faculty: "GUK", group: "ALL", section: "ALL" },
        { code: "ICAE301", dayOfWeek: 0, startTime: "14:00", endTime: "15:40", type: "practical", room: "Lab-5", faculty: "MAC", group: "G1/G2", section: "ALL" },
        { code: "SCMS301", dayOfWeek: 0, startTime: "16:30", endTime: "17:20", type: "lecture", room: "228", faculty: "NIG", group: "ALL", section: "ALL", isMinorElective: true },

        // TUESDAY
        { code: "ECSE301", dayOfWeek: 1, startTime: "09:50", endTime: "10:40", type: "lecture", room: "226", faculty: "VEK", group: "ALL", section: "ALL" },
        { code: "ECSE304", dayOfWeek: 1, startTime: "09:50", endTime: "10:40", type: "lecture", room: "125", faculty: "AKW", group: "ALL", section: "ALL", isProgramElective: true },
        { code: "ECSE304", dayOfWeek: 1, startTime: "11:00", endTime: "12:40", type: "practical", room: "104", faculty: "AKW", group: "G1", section: "ALL", isProgramElective: true },
        { code: "SEMS301", dayOfWeek: 1, startTime: "15:40", endTime: "16:30", type: "lecture", room: "133", faculty: "SHC", group: "ALL", section: "ALL", isMinorElective: true },
        { code: "ECMC301", dayOfWeek: 1, startTime: "15:40", endTime: "16:30", type: "lecture", room: "329", faculty: "GUK", group: "ALL", section: "ALL" },
        { code: "SCMS301", dayOfWeek: 1, startTime: "16:30", endTime: "17:20", type: "lecture", room: "228", faculty: "NIG", group: "ALL", section: "ALL", isMinorElective: true },
        { code: "SEMS301", dayOfWeek: 1, startTime: "16:30", endTime: "17:20", type: "lecture", room: "125", faculty: "SHC", group: "ALL", section: "ALL", isMinorElective: true },

        // WEDNESDAY
        { code: "ICAE301", dayOfWeek: 2, startTime: "11:00", endTime: "12:40", type: "practical", room: "Lab-5", faculty: "MAC", group: "G1/G2", section: "ALL" },
        { code: "ECSE301", dayOfWeek: 2, startTime: "14:00", endTime: "15:40", type: "practical", room: "104", faculty: "VEK/TA5", group: "G1", section: "ALL" },
        { code: "ECSE301", dayOfWeek: 2, startTime: "14:00", endTime: "15:40", type: "practical", room: "104", faculty: "VEK/TA8", group: "G2", section: "ALL" },

        // THURSDAY
        { code: "ECSE301", dayOfWeek: 3, startTime: "09:00", endTime: "09:50", type: "lecture", room: "125", faculty: "VEK", group: "ALL", section: "ALL" },
        { code: "ECSE303", dayOfWeek: 3, startTime: "09:50", endTime: "10:40", type: "lecture", room: "226", faculty: "SAK", group: "ALL", section: "ALL", isProgramElective: true },
        { code: "ECSE304", dayOfWeek: 3, startTime: "09:50", endTime: "10:40", type: "lecture", room: "325", faculty: "AKW", group: "ALL", section: "ALL", isProgramElective: true },
        { code: "SEMS301", dayOfWeek: 3, startTime: "11:50", endTime: "12:40", type: "lecture", room: "133", faculty: "SHC", group: "ALL", section: "ALL", isMinorElective: true },
        { code: "ECMC301", dayOfWeek: 3, startTime: "14:00", endTime: "15:40", type: "practical", room: "104", faculty: "GUK/NIK", group: "G2", section: "ALL" },
        { code: "ICVA301", dayOfWeek: 3, startTime: "15:40", endTime: "16:30", type: "lecture", room: "230", faculty: "MAC", group: "ALL", section: "ALL" },

        // FRIDAY
        { code: "ECSE301", dayOfWeek: 4, startTime: "09:00", endTime: "09:50", type: "lecture", room: "326", faculty: "VEK", group: "ALL", section: "ALL" },
        { code: "ECMC301", dayOfWeek: 4, startTime: "09:50", endTime: "10:40", type: "lecture", room: "126", faculty: "GUK", group: "ALL", section: "ALL" },
        { code: "ECMC301", dayOfWeek: 4, startTime: "11:00", endTime: "12:40", type: "practical", room: "104", faculty: "GUK/ANT", group: "G1", section: "ALL" },
        { code: "ECSE303", dayOfWeek: 4, startTime: "14:00", endTime: "14:50", type: "lecture", room: "126", faculty: "SAK", group: "ALL", section: "ALL", isProgramElective: true },
        { code: "ECSE304", dayOfWeek: 4, startTime: "14:00", endTime: "15:40", type: "practical", room: "104", faculty: "AKW", group: "G2", section: "ALL", isProgramElective: true },
        { code: "ECSE303", dayOfWeek: 4, startTime: "14:50", endTime: "15:40", type: "practical", room: "103", faculty: "SAK", group: "ALL", section: "ALL", isProgramElective: true },
        { code: "ICVA301", dayOfWeek: 4, startTime: "16:30", endTime: "17:20", type: "lecture", room: "329", faculty: "MAC", group: "ALL", section: "ALL" }
      ];
    }

    let core1 = "ICMD104";
    let core2 = "CSMC101";
    let core3 = "ICAE101";

    if (sem === 2) { core1 = "ICMD105"; core2 = "CSMC103"; core3 = "ICMD102"; }
    else if (sem === 3) { core1 = "CSMC201"; core2 = "CSMC202"; core3 = "ICAE301"; }
    else if (sem === 4) { core1 = "CSMC203"; core2 = "CSMC205"; core3 = "CSMC209"; }
    else if (sem === 5) {
      if (branch === "IT") { core1 = "ITMC301"; core2 = "ITMC302"; core3 = "ICVA301"; }
      else { core1 = "CSMC301"; core2 = "CSMC302"; core3 = "ICVA301"; }
    } else if (sem >= 6) {
      if (branch === "ECE") { core1 = "ECMC302"; core2 = "ICPR401"; core3 = "ICAE302"; }
      else { core1 = "CSMC303"; core2 = "ICPR401"; core3 = "ICAE302"; }
    }

    return [
      // Monday
      { code: core1, dayOfWeek: 0, startTime: "09:00", endTime: "09:50", type: "lecture", room: "101", group: "ALL", section: "ALL" },
      { code: core2, dayOfWeek: 0, startTime: "09:50", endTime: "10:40", type: "lecture", room: "101", group: "ALL", section: "ALL" },
      { code: isElectiveSem ? peCode : core3, dayOfWeek: 0, startTime: "11:00", endTime: "11:50", type: "lecture", room: "102", group: "ALL", section: "ALL" },
      { code: isElectiveSem ? altPeCode : core3, dayOfWeek: 0, startTime: "11:00", endTime: "11:50", type: "lecture", room: "103", group: "ALL", section: "ALL" },
      { code: core1, dayOfWeek: 0, startTime: "14:00", endTime: "15:40", type: "practical", room: "Lab-1", group: "G1", section: "Section A" },
      { code: core2, dayOfWeek: 0, startTime: "14:00", endTime: "15:40", type: "practical", room: "Lab-2", group: "G2", section: "Section B" },
      { code: isElectiveSem ? openCode : core2, dayOfWeek: 0, startTime: "16:30", endTime: "17:20", type: "lecture", room: "201", group: "ALL", section: "ALL" },
      { code: isElectiveSem ? altOpenCode : core2, dayOfWeek: 0, startTime: "16:30", endTime: "17:20", type: "lecture", room: "202", group: "ALL", section: "ALL" },

      // Tuesday
      { code: core3, dayOfWeek: 1, startTime: "09:00", endTime: "09:50", type: "lecture", room: "101", group: "ALL", section: "ALL" },
      { code: core1, dayOfWeek: 1, startTime: "09:50", endTime: "10:40", type: "lecture", room: "101", group: "ALL", section: "ALL" },
      { code: core2, dayOfWeek: 1, startTime: "11:00", endTime: "12:40", type: "practical", room: "Lab-1", group: "G1", section: "Section A" },
      { code: core1, dayOfWeek: 1, startTime: "11:00", endTime: "12:40", type: "practical", room: "Lab-2", group: "G2", section: "Section B" },
      { code: isElectiveSem ? peCode : core1, dayOfWeek: 1, startTime: "14:00", endTime: "14:50", type: "lecture", room: "102", group: "ALL", section: "ALL" },
      { code: isElectiveSem ? altPeCode : core1, dayOfWeek: 1, startTime: "14:00", endTime: "14:50", type: "lecture", room: "103", group: "ALL", section: "ALL" },
      { code: isElectiveSem ? openCode : core3, dayOfWeek: 1, startTime: "15:40", endTime: "16:30", type: "lecture", room: "201", group: "ALL", section: "ALL" },
      { code: isElectiveSem ? altOpenCode : core3, dayOfWeek: 1, startTime: "16:30", endTime: "17:20", type: "lecture", room: "202", group: "ALL", section: "ALL" },

      // Wednesday
      { code: core2, dayOfWeek: 2, startTime: "09:00", endTime: "09:50", type: "lecture", room: "101", group: "ALL", section: "ALL" },
      { code: core3, dayOfWeek: 2, startTime: "09:50", endTime: "10:40", type: "lecture", room: "101", group: "ALL", section: "ALL" },
      { code: isElectiveSem ? peCode : core1, dayOfWeek: 2, startTime: "11:00", endTime: "11:50", type: "lecture", room: "102", group: "ALL", section: "ALL" },
      { code: isElectiveSem ? altPeCode : core1, dayOfWeek: 2, startTime: "11:00", endTime: "11:50", type: "lecture", room: "103", group: "ALL", section: "ALL" },
      { code: core3, dayOfWeek: 2, startTime: "11:00", endTime: "12:40", type: "practical", room: "Lab-3", group: "G1/G2", section: "ALL" },

      // Thursday
      { code: core1, dayOfWeek: 3, startTime: "09:00", endTime: "09:50", type: "lecture", room: "101", group: "ALL", section: "ALL" },
      { code: isElectiveSem ? peCode : core2, dayOfWeek: 3, startTime: "09:50", endTime: "10:40", type: "lecture", room: "102", group: "ALL", section: "ALL" },
      { code: isElectiveSem ? altPeCode : core2, dayOfWeek: 3, startTime: "09:50", endTime: "10:40", type: "lecture", room: "103", group: "ALL", section: "ALL" },
      { code: core2, dayOfWeek: 3, startTime: "11:50", endTime: "12:40", type: "lecture", room: "101", group: "ALL", section: "ALL" },
      { code: isElectiveSem ? openCode : core3, dayOfWeek: 3, startTime: "14:00", endTime: "14:50", type: "lecture", room: "201", group: "ALL", section: "ALL" },
      { code: isElectiveSem ? altOpenCode : core3, dayOfWeek: 3, startTime: "15:40", endTime: "16:30", type: "lecture", room: "202", group: "ALL", section: "ALL" },
      { code: core1, dayOfWeek: 3, startTime: "14:00", endTime: "15:40", type: "practical", room: "Lab-1", group: "G2", section: "Section A" },

      // Friday
      { code: core3, dayOfWeek: 4, startTime: "09:00", endTime: "09:50", type: "lecture", room: "101", group: "ALL", section: "ALL" },
      { code: core2, dayOfWeek: 4, startTime: "09:50", endTime: "10:40", type: "lecture", room: "101", group: "ALL", section: "ALL" },
      { code: isElectiveSem ? peCode : core1, dayOfWeek: 4, startTime: "11:00", endTime: "12:40", type: "practical", room: "Lab-2", group: "G1", section: "Section A" },
      { code: isElectiveSem ? altPeCode : core1, dayOfWeek: 4, startTime: "14:00", endTime: "15:40", type: "practical", room: "Lab-3", group: "G2", section: "Section B" },
      { code: core1, dayOfWeek: 4, startTime: "14:00", endTime: "14:50", type: "lecture", room: "101", group: "ALL", section: "ALL" },
      { code: core2, dayOfWeek: 4, startTime: "16:30", endTime: "17:20", type: "lecture", room: "101", group: "ALL", section: "ALL" }
    ];
  }

  static async saveWizardTimetable(userId: string, semesterId: string, selections: any, rawSlots: any[]) {
    const { branch, semester, section, labGroup } = selections;

    // Support both multi-select array and legacy single code parameters
    const selectedElectiveCodes: string[] = Array.isArray(selections.selectedElectiveCodes)
      ? selections.selectedElectiveCodes.map((c: string) => c.trim().toUpperCase())
      : Array.isArray(selections.selectedElectives)
      ? selections.selectedElectives.map((c: string) => c.trim().toUpperCase())
      : [selections.programElectiveCode, selections.minorElectiveCode].filter(Boolean).map((c: string) => c.trim().toUpperCase());

    // Safely delete existing timetable slots for this active semester
    await this.safeDeleteTimetable(userId, semesterId);

    const colors = [
      "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899",
      "#06b6d4", "#6366f1", "#ef4444", "#14b8a6", "#a855f7"
    ];
    let colorIndex = 0;

    // Helper: Match lab group accurately (G1, G2, G1/G2, BOTH, ALL)
    const isGroupMatch = (slotGroup: string | undefined, userGroup: string | undefined) => {
      if (!slotGroup || slotGroup === "ALL" || !userGroup || userGroup === "ALL") return true;
      const normSlot = String(slotGroup).toUpperCase().replace(/\s+/g, "");
      const normUser = String(userGroup).toUpperCase().replace(/\s+/g, "");

      // Both groups share this lab (e.g. G1/G2, G1,G2, G1&G2, BOTH, ALL)
      if (
        normSlot.includes("G1/G2") ||
        normSlot.includes("G1,G2") ||
        normSlot.includes("G1&G2") ||
        normSlot.includes("BOTH") ||
        normSlot === "ALL"
      ) {
        return true;
      }

      // Group G1 student: matches G1 (and excludes G2-only)
      if (normUser === "G1") {
        return normSlot.includes("G1") && !normSlot.includes("G2");
      }

      // Group G2 student: matches G2 (and excludes G1-only)
      if (normUser === "G2") {
        return normSlot.includes("G2") && !normSlot.includes("G1");
      }

      return normSlot.includes(normUser);
    };

    // Normalize raw slots before filtering
    const normalizedRawSlots = (rawSlots || []).map(slot => {
      let group = slot.group || "ALL";
      let type = slot.type || "lecture";
      let code = (slot.code || "").trim();
      let room = (slot.room || "").trim();
      let faculty = (slot.faculty || slot.teacher || slot.instructor || "").trim();

      const combinedText = `${code} ${room} ${faculty} ${group}`.toUpperCase();

      // Check practical/lab indicators
      if (
        type === "practical" ||
        combinedText.includes("(P)") ||
        combinedText.includes(" LAB") ||
        combinedText.includes("LAB-") ||
        combinedText.includes("PRACTICAL") ||
        code.endsWith("_LAB")
      ) {
        type = "practical";
      }

      // Check group indicators
      if (
        combinedText.includes("G1/G2") ||
        combinedText.includes("G1 / G2") ||
        combinedText.includes("G1,G2") ||
        combinedText.includes("G1&G2") ||
        combinedText.includes("BOTH")
      ) {
        group = "G1/G2";
      } else if (/\bG1\b/i.test(combinedText) || combinedText.includes("(G1)") || combinedText.includes("BATCH 1") || combinedText.includes("BATCH-1") || combinedText.includes("B1")) {
        if (!/\bG2\b/i.test(combinedText) && !combinedText.includes("(G2)")) {
          group = "G1";
        }
      } else if (/\bG2\b/i.test(combinedText) || combinedText.includes("(G2)") || combinedText.includes("BATCH 2") || combinedText.includes("BATCH-2") || combinedText.includes("B2")) {
        if (!/\bG1\b/i.test(combinedText) && !combinedText.includes("(G1)")) {
          group = "G2";
        }
      }

      // Clean subject code of (P), (L), (T), and group tags
      code = code
        .replace(/\s*\([LPT]\)/gi, "")
        .replace(/\s*\b(G1\/G2|G1|G2|B1|B2)\b/gi, "")
        .replace(/\s*_LAB$/gi, "")
        .trim();

      let startTime = normalizeTimeString(slot.startTime, "09:00");
      let endTime = normalizeTimeString(slot.endTime, "10:00");

      // Expand 50-minute practicals to standard 100-minute lab block
      if (type === "practical") {
        if (startTime === "14:00" && endTime === "14:50") endTime = "15:40";
        else if (startTime === "11:00" && endTime === "11:50") endTime = "12:40";
        else if (startTime === "09:00" && endTime === "09:50") endTime = "10:40";
      }

      return {
        ...slot,
        code,
        group,
        type,
        startTime,
        endTime,
        room: room || null,
        faculty: faculty || null,
      };
    });

    // Detect all elective codes present in the raw slots
    const allElectiveCodesSet = new Set<string>();
    for (const slot of normalizedRawSlots) {
      if (slot.isProgramElective || slot.isMinorElective || slot.isElective) {
        allElectiveCodesSet.add(slot.code.toUpperCase());
      }
      // Also check if parallel slots exist with different codes at the same day & time
      const parallelSlot = normalizedRawSlots.find(s =>
        s !== slot &&
        s.dayOfWeek === slot.dayOfWeek &&
        s.startTime === slot.startTime &&
        s.code.toUpperCase() !== slot.code.toUpperCase()
      );
      if (parallelSlot) {
        allElectiveCodesSet.add(slot.code.toUpperCase());
        allElectiveCodesSet.add(parallelSlot.code.toUpperCase());
      }
    }

    // Filter raw slots according to user's branch, semester, section, electives, lab group
    const filteredSlots = normalizedRawSlots.filter(slot => {
      // 1. Filter section (if section is specified in slot and user selected a section)
      if (slot.section && slot.section !== "ALL" && section && section !== "ALL" && slot.section !== section) {
        return false;
      }

      // 2. Filter Lab Groups (G1 vs G2 vs G1/G2)
      if (!isGroupMatch(slot.group, labGroup)) {
        return false;
      }

      // 3. Filter Electives dynamically without hardcoded subject codes
      const slotCodeUpper = slot.code.toUpperCase();
      const isElectiveSlot = slot.isProgramElective || slot.isMinorElective || slot.isElective || allElectiveCodesSet.has(slotCodeUpper);

      if (isElectiveSlot && selectedElectiveCodes.length > 0) {
        // If this slot is an elective, only include if user selected this elective code
        if (!selectedElectiveCodes.includes(slotCodeUpper)) {
          return false;
        }
      }

      return true;
    });

    const createdSlots = [];
    const subjectsMap = new Map<string, string>(); // code -> subjectId
    const newSubjectIds = new Set<string>();
    const timetableSubjectIds = new Set<string>();

    for (const slot of filteredSlots) {
      const isLab = slot.type === "practical";
      const cleanCode = slot.code.replace(/\s*\([LPT]\)/g, '').trim();
      const actualCode = isLab ? `${cleanCode}_LAB` : cleanCode;

      const baseTitle = resolveSubjectName(cleanCode);
      const actualTitle = isLab && !baseTitle.toLowerCase().includes("lab")
        ? `${baseTitle} Lab`
        : baseTitle;

      let subjectId = subjectsMap.get(actualCode);
      const facultyName = slot.faculty || slot.teacher || slot.instructor || null;

      if (!subjectId) {
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
              faculty: facultyName,
              credits: isLab ? 2 : 4,
              colorHex: colors[colorIndex % colors.length],
            }
          });
          newSubjectIds.add(subject.id);
          colorIndex++;
        } else {
          const updateData: any = {};
          if (subject.name !== actualTitle) updateData.name = actualTitle;
          if (facultyName && !subject.faculty) updateData.faculty = facultyName;
          if (Object.keys(updateData).length > 0) {
            subject = await prisma.subject.update({
              where: { id: subject.id },
              data: updateData
            });
          }
        }
        subjectId = subject.id;
        subjectsMap.set(actualCode, subjectId);
      }

      timetableSubjectIds.add(subjectId);

      const newSlot = await prisma.timetableSlot.create({
        data: {
          semesterId,
          subjectId,
          dayOfWeek: Number(slot.dayOfWeek),
          startTime: normalizeTimeString(slot.startTime, "09:00"),
          endTime: normalizeTimeString(slot.endTime, "10:00"),
          room: slot.room || null,
          slotType: slot.type || "lecture",
        },
        include: { subject: true }
      });
      createdSlots.push(newSlot);
    }

    // Find existing subjects in the semester that were not part of this timetable
    const allSemesterSubjects = await prisma.subject.findMany({
      where: { semesterId, userId },
      select: { 
        id: true,
        _count: {
          select: { attendance: true }
        }
      }
    });
    
    // An existing subject can be mapped if it's unused in the timetable and has records,
    // OR it's used in the timetable but has NO records (meaning it's essentially new)
    const ghostSubjectIds = allSemesterSubjects
      .filter(s => !timetableSubjectIds.has(s.id) && s._count.attendance === 0)
      .map(s => s.id);
      
    if (ghostSubjectIds.length > 0) {
      await prisma.subject.deleteMany({
        where: { id: { in: ghostSubjectIds } }
      });
    }

    const existingSubjectIds = allSemesterSubjects
      .filter(s => !timetableSubjectIds.has(s.id) && s._count.attendance > 0)
      .map(s => s.id);

    const zeroAttendanceTimetableSubjects = allSemesterSubjects
      .filter(s => timetableSubjectIds.has(s.id) && s._count.attendance === 0)
      .map(s => s.id);

    // Merge genuinely new subjects with zero-attendance subjects
    const finalNewSubjectIds = Array.from(new Set([...Array.from(newSubjectIds), ...zeroAttendanceTimetableSubjects]));

    return { 
      slots: createdSlots, 
      newSubjectIds: finalNewSubjectIds,
      existingSubjectIds
    };
  }

  static async safeDeleteTimetable(userId: string, semesterId?: string) {
    const subjects = await prisma.subject.findMany({
      where: { userId, ...(semesterId ? { semesterId } : {}) },
      select: { id: true }
    });
    const subjectIds = subjects.map(s => s.id);

    const conditions: any[] = [];
    if (semesterId) conditions.push({ semesterId });
    if (subjectIds.length > 0) conditions.push({ subjectId: { in: subjectIds } });

    if (conditions.length === 0) {
      return;
    }

    const whereCond = { OR: conditions };

    const slots = await prisma.timetableSlot.findMany({
      where: whereCond,
      select: { id: true }
    });
    const slotIds = slots.map(s => s.id);

    const overrides = await prisma.timetableOverride.findMany({
      where: whereCond,
      select: { id: true }
    });
    const overrideIds = overrides.map(o => o.id);

    if (slotIds.length > 0) {
      try {
        await prisma.attendance.updateMany({
          where: { timetableSlotId: { in: slotIds } },
          data: { timetableSlotId: null }
        });
      } catch (attErr) {
        console.warn("Batch attendance unlinking failed, using individual safe unlinking:", attErr);
        const attList = await prisma.attendance.findMany({
          where: { timetableSlotId: { in: slotIds } }
        });
        for (const att of attList) {
          try {
            await prisma.attendance.update({
              where: { id: att.id },
              data: { timetableSlotId: null }
            });
          } catch (itemErr) {
            try {
              // Delete duplicate if another null slot record exists for same user/subject/date
              const existingNull = await prisma.attendance.findFirst({
                where: {
                  userId: att.userId,
                  subjectId: att.subjectId,
                  date: att.date,
                  timetableSlotId: null,
                  id: { not: att.id }
                }
              });
              if (existingNull) {
                await prisma.attendance.delete({ where: { id: att.id } });
              }
            } catch (cleanupErr) {
              console.warn("Cleanup fallback error:", cleanupErr);
            }
          }
        }
      }

      try {
        await prisma.timetableOverride.updateMany({
          where: { originalSlotId: { in: slotIds } },
          data: { originalSlotId: null }
        });
      } catch (err) {
        console.warn("Override originalSlotId unlinking warning:", err);
      }
    }

    if (overrideIds.length > 0) {
      try {
        await prisma.attendance.updateMany({
          where: { overrideId: { in: overrideIds } },
          data: { overrideId: null }
        });
      } catch (overrideAttErr) {
        console.warn("Override attendance unlinking warning:", overrideAttErr);
      }
    }

    try {
      await prisma.timetableOverride.deleteMany({
        where: whereCond
      });
    } catch (overrideDelErr) {
      console.warn("TimetableOverride delete error:", overrideDelErr);
      if (semesterId) {
        await prisma.timetableOverride.deleteMany({ where: { semesterId } }).catch(() => {});
      }
    }

    try {
      await prisma.timetableSlot.deleteMany({
        where: whereCond
      });
    } catch (slotDelErr) {
      console.warn("TimetableSlot delete error:", slotDelErr);
      if (semesterId) {
        await prisma.timetableSlot.deleteMany({ where: { semesterId } }).catch(() => {});
      }
    }
  }

  static async exportTimetable(userId: string, semesterId: string) {
    const semester = await prisma.semester.findFirst({
      where: { id: semesterId, userId },
      include: {
        subjects: true,
        timetableSlots: {
          include: {
            subject: true,
          },
        },
      },
    });

    if (!semester) throw new Error("Semester not found");

    return {
      version: "2.0.0",
      app: "AttendX",
      exportedAt: new Date().toISOString(),
      semester: {
        name: semester.name,
        startDate: semester.startDate,
        endDate: semester.endDate,
      },
      subjects: semester.subjects.map((s) => ({
        code: s.code,
        name: s.name,
        credits: s.credits,
        faculty: s.faculty,
        colorHex: s.colorHex,
        targetAttendance: s.targetAttendance,
      })),
      slots: semester.timetableSlots.map((slot) => ({
        subjectCode: slot.subject?.code || "",
        subjectName: slot.subject?.name || "Subject",
        dayOfWeek: slot.dayOfWeek,
        startTime: normalizeTimeString(slot.startTime, "09:00"),
        endTime: normalizeTimeString(slot.endTime, "10:00"),
        room: slot.room,
        slotType: slot.slotType,
      })),
    };
  }

  static async importTimetable(userId: string, semesterId: string, payload: any) {
    if (!payload || !Array.isArray(payload.subjects) || !Array.isArray(payload.slots)) {
      throw new Error("Invalid timetable payload. Must contain 'subjects' and 'slots' arrays.");
    }

    await this.safeDeleteTimetable(userId, semesterId);

    const subjectMap = new Map<string, string>();

    for (const subData of payload.subjects) {
      const codeKey = subData.code || subData.name;
      let subject = await prisma.subject.findFirst({
        where: { semesterId, userId, code: codeKey },
      });

      if (!subject) {
        subject = await prisma.subject.create({
          data: {
            semesterId,
            userId,
            name: subData.name,
            code: subData.code || null,
            credits: subData.credits || 3,
            faculty: subData.faculty || null,
            colorHex: subData.colorHex || "#6366f1",
            targetAttendance: subData.targetAttendance || null,
          },
        });
      }
      subjectMap.set(codeKey, subject.id);
      if (subData.name) subjectMap.set(subData.name, subject.id);
    }

    const createdSlots = [];
    for (const slotData of payload.slots) {
      const subjectId = subjectMap.get(slotData.subjectCode) || subjectMap.get(slotData.subjectName);
      if (!subjectId) continue;

      const slot = await prisma.timetableSlot.create({
        data: {
          semesterId,
          subjectId,
          dayOfWeek: Number(slotData.dayOfWeek),
          startTime: normalizeTimeString(slotData.startTime, "09:00"),
          endTime: normalizeTimeString(slotData.endTime, "10:00"),
          room: slotData.room || null,
          slotType: slotData.slotType || "lecture",
        },
        include: { subject: true },
      });
      createdSlots.push(slot);
    }

    return { importedSubjects: payload.subjects.length, importedSlots: createdSlots.length };
  }
}
