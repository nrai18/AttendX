import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { CalendarRagService } from "../services/calendar_rag.service";
import { EventService } from "../services/event.service";

export class CalendarRagController {
  static async parseDocument(req: AuthenticatedRequest, res: Response) {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }
    
    try {
      const events = await CalendarRagService.extractEventsFromDocument(
        req.file.buffer, 
        req.file.mimetype
      );
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
      res.json({ message: "Events saved successfully", events: created });
    } catch (error: any) {
      console.error("Save RAG Events Error:", error);
      res.status(500).json({ error: error.message || "Failed to save events" });
    }
  }
}
