import { Response } from "express";
import { EventService } from "../services/event.service";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { CalendarRagService } from "../services/calendar_rag.service";
import { CacheService } from "../services/cache.service";
import { TemplateEventService } from "../services/template_event.service";

export class EventController {
  static async getEvents(req: AuthenticatedRequest, res: Response) {
    const { startDate, endDate, semesterId } = req.query;
    const userId = req.user!.userId;
    const cacheKey = `events:${semesterId || "all"}:${startDate || ""}:${endDate || ""}`;
    try {
      const events = await CacheService.getOrSet(userId, cacheKey, () =>
        EventService.getEvents(
          userId,
          startDate as string | undefined,
          endDate as string | undefined,
          semesterId as string | undefined
        )
      );
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  }

  static async ocrImport(req: AuthenticatedRequest, res: Response) {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }
    const { semesterId } = req.body;
    if (!semesterId) {
      return res.status(400).json({ error: "Missing semesterId" });
    }
    try {
      // Use the fast Gemini-powered RAG service instead of the slow Python ML server
      const events = await CalendarRagService.extractEventsFromDocument(
        req.file.buffer,
        req.file.mimetype
      );
      
      if (Array.isArray(events)) {
        const { prisma } = require("../lib/prisma");
        const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
        const semYear = semester ? new Date(semester.startDate).getFullYear() : new Date().getFullYear();
        const holidayData = TemplateEventService.getHolidays(semYear);
        const allHolidays = [...holidayData.fixedHolidays, ...holidayData.restrictedHolidays];

        events.forEach(group => {
          if (Array.isArray(group.events)) {
            group.events.forEach((evt: any) => {
              const t = (evt.title || "").toLowerCase();
              const matched = allHolidays.find(h => t.includes(h.name.toLowerCase()));
              if (matched && matched.isoDate) {
                evt.startDate = matched.isoDate;
                evt.endDate = matched.isoDate;
              }
            });
            // Sort chronologically
            group.events.sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
          }
        });
      }
      
      // Return payload in the format expected by the frontend wizard
      res.json({
        status: "needs_setup",
        rawEvents: events
      });
    } catch (error) {
      console.error("OCR import failed:", error);
      res.status(500).json({ error: "Failed to process calendar file" });
    }
  }

  static async createEvent(req: AuthenticatedRequest, res: Response) {
    const userId = req.user!.userId;
    const { semesterId, events, title, date, eventType, description } = req.body;
    try {
      let semId = semesterId;
      if (!semId) {
        const { prisma } = require("../lib/prisma");
        const activeSem = await prisma.semester.findFirst({ where: { userId, isActive: true }, select: { id: true } });
        semId = activeSem?.id;
      }
      if (!semId) {
        return res.status(400).json({ error: "Missing semesterId and no active semester found" });
      }

      if (events && Array.isArray(events)) {
        const created = await EventService.saveWizardEvents(userId, semId, events);
        await CacheService.invalidateUser(userId);
        return res.status(201).json(created);
      }

      if (!title || !date) {
        return res.status(400).json({ error: "Title and date are required" });
      }

      const singleEvent = {
        title,
        date: new Date(date),
        eventType: eventType || "other",
        description: description || null,
        semesterId: semId,
        userId,
      };

      const created = await EventService.saveWizardEvents(userId, semId, [singleEvent]);
      await CacheService.invalidateUser(userId);
      res.status(201).json(created[0] || created);
    } catch (error: any) {
      console.error("Create event failed:", error);
      res.status(500).json({ error: error.message || "Failed to create event" });
    }
  }

  static async saveWizard(req: AuthenticatedRequest, res: Response) {
    const { semesterId, events } = req.body;
    if (!semesterId || !events) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    try {
      const created = await EventService.saveWizardEvents(req.user!.userId, semesterId, events);
      await CacheService.invalidateUser(req.user!.userId);
      res.json({ message: "Events saved successfully", events: created });
    } catch (error: any) {
      console.error("Save wizard failed:", error);
      const msg = error.message || "Failed to save events";
      const status = msg.includes("Unauthorized") ? 403 : msg.includes("does not exist") ? 400 : 500;
      res.status(status).json({ error: msg });
    }
  }

  static async getTodayStatus(req: AuthenticatedRequest, res: Response) {
    let { semesterId, date } = req.query as { semesterId?: string; date?: string };
    const userId = req.user!.userId;
    if (!semesterId) {
      const activeSem = await CacheService.getOrSet<any>(userId, "semesters:active", () =>
        prisma.semester.findFirst({ where: { userId, isActive: true } })
      );
      if (!activeSem) {
        return res.json(null);
      }
      semesterId = activeSem.id;
    }
    try {
      const status = await CacheService.getOrSet(
        userId,
        `events:todayStatus:${semesterId}:${date || "today"}`,
        () => EventService.getTodayStatus(userId, semesterId as string, date as string)
      );
      res.json(status);
    } catch (error) {
      console.error("Get today status failed:", error);
      res.status(500).json({ error: "Failed to get today status" });
    }
  }

