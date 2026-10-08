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
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.query.token && typeof req.query.token === "string") {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const payload = verifyAccessToken(token);

    if (payload.sessionId) {
      const { prisma } = require("../lib/prisma");
      // SEC-H05 FIX: Query DB directly for session validity instead of relying on a 60-second stale memory cache
      // This ensures immediate revocation when a user logs out remotely
      const session = await prisma.refreshToken.findUnique({
        where: { id: payload.sessionId }
      });
      
      if (!session) {
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

/**
 * SEC-03 FIX — cronAuth middleware
 * Protects internal cron / admin endpoints that are called by server infrastructure,
 * not by end users. Requires the caller to supply the shared CRON_SECRET via the
 * `x-cron-secret` request header. A missing or wrong secret returns 403.
 *
 * Usage: router.get("/cron/cleanup", cronAuth, SomeController.cleanup);
 *
 * Setup:
 *   1. Add CRON_SECRET=<long-random-string> to your .env
 *   2. Your cron job (Cloud Scheduler, Render Cron, etc.) must pass:
 *      -H "x-cron-secret: <same-value>"
 */
export const cronAuth: RequestHandler = (req, res, next) => {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    // Misconfigured server — refuse access rather than silently open the gate
    console.error("[cronAuth] CRON_SECRET env var is not set. Refusing cron request.");
    return res.status(503).json({ message: "Cron endpoint not configured on this server." });
  }

  const provided = req.headers["x-cron-secret"];
  if (!provided || provided !== secret) {
    return res.status(403).json({ message: "Forbidden" });
  }

  next();
};
