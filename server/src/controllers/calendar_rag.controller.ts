import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { CalendarRagService } from "../services/calendar_rag.service";
import { DocumentService } from "../services/document.service";
import { EventService } from "../services/event.service";
import { CacheService } from "../services/cache.service";
import { redisClient } from "../lib/redis";

export class CalendarRagController {
  static async getCache(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await redisClient.get(`rag_cache:${req.user!.userId}`);
      if (data) {
        return res.json({ events: JSON.parse(data) });
      }
      return res.json({ events: null });
    } catch (e: any) {
      console.error("RAG Cache Get Error:", e);
      return res.json({ events: null });
    }
  }

  static async clearCache(req: AuthenticatedRequest, res: Response) {
    try {
      await redisClient.del(`rag_cache:${req.user!.userId}`);
      return res.json({ message: "Cleared" });
    } catch (e: any) {
      return res.status(500).json({ error: "Failed to clear cache" });
    }
  }

  static async parseDocument(req: AuthenticatedRequest, res: Response) {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }
    
    try {
      const events = await CalendarRagService.extractEventsFromDocument(
        req.file.buffer, 
        req.file.mimetype
      );
      
      try {
        await DocumentService.storeDocument(req.user!.userId, req.file.buffer, req.file.originalname, req.file.mimetype, "CALENDAR");
      } catch (e) {
        console.error("Failed to store calendar document", e);
      }

      await redisClient.set(`rag_cache:${req.user!.userId}`, JSON.stringify(events), 'EX', 24 * 60 * 60);
      res.json({ events });
    } catch (error: any) {
      console.error("RAG Document Parse Error:", error);
      res.status(500).json({ error: error.message || "Failed to parse document" });
    }
  }

  static async saveEvents(req: AuthenticatedRequest, res: Response) {
    const { semesterId, events } = req.body;
    if (!semesterId || !events || !Array.isArray(events)) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    try {
      // Re-use EventService to save the events. EventService.saveWizardEvents handles it!
      const created = await EventService.saveWizardEvents(req.user!.userId, semesterId, events);
      await CacheService.invalidateUser(req.user!.userId);
      res.json({ message: "Events saved successfully", events: created });
    } catch (error: any) {
      console.error("Save RAG Events Error:", error);
      res.status(500).json({ error: error.message || "Failed to save events" });
    }
  }
}
