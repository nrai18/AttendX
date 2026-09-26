import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { AiChatService } from "../services/ai_chat.service";
import { CustomMlCopilotService } from "../services/custom_ml_copilot.service";

// AI-H11 FIX: In-memory lock to prevent concurrent AI requests from the same user
const activeAiRequests = new Set<string>();

export class AiController {
  static async chat(req: AuthenticatedRequest, res: Response) {
    const { text, message, history, student_context, currentRoute, selectedItems, localTime, warmup } = req.body;

    // Fast-path instant warmup ping (used during app boot initialization)
    if (warmup || text === "ping" || message === "ping") {
      // AI-M03 FIX: Catch async errors to prevent unhandled promise rejection crashes
      try {
        CustomMlCopilotService.warmup();
      } catch (e) {
        console.error("Copilot warmup failed:", e);
      }
      return res.json({
        reply: "AttendX Copilot engine warmed up and ready.",
        response: "AttendX Copilot engine warmed up and ready.",
        actions: [],
        citations: [],
        intent: "KNOWLEDGE_BASE"
      });
    }

    const userId = req.user?.userId || (req.user as any)?.id;

    // AI-H11 FIX: Reject overlapping requests from the same user to prevent race conditions
    if (userId) {
      if (activeAiRequests.has(userId)) {
        return res.status(429).json({
          reply: "I am currently processing your previous request. Please wait a moment.",
          response: "I am currently processing your previous request. Please wait a moment.",
          actions: [],
          citations: [],
          intent: "RATE_LIMIT"
        });
      }
      activeAiRequests.add(userId);
    }

    try {
      const enrichedContext = {
        ...(student_context || {}),
        user_id: student_context?.user_id || userId,
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
        citations: [],
        intent: "ERROR" // AI-M04 FIX: Ensure intent field exists so client-side gating doesn't break
      });
    } finally {
      if (userId) {
        activeAiRequests.delete(userId);
      }
    }
  }
}
