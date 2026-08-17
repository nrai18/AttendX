import { prisma } from "../lib/prisma";

export class EventService {
  static async getEvents(userId: string, startDate?: string, endDate?: string) {
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      };
    } else if (startDate) {
      dateFilter = {
        date: { gte: new Date(startDate) }
      };
    }

    return prisma.event.findMany({
      where: {
        userId,
        ...dateFilter
      },
      orderBy: { date: "asc" }
    });
  }

  static async processCalendarOcr(userId: string, fileBuffer: Buffer, semesterId: string, fileName: string = "", mimeType: string = "") {
    let extractedText = "";

    // 1. If PDF file, extract text via pdf-parse first
    if (mimeType.includes("pdf") || fileName.endsWith(".pdf")) {
      try {
        // Lazy require to avoid module-level startup crash in production
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pdfParse = require("pdf-parse");
        const parsed = await pdfParse(fileBuffer);
        extractedText = parsed.text || "";
      } catch (e) {
        console.warn("pdf-parse extraction warning:", e);
      }
    }

    // 2. AI Gemini Vision / OCR processing
    if (process.env.GEMINI_API_KEY) {
      const { GoogleGenAI } = require("@google/genai");
      try {
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: { headers: { "User-Agent": "aistudio-build" } },
        });

        const prompt = `
You are an expert academic calendar parser for a technical university.
Parse this uploaded academic calendar document (${fileName}).
Extract all important dates including Exams, Holidays, Fests, Semester Start/End dates, and any other significant academic events.

${extractedText ? `Extracted Document Raw Text:\n${extractedText.slice(0, 10000)}\n` : ""}

Guidelines for eventType field:
- "midsem" for Mid Semester Exams / Practical Exams
- "endsem" for End Semester Theory / Lab Exams
- "holiday" for single day holidays, gazetted holidays, or breaks
- "fest" for cultural/technical/sports fests like Mridang, Yalgaar, Meraki
- "institute" for Institute Day, Convocation, etc.
- "vacation" for Winter/Summer vacations or semester breaks
- "academic" for generic academic milestones (Registration, Grade submission, etc.)

Dates must be in 'YYYY-MM-DD' format. If an event spans multiple days, provide 'endDate'.

Return ONLY strict JSON matching this structure:
{
  "status": "needs_setup",
  "rawEvents": [
    {
      "title": "Event Title",
      "eventType": "midsem|endsem|holiday|fest|institute|vacation|academic",
      "date": "2026-09-21",
      "endDate": "2026-09-23" // optional
    }
  ]
}
`;

        const contents: any[] = [prompt];
        if (mimeType.includes("pdf") || fileName.endsWith(".pdf")) {
          contents.push({
            inlineData: { mimeType: "application/pdf", data: fileBuffer.toString("base64") }
          });
        } else {
          contents.push({
            inlineData: { mimeType: mimeType || "image/png", data: fileBuffer.toString("base64") }
          });
        }

        const candidateModels = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.7-flash"];
        let response: any = null;
        let lastError: any = null;

        for (const modelName of candidateModels) {
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              response = await ai.models.generateContent({
                model: modelName,
                contents,
                config: { responseMimeType: "application/json" }
              });
              if (response && response.text) break;
            } catch (err: any) {
              lastError = err;
              const isTransient = err?.status === "UNAVAILABLE" || err?.code === 503 || err?.code === 429 || String(err?.message || "").includes("demand");
              if (isTransient && attempt === 0) {
                await new Promise((res) => setTimeout(res, 800));
                continue;
              }
              break;
            }
          }
          if (response && response.text) break;
        }

        if (!response && lastError) throw lastError;

        const textResponse = response?.text || "";
        let parsedAiResult: any = null;
        try {
          parsedAiResult = JSON.parse(textResponse);
        } catch (e) {
          const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) parsedAiResult = JSON.parse(jsonMatch[0]);
        }

        if (parsedAiResult && parsedAiResult.rawEvents) {
          return {
            status: parsedAiResult.status || "needs_setup",
            rawEvents: parsedAiResult.rawEvents
          };
        }
      } catch (err) {
        console.error("Gemini Calendar OCR Error:", err);
      }
    }

    // Fallback to empty if AI fails or no API key
    return {
      status: "needs_setup",
      rawEvents: []
    };
  }

  static async saveWizardEvents(userId: string, semesterId: string, events: any[]) {
    // Save the user confirmed events
    const createdEvents = await Promise.all(
      events.map((evt) => 
        prisma.event.create({
          data: {
            userId,
            semesterId,
            title: evt.title,
            eventType: evt.eventType,
            date: new Date(evt.date),
            endDate: evt.endDate ? new Date(evt.endDate) : null,
            allDay: true,
          }
        })
      )
    );

    return createdEvents;
  }

  static async getTodayStatus(userId: string, semesterId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeEvents = await prisma.event.findMany({
      where: {
        userId,
        semesterId,
        date: { lte: today },
        OR: [
          { endDate: null },
          { endDate: { gte: today } }
        ]
      }
    });

    const nextEvents = await prisma.event.findMany({
      where: {
        userId,
        semesterId,
        date: { gt: today }
      },
      orderBy: { date: "asc" },
      take: 1
    });

    return {
      activeEvent: activeEvents.length > 0 ? activeEvents[0] : null,
      nextEvent: nextEvents.length > 0 ? nextEvents[0] : null
    };
  }

  static async clearAllEvents(userId: string) {
    const semesters = await prisma.semester.findMany({
      where: { userId },
      select: { id: true }
    });
    const semesterIds = semesters.map(s => s.id);

    return prisma.event.deleteMany({
      where: {
        OR: [
          { userId },
          ...(semesterIds.length > 0 ? [{ semesterId: { in: semesterIds } }] : [])
        ]
      }
    });
  }
}
