import "dotenv/config";
import { startServer } from "./app";
import { CustomMlCopilotService } from "./services/custom_ml_copilot.service";
import { CronService } from "./services/cron.service";
import "./lib/firebase";

// Warm up the zero-token local ML Copilot engine on boot
CustomMlCopilotService.warmup();

// Initialize background workers (e.g. daily birthday emails)
CronService.init();

startServer();

