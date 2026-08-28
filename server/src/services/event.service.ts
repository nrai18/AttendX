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
        OR: [{ userId }, { userId: null }],
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

      const mlServerUrl = process.env.ML_SERVER_URL || "https://attendx-ml-server.onrender.com";
      const response = await fetch(`${mlServerUrl}/upload/calendar-ocr`, {
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
    // Validate semesterId to prevent foreign key constraint violations
    if (semesterId) {
      const semesterExists = await prisma.semester.findUnique({
        where: { id: semesterId }
      });
      if (!semesterExists) {
        throw new Error("The specified semester does not exist or was deleted. Please refresh the page.");
      }
    }
    // Save the user confirmed events, avoiding duplicates by title and date
    const createdEvents = [];
    for (const evt of events) {
      const evtDate = new Date(evt.date || evt.startDate);
      
      // Check for duplicate
      const existing = await prisma.event.findFirst({
        where: {
          semesterId,
          userId,
          title: evt.title,
          date: evtDate,
        }
      });
      if (existing) {
        continue;
      }

      let mappedType: any = "other";
      
      const rawType = (evt.eventType || evt.category || "").toLowerCase();
      const titleLower = (evt.title || "").toLowerCase();

      if (rawType === "holiday") {
        mappedType = "holiday";
      } else if (rawType === "restricted_holiday") {
        mappedType = "restricted_holiday";
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

      const isHolidayList = evt.isHolidayList === true;
      const isHoliday = evt.isHoliday === true || mappedType === "holiday" || mappedType === "restricted_holiday";
      
      // Conflict Resolution: If this is an Academic Calendar event (not Holiday List)
      // Check if a Holiday List event already exists on this date.
      if (!isHolidayList) {
        const conflictingHoliday = await prisma.event.findFirst({
          where: {
            semesterId,
            userId,
            date: evtDate,
            isHolidayList: true
          }
        });
        
        // If conflict exists and titles are similar (or just blindly replace, user said "preserve AC entry explicitly")
        if (conflictingHoliday) {
          // Delete the pre-loaded holiday list event so the Academic Calendar one takes priority
          await prisma.event.delete({ where: { id: conflictingHoliday.id } });
        }
      }

      const created = await prisma.event.create({
        data: {
          userId,
          semesterId,
          title: evt.title,
          eventType: mappedType,
          date: evtDate,
          endDate: evt.endDate ? new Date(evt.endDate) : null,
          allDay: evt.allDay !== false,
          isHoliday,
          isHolidayList
        }
      });
      createdEvents.push(created);
    }
    return createdEvents;
  }

  static async getTodayStatus(userId: string, semesterId: string, targetDateStr?: string) {
    let today: Date;
    if (targetDateStr) {
      // If a date string like YYYY-MM-DD is passed, construct UTC midnight directly
      const [year, month, day] = targetDateStr.split("-").map(Number);
      today = new Date(Date.UTC(year, month - 1, day));
    } else {
      // Fallback to local server date converted to UTC midnight
      const now = new Date();
      today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    }

    // Make sure we compare properly. If endDate is null, it's a single day event.
    // If endDate is provided, it's a multi-day event spanning from date to endDate.
    const activeEvents = await prisma.event.findMany({
      where: {
        userId,
        semesterId,
        OR: [
          {
            endDate: null,
            date: today
          },
          {
            endDate: { gte: today },
            date: { lte: today }
          }
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
      activeEvents: activeEvents,
      nextEvent: nextEvents.length > 0 ? nextEvents[0] : null
    };
  }

  static async clearAllEvents(userId: string, target?: "holiday_list" | "academic_calendar" | "all") {
    const semesters = await prisma.semester.findMany({
      where: { userId },
      select: { id: true }
    });
    const semesterIds = semesters.map(s => s.id);

    const baseWhere: any = {
      OR: [
        { userId },
        ...(semesterIds.length > 0 ? [{ semesterId: { in: semesterIds } }] : [])
      ]
    };

    if (target === "holiday_list") {
      baseWhere.isHolidayList = true;
    } else if (target === "academic_calendar") {
      baseWhere.isHolidayList = false;
    }

    return prisma.event.deleteMany({
      where: baseWhere
    });
  }
}
