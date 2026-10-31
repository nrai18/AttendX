import "dotenv/config";
import { MemoryMonitor } from "./utils/memoryMonitor";

// Checkpoint 1: Base server boot
MemoryMonitor.log("Base Server Startup");

import { startServer } from "./app";
import { CustomMlCopilotService } from "./services/custom_ml_copilot.service";
import { CronService } from "./services/cron.service";
import "./lib/firebase";
import { redisClient } from "./lib/redis";
import { PushNotificationService } from "./services/push_notification.service";
import { loadDeviceMapping } from "./utils/deviceMapper";
import { FailureLogRecorder } from "./utils/failureLogRecorder";

process.on("unhandledRejection", (reason: any) => {
  FailureLogRecorder.recordError(reason, null, { context: "process.unhandledRejection" });
  console.error("[UnhandledRejection]:", reason);
});
process.on("uncaughtException", (err: Error) => {
  FailureLogRecorder.recordError(err, null, { context: "process.uncaughtException" });
  console.error("[UncaughtException]:", err);
});

async function bootstrap() {
  // Start Express HTTP server immediately so port 3000 is open in < 300ms!
  const server = await startServer();
  MemoryMonitor.log("Server Listening");

  // Attach graceful shutdown hooks
  MemoryMonitor.setupGracefulShutdown(server);

  // Background non-blocking warmups (Gemini, DeviceMapper, Cron)
  CustomMlCopilotService.warmup();
  MemoryMonitor.log("Post-Gemini Warmup");

  CronService.init();
  MemoryMonitor.log("Post-Cron Init");

  loadDeviceMapping().catch((err) => {
    console.warn("[DeviceMapper] Background load skipped:", err?.message || err);
  });

  // Start periodic 5-minute memory monitoring
  MemoryMonitor.startPeriodicLogging();

  // Checkpoint 6: Redis connection logging
  if (redisClient.status === "ready" || redisClient.status === "connect") {
    MemoryMonitor.log("Post-Redis Connect");
  } else {
    redisClient.once("connect", () => {
      MemoryMonitor.log("Post-Redis Connect");
    });
  }

  // Automatically broadcast push notifications when a new version is deployed
  setTimeout(async () => {
    try {
      if (redisClient.status !== "ready") return;
      const currentVersion = "4.2.0";
      
      // Use Redis SETNX to guarantee only ONE server instance sends the notification
      const acquired = await redisClient.setnx(`notified_update_${currentVersion}`, "1").catch(() => 0);
      if (acquired === 1) {
        console.log(`[Version Watcher] New version ${currentVersion} detected! Broadcasting update notification...`);
        await PushNotificationService.broadcastMessage(
          `AttendX Update ${currentVersion} is Live! 🚀`,
          "Tap to download the update and see what's new!",
          { type: "ota_update", version: currentVersion }
        );
      }
    } catch (error) {
      console.error("[Version Watcher] Failed to check or send update notification:", error);
    }
  }, 10000);
}

bootstrap().catch((err) => {
  console.error("[Server Bootstrap Fatal Error]:", err);
  process.exit(1);
});
