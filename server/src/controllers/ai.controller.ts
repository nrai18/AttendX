import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { AiChatService } from "../services/ai_chat.service";
import { CustomMlCopilotService } from "../services/custom_ml_copilot.service";

export class AiController {
  static async chat(req: AuthenticatedRequest, res: Response) {
    const { text, message, history, student_context, currentRoute, selectedItems, localTime, warmup } = req.body;

    // Fast-path instant warmup ping (used during app boot initialization)
    if (warmup || text === "ping" || message === "ping") {
      CustomMlCopilotService.warmup();
      return res.json({
        reply: "AttendX Copilot engine warmed up and ready.",
        response: "AttendX Copilot engine warmed up and ready.",
        actions: [],
        citations: [],
        intent: "KNOWLEDGE_BASE"
      });
    }

    try {
      const enrichedContext = {
        ...(student_context || {}),
        user_id: student_context?.user_id || req.user?.userId,
      };

      const payload = {
        text: text || message || "",
        currentRoute: currentRoute || "/today",
        selectedItems: selectedItems || [],
        localTime: localTime || new Date().toISOString(),
        history: history || [],
        student_context: enrichedContext
      };

      const response = await AiChatService.handleChat(payload);
      res.json(response);
    } catch (error) {
      console.error("AI Chat error:", error);
      res.status(500).json({
        reply: "Offline engine error.",
        response: "Offline engine error.",
        actions: [],
        citations: []
      });
    }
  }
}
