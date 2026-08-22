import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { DataService } from "../services/data.service";
import { DocumentService } from "../services/document.service";
import fs from "fs";

export class DataController {
  static async exportData(req: AuthenticatedRequest, res: Response) {
    try {
      const zipBuffer = await DataService.exportData(req.user!.userId);
      
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `attendx_export_${dateStr}.zip`;
      
      try {
        await DocumentService.storeDocument(req.user!.userId, zipBuffer, filename, "application/zip", "BACKUP");
      } catch (e) {
        console.error("Failed to store backup document", e);
      }

      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
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
      
      try {
        await DocumentService.storeDocument(req.user!.userId, req.file.buffer, req.file.originalname, req.file.mimetype, "BACKUP");
      } catch (e) {
        console.error("Failed to store imported backup document", e);
      }
      
      res.json({ success: true, message: "Data imported successfully" });
    } catch (error: any) {
      console.error("Import Error:", error);
      res.status(500).json({ error: error.message || "Failed to import data" });
    }
  }
}
