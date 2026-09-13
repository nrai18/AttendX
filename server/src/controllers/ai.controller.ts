import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { AiChatService } from "../services/ai_chat.service";

export class AiController {
  static async chat(req: AuthenticatedRequest, res: Response) {
    const { message, history, student_context } = req.body;
    try {
      const response = await AiChatService.handleChat(message, history || [], student_context || {});
      res.json(response);
    } catch (error) {
      console.error("AI Chat error:", error);
      res.status(500).json({ reply: "Offline engine error." });
    }
  }
}
