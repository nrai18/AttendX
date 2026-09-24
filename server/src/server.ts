import "dotenv/config";
import { startServer } from "./app";
import { CustomMlCopilotService } from "./services/custom_ml_copilot.service";

// Warm up the zero-token local ML Copilot engine on boot
CustomMlCopilotService.warmup();

startServer();

