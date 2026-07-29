import { Request, Response } from "express";
import { TimetableService } from "../services/timetable.service";

export class TimetableController {
  static async getTimetable(req: Request, res: Response) {
    const semesterId = req.params.semesterId;
    const slots = await TimetableService.getTimetable(semesterId);
    res.json(slots);
  }

  static async createSlot(req: Request, res: Response) {
    const slot = await TimetableService.createSlot(req.body);
    res.status(201).json(slot);
  }

  static async deleteSlot(req: Request, res: Response) {
    const preserveHistory = req.query.preserveHistory !== "false";
    await TimetableService.deleteSlot(req.params.id, preserveHistory);
    res.json({ message: "Slot deleted", preservedHistory: preserveHistory });
  }

  static async addExtraClass(req: Request, res: Response) {
    const extra = await TimetableService.addExtraClass(req.body);
    res.status(201).json(extra);
  }
}
