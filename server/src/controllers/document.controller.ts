import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import fs from 'fs';
import path from 'path';
import { AuthenticatedRequest } from '../middleware/authenticate';

export class DocumentController {
  static async getStoredDocuments(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

      const docs = await prisma.storedDocument.findMany({
        where: {
          userId: req.user.userId
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      res.json(docs);
    } catch (error: any) {
      console.error("Fetch Documents Error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch documents" });
    }
  }

  static async downloadDocument(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const doc = await prisma.storedDocument.findUnique({ where: { id } });
      
      if (!doc) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // We stored the URL as /uploads/filename
      const filename = doc.fileUrl.replace('/uploads/', '');
      const filePath = path.join(process.cwd(), 'uploads', filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'File not found on disk' });
      }

      res.setHeader('Content-Disposition', `attachment; filename="${doc.name}"`);
      res.setHeader('Content-Type', doc.mimeType);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      res.status(500).json({ message: 'Failed to download document', error });
    }
  }

  static async deleteDocument(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      
      const doc = await prisma.storedDocument.findUnique({
        where: { id: req.params.id }
      });
      
      if (!doc || doc.userId !== req.user.userId) {
        return res.status(404).json({ message: 'Document not found' });
      }
      
      await prisma.storedDocument.delete({ where: { id: req.params.id } });
      
      // Attempt to delete physical file if it's stored in /uploads
      if (doc.fileUrl.startsWith('/uploads/')) {
        try {
          const fsPromises = require('fs/promises');
          const pathModule = require('path');
          const filePath = pathModule.join(process.cwd(), doc.fileUrl);
          await fsPromises.unlink(filePath);
        } catch (e) {
          console.error('Failed to delete physical file:', e);
        }
      }
      
      res.json({ message: 'Document deleted successfully' });
    } catch (error: any) {
      console.error("Delete Document Error:", error);
      res.status(500).json({ error: error.message || "Failed to delete document" });
    }
  }
}
