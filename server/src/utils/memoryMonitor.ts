import v8 from "v8";
import { Server } from "http";
import { Request, Response, NextFunction } from "express";

export interface MemorySnapshot {
  rssMB: number;
  heapUsedMB: number;
  heapTotalMB: number;
  heapLimitMB: number;
  externalMB: number;
  arrayBuffersMB: number;
  uptimeSeconds: number;
  activeRequests: number;
}

export class MemoryMonitor {
  private static activeRequests = 0;
  private static periodicTimer: NodeJS.Timeout | null = null;
  private static isShuttingDown = false;

  /**
   * Captures a point-in-time snapshot of process and V8 memory usage.
   */
  public static getSnapshot(): MemorySnapshot {
    const mem = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();

    return {
      rssMB: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
      heapUsedMB: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotalMB: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
      heapLimitMB: Math.round((heapStats.heap_size_limit / 1024 / 1024) * 100) / 100,
      externalMB: Math.round((mem.external / 1024 / 1024) * 100) / 100,
      arrayBuffersMB: mem.arrayBuffers ? Math.round((mem.arrayBuffers / 1024 / 1024) * 100) / 100 : 0,
      uptimeSeconds: Math.round(process.uptime()),
      activeRequests: this.activeRequests,
    };
  }

  /**
   * Logs a structured memory telemetry line with stage identification.
   */
  public static log(stage: string): void {
    const s = this.getSnapshot();
    const logLine = `[MemoryMonitor] [${stage}] RSS: ${s.rssMB} MB | Heap: ${s.heapUsedMB}/${s.heapTotalMB} MB (Limit: ${s.heapLimitMB} MB) | Ext: ${s.externalMB} MB | Buffers: ${s.arrayBuffersMB} MB | ActiveReqs: ${s.activeRequests} | Uptime: ${s.uptimeSeconds}s`;
    
    if (s.rssMB > 400) {
      console.warn(`\x1b[33m${logLine} [HIGH MEMORY WARNING: >400MB / 512MB]\x1b[0m`);
    } else {
      console.log(logLine);
    }
  }

  /**
   * Express middleware to track concurrent active HTTP requests safely.
   */
  public static middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      MemoryMonitor.activeRequests++;
      let decremented = false;

      const decrement = () => {
        if (!decremented) {
          decremented = true;
          MemoryMonitor.activeRequests = Math.max(0, MemoryMonitor.activeRequests - 1);
        }
      };

      res.on("finish", decrement);
      res.on("close", decrement);
      next();
    };
  }

  /**
   * Starts periodic structured background logging.
   * Defaults to 5 minutes (300,000 ms) or configurable via MEMORY_LOG_INTERVAL_MS.
   */
  public static startPeriodicLogging(intervalMs?: number): void {
    if (this.periodicTimer) return;

    const interval = intervalMs || Number(process.env.MEMORY_LOG_INTERVAL_MS) || 300000;
    this.periodicTimer = setInterval(() => {
      this.log("Periodic Check");
    }, interval);

    // Unref so the interval doesn't block graceful shutdown
    this.periodicTimer.unref();
  }

  /**
   * Attaches clean, idempotent graceful shutdown handlers for SIGTERM and SIGINT.
   */
  public static setupGracefulShutdown(server: Server): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      console.log(`[MemoryMonitor] Received ${signal}. Initiating graceful shutdown...`);

      if (this.periodicTimer) {
        clearInterval(this.periodicTimer);
        this.periodicTimer = null;
      }

      // 1. Stop accepting new connections
      server.close((err) => {
        if (err) {
          console.error("[MemoryMonitor] Error closing HTTP server:", err);
        } else {
          console.log("[MemoryMonitor] HTTP server closed gracefully.");
        }
      });

      // 2. Set hard termination timeout (5 seconds)
      const timeout = setTimeout(() => {
        console.warn("[MemoryMonitor] Forcefully terminating process after 5s shutdown timeout.");
        process.exit(1);
      }, 5000);
      timeout.unref();

      try {
        // Close Redis if active
        const { redisClient } = await import("../lib/redis");
        if (redisClient && redisClient.status === "ready") {
          await redisClient.quit().catch(() => {});
          console.log("[MemoryMonitor] Redis connection closed.");
        }
      } catch {}

      try {
        // Disconnect Prisma
        const { prisma } = await import("../lib/prisma");
        if (prisma && typeof (prisma as any).$disconnect === "function") {
          await (prisma as any).$disconnect().catch(() => {});
          console.log("[MemoryMonitor] Database pool disconnected.");
        }
      } catch {}

      clearTimeout(timeout);
      console.log("[MemoryMonitor] Graceful shutdown complete. Exiting cleanly.");
      process.exit(0);
    };

    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));
  }
}
