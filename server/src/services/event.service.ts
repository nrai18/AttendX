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

  static async processCalendarOcr(userId: string, fileBuffer: Buffer, semesterId: string, mimeType: string = "image/jpeg") {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured on the server.");
    }
    const { GoogleGenAI, Type, Schema } = require("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const base64File = fileBuffer.toString("base64");
    
    const schema = {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING, description: "Must be 'needs_setup'" },
        rawEvents: {
          type: Type.ARRAY,
          description: "List of extracted academic events, holidays, and exams.",
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Name of the event" },
              eventType: { type: Type.STRING, description: "Categorize as: 'midsem', 'endsem', 'holiday', 'fest', 'institute', 'vacation', 'exam', or 'other'" },
              date: { type: Type.STRING, description: "Start date in YYYY-MM-DD format (infer the year from context, assume 2026 if unclear)" },
              endDate: { type: Type.STRING, description: "End date in YYYY-MM-DD format (only if it spans multiple days, else omit)" }
            }
          }
        }
      },
      required: ["status", "rawEvents"]
    };

    const prompt = "You are an academic calendar extraction assistant. Analyze this academic calendar. Extract all holidays, exams, vacations, fests, and important institute events. Output them as a structured list of events with exact dates in YYYY-MM-DD format. If a year is not explicitly mentioned for a month, infer it chronologically (e.g., if the calendar starts in August 2026, January will be 2027). Set status to 'needs_setup'.";

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [
          { text: prompt }, 
          { inlineData: { mimeType: mimeType, data: base64File } }
        ]}
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    });

    if (!response.text) {
      throw new Error("Failed to generate content from Gemini");
    }

    return JSON.parse(response.text);
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
}
