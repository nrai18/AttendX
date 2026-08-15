import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { DataService } from "../services/data.service";
import fs from "fs";

export class DataController {
  static async exportData(req: AuthenticatedRequest, res: Response) {
    try {
      const zipBuffer = await DataService.exportData(req.user!.userId);
      
      res.setHeader("Content-Disposition", 'attachment; filename="attendx_export.zip"');
      res.setHeader("Content-Type", "application/zip");
      res.send(zipBuffer);
    } catch (error: any) {
      console.error("Export Error:", error);
      res.status(500).json({ error: error.message || "Failed to export data" });
    }
  }

  static async importData(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No zip file uploaded" });
      }

      await DataService.importData(req.user!.userId, req.file.buffer);
      res.json({ success: true, message: "Data imported successfully" });
    } catch (error: any) {
      console.error("Import Error:", error);
      res.status(500).json({ error: error.message || "Failed to import data" });
    }
  }
}
