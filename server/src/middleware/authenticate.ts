import { Request, Response, NextFunction, RequestHandler } from "express";
import { verifyAccessToken } from "../utils/jwt";

export type AuthenticatedRequest = Request & {
  user?: {
    userId: string;
    role: string;
    sessionId?: string;
  };
};

export const authenticate: RequestHandler = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const token = authHeader.split(" ")[1];
    const payload = verifyAccessToken(token);

    if (payload.sessionId) {
      const { prisma } = require("../lib/prisma");
      const sessionExists = await prisma.refreshToken.findUnique({
        where: { id: payload.sessionId }
      });
      if (!sessionExists) {
        return res.status(401).json({ message: "Session has been revoked" });
      }
    }

    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired access token" });
  }
};
