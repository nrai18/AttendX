import { prisma } from "../lib/prisma";

export class EventService {
  static async getEvents(userId: string, startDate?: string, endDate?: string, semesterId?: string) {
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

    let semesterFilter = {};
    if (semesterId) {
      semesterFilter = {
        OR: [
          { semesterId: semesterId },
          { semesterId: null }
        ]
      };
    }

    return prisma.event.findMany({
      where: {
        userId,
        ...dateFilter,
        ...semesterFilter
      },
      orderBy: { date: "asc" }
    });
  }

  static async processCalendarOcr(userId: string, fileBuffer: Buffer, semesterId: string, fileName: string = "", mimeType: string = "") {
    let extractedText = "";

    try {
      const form = new FormData();
      // fileBuffer is a Node.js Buffer, FormData in native fetch expects a Blob.
      // So we convert Buffer to Blob
      const blob = new Blob([fileBuffer as any], { type: mimeType || 'application/pdf' });
      form.append('file', blob, fileName || 'calendar.pdf');

      const response = await fetch('http://127.0.0.1:8000/upload/calendar-ocr', {
        method: 'POST',
        body: form
      });

      if (!response.ok) {
        throw new Error(`ML Server error: ${response.statusText}`);
      }

      const data = await response.json();

      if (data && data.rawEvents) {
        return {
          status: "needs_setup",
          rawEvents: data.rawEvents
        };
      }
    } catch (err: any) {
      console.error("ML Server Calendar OCR Error:", err.message);
    }

    return {
      status: "needs_setup",
      rawEvents: []
    };
  }

  static async saveWizardEvents(userId: string, semesterId: string, events: any[]) {
    // Save the user confirmed events
    const createdEvents = await Promise.all(
      events.map((evt) => {
        let mappedType: any = "other";
        
        const rawType = (evt.eventType || evt.category || "").toLowerCase();
        const titleLower = (evt.title || "").toLowerCase();

        if (rawType === "holiday") {
          mappedType = "holiday";
        } else if (rawType === "vacation") {
          mappedType = "vacation";
        } else if (rawType === "fest") {
          mappedType = "fest";
        } else if (rawType === "commencement" || rawType === "institute") {
          mappedType = "institute";
        } else if (rawType === "lab_exam" || titleLower.includes("lab") || titleLower.includes("practical")) {
          mappedType = "lab_exam";
        } else if (rawType === "exam" || rawType === "ct") {
          if (titleLower.includes("mid")) {
            mappedType = "midsem";
          } else if (titleLower.includes("end") || titleLower.includes("theory")) {
            mappedType = "endsem";
          } else if (titleLower.includes("cycle") || titleLower.includes("ct")) {
            mappedType = "ct";
          } else {
            mappedType = "exam";
          }
        } else {
          // Fallback checks
          if (titleLower.includes("holiday")) mappedType = "holiday";
          else if (titleLower.includes("break") || titleLower.includes("vacation")) mappedType = "vacation";
          else if (titleLower.includes("fest")) mappedType = "fest";
          else if (titleLower.includes("commencement")) mappedType = "institute";
          else if (titleLower.includes("mid semester")) mappedType = "midsem";
          else if (titleLower.includes("end semester")) mappedType = "endsem";
          else if (titleLower.includes("cycle test") || titleLower.includes("ct-")) mappedType = "ct";
        }

        return prisma.event.create({
          data: {
            userId,
            semesterId,
            title: evt.title,
            eventType: mappedType,
            date: new Date(evt.date || evt.startDate),
            endDate: evt.endDate ? new Date(evt.endDate) : null,
            allDay: true,
          }
        });
      })
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
