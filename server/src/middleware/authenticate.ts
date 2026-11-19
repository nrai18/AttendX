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
const validSessions = new Map<string, { userId: string; expiresAt: number }>();
const revokedSessions = new Map<string, number>();
const SESSION_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes (revocations call invalidateSessionCache immediately)
const REVOKED_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours (well beyond access token lifetime)
const MAX_SESSION_CACHE_ENTRIES = 5000;

function pruneSessionCaches(now = Date.now()) {
  if (validSessions.size > MAX_SESSION_CACHE_ENTRIES) {
    for (const [sid, entry] of validSessions.entries()) {
      if (entry.expiresAt <= now) {
        validSessions.delete(sid);
      }
    }
    while (validSessions.size > MAX_SESSION_CACHE_ENTRIES) {
      const oldestKey = validSessions.keys().next().value;
      if (!oldestKey) break;
      validSessions.delete(oldestKey);
    }
  }
  if (revokedSessions.size > MAX_SESSION_CACHE_ENTRIES) {
    for (const [sid, expiresAt] of revokedSessions.entries()) {
      if (expiresAt <= now) {
        revokedSessions.delete(sid);
      }
    }
    while (revokedSessions.size > MAX_SESSION_CACHE_ENTRIES) {
      const oldestKey = revokedSessions.keys().next().value;
      if (!oldestKey) break;
      revokedSessions.delete(oldestKey);
    }
  }
}

export function clearSessionRevocation(sessionId: string) {
  revokedSessions.delete(sessionId);
}

export function invalidateSessionCache(sessionId?: string, userId?: string, keepSessionId?: string) {
  const now = Date.now();
  const revokedUntil = now + REVOKED_SESSION_TTL_MS;
  if (sessionId) {
    validSessions.delete(sessionId);
    sessionPromises.delete(sessionId);
    revokedSessions.set(sessionId, revokedUntil);
  }
  if (userId) {
    for (const [sid, entry] of validSessions.entries()) {
      if (entry.userId === userId && sid !== keepSessionId) {
        validSessions.delete(sid);
        sessionPromises.delete(sid);
        revokedSessions.set(sid, revokedUntil);
      }
    }
  }
  pruneSessionCaches(now);
}

const revalidateSessionInBackground = (sid: string): Promise<boolean> => {
  const existing = sessionPromises.get(sid);
  if (existing) return existing;

  const { prisma } = require("../lib/prisma");
  const checkPromise = (async () => {
    try {
      const session = await prisma.refreshToken.findUnique({
        where: { id: sid },
        select: { id: true, userId: true },
      });
      const now = Date.now();
      if (!session) {
        validSessions.delete(sid);
        revokedSessions.set(sid, now + REVOKED_SESSION_TTL_MS);
        pruneSessionCaches(now);
        return false;
      }
      revokedSessions.delete(sid);
      validSessions.set(sid, {
        userId: session.userId,
        expiresAt: now + SESSION_CACHE_TTL_MS,
      });
      pruneSessionCaches(now);
      return true;
    } catch (dbErr) {
      console.warn("[authenticate] Transient DB error checking session, allowing valid JWT:", (dbErr as any)?.message);
      return true;
    } finally {
      sessionPromises.delete(sid);
    }
  })();

  sessionPromises.set(sid, checkPromise);
  return checkPromise;
};

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

    // SEC-FIX: Reject tokens minted for non-session purposes (e.g. password reset) or missing userId
    if ((payload as any).purpose || !payload.userId) {
      return res.status(401).json({ message: "Invalid or expired access token" });
    }

    if (payload.sessionId) {
      const sid = payload.sessionId;
      const revokedUntil = revokedSessions.get(sid);
      if (revokedUntil !== undefined) {
        if (revokedUntil > Date.now()) {
          return res.status(401).json({ message: "Session has been revoked" });
        }
        revokedSessions.delete(sid);
      }
      const cached = validSessions.get(sid);
      if (cached) {
        // Stale-while-revalidate: never block requests once a session has been verified
        if (Date.now() >= cached.expiresAt) {
          revalidateSessionInBackground(sid).catch(() => {});
        }
      } else {
        // Cold session check with 650ms race cap so a slow DB handshake never stalls API calls for 30s.
        // Do NOT populate validSessions on timeout; let the in-flight DB check settle validSessions/revokedSessions.
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
        const isSessionValid = await Promise.race([
          revalidateSessionInBackground(sid),
          new Promise<boolean>((resolve) => {
            timeoutHandle = setTimeout(() => resolve(true), 650);
          }),
        ]).finally(() => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
        });
        if (!isSessionValid) {
          return res.status(401).json({ message: "Session has been revoked" });
        }
      }
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
  const DEFAULT_SECRET = "attendx_dev_cron_secret_replace_in_prod";

  const provided = req.headers["x-cron-secret"] || (req.query?.secret as string) || (req.query?.cron_secret as string);

  if (!provided || typeof provided !== "string") {
    return res.status(403).json({ message: "Forbidden: Missing cron secret (provide via 'x-cron-secret' header or '?secret=' query param)" });
  }

  // In production or whenever CRON_SECRET is configured, strictly require CRON_SECRET
  if (secret) {
    if (provided === secret) {
      return next();
    }
    return res.status(403).json({ message: "Forbidden: Invalid cron secret" });
  }

  // Only allow the dev fallback secret outside production when CRON_SECRET is unset
  if (process.env.NODE_ENV !== "production" && provided === DEFAULT_SECRET) {
    return next();
  }

  return res.status(403).json({ message: "Forbidden: Invalid cron secret" });
};
