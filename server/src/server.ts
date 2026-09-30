import "dotenv/config";
import { startServer } from "./app";
import { CustomMlCopilotService } from "./services/custom_ml_copilot.service";
import { CronService } from "./services/cron.service";
import "./lib/firebase";
import { redisClient } from "./lib/redis";
import { PushNotificationService } from "./services/push_notification.service";

// Warm up the zero-token local ML Copilot engine on boot
CustomMlCopilotService.warmup();

// Initialize background workers (e.g. daily birthday emails)
CronService.init();

startServer();

// Automatically broadcast push notifications when a new version is deployed
setTimeout(async () => {
  try {
    const currentVersion = "4.2.0";
    
    // Use Redis SETNX to guarantee only ONE server instance sends the notification
    const acquired = await redisClient.setnx(`notified_update_${currentVersion}`, "1");
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
}, 10000); // Wait 10 seconds after boot to ensure Firebase is fully initialized
