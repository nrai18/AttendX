import "dotenv/config";
import { MemoryMonitor } from "./utils/memoryMonitor";

// Checkpoint 1: Base server boot
MemoryMonitor.log("Base Server Startup");

import { startServer } from "./app";
import { CustomMlCopilotService } from "./services/custom_ml_copilot.service";
import { AuthService } from "./services/auth.service";
import { CronService } from "./services/cron.service";
import "./lib/firebase";
import { redisClient } from "./lib/redis";
import { loadDeviceMapping } from "./utils/deviceMapper";
import { FailureLogRecorder } from "./utils/failureLogRecorder";
import { scheduleVersionWatcher } from "./utils/versionWatcher";

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

  // Background non-blocking warmups (Gemini, Google OAuth JWKS, DeviceMapper, Cron)
  CustomMlCopilotService.warmup();
  AuthService.warmupGoogleCerts();
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

  // Only announce releases in Render production after verifying the matching GitHub Release + .apk asset exist
  scheduleVersionWatcher();
}

bootstrap().catch((err) => {
  console.error("[Server Bootstrap Fatal Error]:", err);
  process.exit(1);
});
