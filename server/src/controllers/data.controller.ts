import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { DataService } from "../services/data.service";
import { DocumentService } from "../services/document.service";
import fs from "fs";

export class DataController {
  static async exportData(req: AuthenticatedRequest, res: Response) {
    try {
      const zipBuffer = await DataService.exportData(req.user!.userId);
      
      const { prisma } = require("../lib/prisma");
      const activeSem = await prisma.semester.findFirst({
        where: { userId: req.user!.userId, isActive: true }
      });
      
      const semName = activeSem ? activeSem.name.replace(/[^a-zA-Z0-9]/g, '_') : "Semester";
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `AttendX_${semName}_Export_${dateStr}.zip`;
      
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
      let buffer: Buffer;
      let filename = "backup.zip";
      let mimetype = "application/zip";

      if (req.file) {
        buffer = req.file.buffer;
        filename = req.file.originalname;
        mimetype = req.file.mimetype;
      } else if (req.body.base64Zip) {
        buffer = Buffer.from(req.body.base64Zip, "base64");
      } else {
        return res.status(400).json({ error: "No zip file uploaded" });
      }

      await DataService.importData(req.user!.userId, buffer);
      
      try {
        await DocumentService.storeDocument(req.user!.userId, buffer, filename, mimetype, "BACKUP");
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
