import { PushNotificationService } from "./src/services/push_notification.service";
import "./src/lib/firebase";

async function run() {
  console.log("Broadcasting update notification to all users...");
  await PushNotificationService.broadcastMessage(
    "New Update Available! dYs?",
    "AttendX v4.2.0 is out! The new AI Voice Expansion is ready to install.",
    { route: "/settings/update" }
  );
  console.log("Done.");
  process.exit(0);
}

run();
