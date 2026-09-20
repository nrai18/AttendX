import { Request, Response, NextFunction, RequestHandler } from "express";
import { verifyAccessToken } from "../utils/jwt";

export type AuthenticatedRequest = Request & {
  user?: {
    userId: string;
    role: string;
    sessionId?: string;
  };
};

const sessionPromises = new Map<string, Promise<boolean>>();

export const authenticate: RequestHandler = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const token = authHeader.split(" ")[1];
    const payload = verifyAccessToken(token);

    if (payload.sessionId) {
      let isValidPromise = sessionPromises.get(payload.sessionId);
      
      if (!isValidPromise) {
        const { prisma } = require("../lib/prisma");
        isValidPromise = prisma.refreshToken.findUnique({
          where: { id: payload.sessionId }
        }).then((session: any) => {
          // Keep it cached for 60 seconds
          setTimeout(() => sessionPromises.delete(payload.sessionId), 60000);
          return !!session;
        }).catch(() => {
          sessionPromises.delete(payload.sessionId);
          return false;
        });
        sessionPromises.set(payload.sessionId, isValidPromise);
      }
      
      const isValid = await isValidPromise;
      if (!isValid) {
        return res.status(401).json({ message: "Session has been revoked" });
      }
    }

    if ((payload as any).id && !payload.userId) {
      payload.userId = (payload as any).id;
    }
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired access token" });
  }
};
