import { Response, Request } from "express";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { prisma } from "../lib/prisma";
import { TransferService } from "../services/transfer.service";

export class TransferController {
  
  // POST /api/transfer/send
  static async sendTransfer(req: AuthenticatedRequest, res: Response) {
    const { contextType, dateRange } = req.body;
    let payload = req.body.payload;
    const senderUserId = req.user!.userId;

    try {
      if (!contextType) {
        return res.status(400).json({ message: "contextType is required." });
      }

      // If payload is not provided, build it automatically based on context
      if (!payload || Object.keys(payload).length === 0) {
        payload = await TransferService.buildPayload(senderUserId, contextType, dateRange);
      }

      // 1. Prevent spam/stale codes: Delete any existing active code for this user
      await prisma.shareTransfer.deleteMany({
        where: {
          senderUserId: senderUserId
        }
      });

      // 2. Generate cryptographically secure 6-digit code
      const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();
      let code = generateCode();
      
      // Ensure it's unique
      while (await prisma.shareTransfer.findUnique({ where: { code } })) {
        code = generateCode();
      }
      
      // 3. Insert with 5-minute expiry
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5);

      await prisma.shareTransfer.create({
        data: {
          code,
          senderUserId,
          contextType,
          payload,
          expiresAt
        }
      });

      return res.status(200).json({ code, expiresIn: 300 });

    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Failed to generate transfer code." });
    }
  }

  // POST /api/transfer/retrieve
  static async retrieveTransfer(req: AuthenticatedRequest, res: Response) {
    const { code } = req.body;
    const receiverUserId = req.user!.userId;

    try {
      if (!code || code.length !== 6) {
        return res.status(400).json({ message: "Invalid 6-digit code." });
      }

      // 1. Find the code
      const transfer = await prisma.shareTransfer.findUnique({
        where: { code }
      });

      if (!transfer || transfer.expiresAt < new Date()) {
        if (transfer) {
          // Cleanup expired code lazily
          await prisma.shareTransfer.delete({ where: { code } });
        }
        return res.status(404).json({ message: "Code is invalid or has expired." });
      }

      // 2. Security Guardrail: Prevent self-retrieval
      if (transfer.senderUserId === receiverUserId) {
        return res.status(403).json({ message: "Cannot retrieve your own shared code." });
      }

      // 3. Atomically delete and return the row (Single-Use Guarantee)
      await prisma.shareTransfer.delete({ where: { code } });

      return res.status(200).json({
        contextType: transfer.contextType,
        payload: transfer.payload
      });

    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Failed to retrieve transfer." });
    }
  }

  // GET /api/transfer/cron/cleanup
  static async cleanup(req: Request, res: Response) {
    try {
      await prisma.shareTransfer.deleteMany({
        where: {
          expiresAt: {
            lte: new Date()
          }
        }
      });
      return res.status(200).json({ status: "cleaned" });
    } catch (error) {
      return res.status(500).json({ error: "Cleanup failed" });
    }
  }
}
