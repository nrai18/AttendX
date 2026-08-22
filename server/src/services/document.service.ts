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
        size: buffer.length
      }
    });

    return doc;
  }
}
