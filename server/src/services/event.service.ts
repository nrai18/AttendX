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
    try {
      const mlApiUrl = process.env.ML_API_URL || "http://localhost:8000";
      
      const formData = new FormData();
      formData.append("file", new Blob([fileBuffer], { type: "application/pdf" }), "calendar.pdf");
      
      const response = await fetch(`${mlApiUrl}/upload/calendar-ocr`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.detail || `ML server returned ${response.status}`);
      }

      const data = await response.json();
      
      return {
        status: "needs_setup",
        rawEvents: data.rawEvents || []
      };
    } catch (error: any) {
      console.error("Calendar OCR Error:", error?.message || error);
      throw new Error(error?.message || "Failed to process academic calendar OCR.");
    }
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
