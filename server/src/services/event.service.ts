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

  static async processCalendarOcr(userId: string, imageBuffer: Buffer, semesterId: string, mimeType?: string) {
    console.log("Mocking Calendar OCR extraction process...");
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Return hardcoded mock data for the calendar events
    return [
      {
        semesterId,
        title: "Mid-Semester Exams",
        eventType: "midsem",
        date: new Date("2026-09-20").toISOString(),
        description: "Auto-extracted from academic calendar"
      },
      {
        semesterId,
        title: "Diwali Vacation",
        eventType: "vacation",
        date: new Date("2026-11-12").toISOString(),
        description: "Auto-extracted from academic calendar"
      },
      {
        semesterId,
        title: "End-Semester Exams",
        eventType: "endsem",
        date: new Date("2026-12-05").toISOString(),
        description: "Auto-extracted from academic calendar"
      }
    ];
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
