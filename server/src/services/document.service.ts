import { prisma } from '../lib/prisma';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export class DocumentService {
  static async storeDocument(
    userId: string,
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    type: string
  ) {
    const ext = path.extname(originalName) || '';
    const fileName = `${crypto.randomUUID()}${ext}`;
    const uploadDir = path.join(process.cwd(), 'uploads');
    
    try {
      await fs.mkdir(uploadDir, { recursive: true });
    } catch (e) {}

    if (type === 'TIMETABLE' || type === 'CALENDAR' || type === 'timetable' || type === 'calendar') {
      const existingDocs = await prisma.storedDocument.findMany({
        where: { userId, type }
      });
      
      for (const doc of existingDocs) {
        try {
          const oldFilePath = path.join(process.cwd(), doc.fileUrl);
          await fs.unlink(oldFilePath);
        } catch (e) {
          console.error("Failed to delete old document file:", e);
        }
        await prisma.storedDocument.delete({ where: { id: doc.id } });
      }
    }

    const filePath = path.join(uploadDir, fileName);
    await fs.writeFile(filePath, buffer);

    const fileUrl = `/uploads/${fileName}`;

    const doc = await prisma.storedDocument.create({
      data: {
        userId,
        name: originalName,
        type,
        fileUrl,
        mimeType,
        size: buffer.length,
        fileData: buffer
      }
    });

    return doc;
  }
}