  static async clearAllEvents(req: AuthenticatedRequest, res: Response) {
    try {
      const target = req.query.target as "holiday_list" | "academic_calendar" | "all" | undefined;
      const semesterId = req.query.semesterId as string | undefined;
      await EventService.clearAllEvents(req.user!.userId, target, semesterId);
      // Invalidate the cache so the Calendar page doesn't show old events
      await CacheService.invalidateUser(req.user!.userId);
      res.json({ message: "Events removed successfully" });
    } catch (error) {
      console.error("Clear events failed:", error);
      res.status(500).json({ error: "Failed to clear events" });
    }
  }

  static async getTemplateHolidays(req: AuthenticatedRequest, res: Response) {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
      const data = TemplateEventService.getHolidays(year);
      res.json(data);
    } catch (error) {
      console.error("Failed to get template holidays:", error);
      res.status(500).json({ error: "Failed to get template holidays" });
    }
  }

  static async getTemplateAcademicCalendar(req: AuthenticatedRequest, res: Response) {
    try {
      const semesterNumber = req.query.semesterNumber ? parseInt(req.query.semesterNumber as string) : undefined;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const data = TemplateEventService.getAcademicCalendar({ semesterNumber, year, startDate, endDate });
      res.json(data);
    } catch (error) {
      console.error("Failed to get template academic calendar:", error);
      res.status(500).json({ error: "Failed to get template academic calendar" });
    }
  }

  static async syncTemplates(req: AuthenticatedRequest, res: Response) {
    const { semesterId, syncHolidayList, syncAcademicCalendar, year, semesterNumber } = req.body;
    if (!semesterId) {
      return res.status(400).json({ error: "Missing semesterId" });
    }
    try {
      const result = await TemplateEventService.syncToSemester({
        userId: req.user!.userId,
        semesterId,
        syncHolidayList: syncHolidayList !== false,
        syncAcademicCalendar: syncAcademicCalendar === true,
        year: year ? parseInt(year) : undefined,
        semesterNumber: semesterNumber ? parseInt(semesterNumber) : undefined
      });
      await CacheService.invalidateUser(req.user!.userId);
      res.json({ message: `Successfully synced ${result.syncedCount} events`, ...result });
    } catch (error: any) {
      console.error("Failed to sync templates:", error);
      res.status(500).json({ error: error.message || "Failed to sync templates" });
    }
  }

  static async deleteEvent(req: AuthenticatedRequest, res: Response) {
    const eventId = String(req.params.id);
    const userId = req.user!.userId;
    try {
      const { prisma } = require("../lib/prisma");
      const { isSameHoliday } = require("../utils/holidayUtils");
      const event = await prisma.event.findFirst({
        where: { id: eventId, userId }
      });
      if (!event) {
        return res.status(200).json({ message: "Event already deleted or does not exist", ghost: true });
      }

      // Also delete any duplicate/equivalent event on the same date for this user & semester
      // (e.g., if both Holiday List and Academic Calendar synced the same holiday on that date)
      const dayStart = new Date(event.date);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(event.date);
      dayEnd.setUTCHours(23, 59, 59, 999);

      const sameDayEvents = await prisma.event.findMany({
        where: {
          userId,
          semesterId: event.semesterId,
          date: { gte: dayStart, lte: dayEnd }
        }
      });

      const idsToDelete = new Set<string>([event.id]);
      const isHol = event.isHoliday || ["holiday", "restricted_holiday"].includes(event.eventType);
      for (const other of sameDayEvents) {
        if (other.title.toLowerCase().trim() === event.title.toLowerCase().trim()) {
          idsToDelete.add(other.id);
        } else if (
          isHol &&
          (other.isHoliday || ["holiday", "restricted_holiday"].includes(other.eventType)) &&
          isSameHoliday(other.title, event.title)
        ) {
          idsToDelete.add(other.id);
        }
      }

      await prisma.event.deleteMany({
        where: { id: { in: Array.from(idsToDelete) }, userId }
      });
      await CacheService.invalidateUser(userId);
      res.json({ message: "Event deleted successfully", deletedCount: idsToDelete.size });
    } catch (error: any) {
      console.error("Failed to delete event:", error);
      res.status(500).json({ error: error.message || "Failed to delete event" });
    }
  }
}
