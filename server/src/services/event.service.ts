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

  static async processCalendarOcr(userId: string, fileBuffer: Buffer, semesterId: string) {
    // Simulate OCR delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // The user provided the exact dates for Semester 5 IIIT-U
    // We will return a structured proposal for the user to confirm via EventWizardModal
    const proposedEvents = [
      {
        title: "Mid Semester Exams",
        eventType: "midsem",
        date: "2026-09-21",
        endDate: "2026-09-23",
      },
      {
        title: "Mid Semester Practical Exams",
        eventType: "midsem",
        date: "2026-09-24",
        endDate: "2026-09-25",
      },
      {
        title: "Mridang Cultural Fest",
        eventType: "fest",
        date: "2026-10-01",
        endDate: "2026-10-03",
      },
      {
        title: "Institute Day",
        eventType: "institute",
        date: "2026-10-03",
      },
      {
        title: "Yalgaar Sports Fest",
        eventType: "fest",
        date: "2026-10-05",
        endDate: "2026-10-28",
      },
      {
        title: "Mid Semester Break",
        eventType: "holiday",
        date: "2026-11-09",
        endDate: "2026-11-13",
      },
      {
        title: "End Semester Theory Exams",
        eventType: "endsem",
        date: "2026-11-30",
        endDate: "2026-12-05",
      },
      {
        title: "End Semester Lab Exams",
        eventType: "endsem",
        date: "2026-12-07",
        endDate: "2026-12-12",
      },
      {
        title: "Winter Vacation Begins",
        eventType: "vacation",
        date: "2026-12-13",
      }
    ];

    return {
      status: "needs_setup",
      rawEvents: proposedEvents
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
    return prisma.event.deleteMany({
      where: { userId }
    });
  }
}
