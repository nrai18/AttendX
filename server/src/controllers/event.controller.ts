import { Response } from "express";
import { EventService } from "../services/event.service";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { CalendarRagService } from "../services/calendar_rag.service";
import { CacheService } from "../services/cache.service";

export class EventController {
  static async getEvents(req: AuthenticatedRequest, res: Response) {
    const { startDate, endDate, semesterId } = req.query;
    try {
      const events = await EventService.getEvents(
        req.user!.userId,
        startDate as string | undefined,
        endDate as string | undefined,
        semesterId as string | undefined
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

  static async saveWizard(req: AuthenticatedRequest, res: Response) {
    const { semesterId, events } = req.body;
    if (!semesterId || !events) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    try {
      const created = await EventService.saveWizardEvents(req.user!.userId, semesterId, events);
      await CacheService.invalidateUser(req.user!.userId);
      res.json({ message: "Events saved successfully", events: created });
    } catch (error) {
      console.error("Save wizard failed:", error);
      res.status(500).json({ error: "Failed to save events" });
    }
  }

  static async getTodayStatus(req: AuthenticatedRequest, res: Response) {
    const { semesterId } = req.query;
    if (!semesterId) {
      return res.status(400).json({ error: "Missing semesterId" });
    }
    try {
      const status = await EventService.getTodayStatus(req.user!.userId, semesterId as string);
      res.json(status);
    } catch (error) {
      console.error("Get today status failed:", error);
      res.status(500).json({ error: "Failed to get today status" });
    }
  }

  static async clearAllEvents(req: AuthenticatedRequest, res: Response) {
    try {
      await EventService.clearAllEvents(req.user!.userId);
      // Invalidate the cache so the Calendar page doesn't show old events
      await CacheService.invalidateUser(req.user!.userId);
      res.json({ message: "All events removed successfully" });
    } catch (error) {
      console.error("Clear events failed:", error);
      res.status(500).json({ error: "Failed to clear events" });
    }
  }
}
