import { GoogleGenAI, Type, Schema, FunctionDeclaration } from "@google/genai";

const navigateTool: FunctionDeclaration = {
  name: "navigate_app",
  description: "Navigate the user to a different page in the AttendX app (e.g., /calendar, /settings, /subjects, /assignments, /timetable, /today).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      route: { type: Type.STRING, description: "The route to navigate to" }
    },
    required: ["route"]
  }
};

const switchThemeTool: FunctionDeclaration = {
  name: "switch_theme",
  description: "Switch the app's visual theme.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      theme: { type: Type.STRING, description: "light, dark, or system" }
    },
    required: ["theme"]
  }
};

const markAttendanceTool: FunctionDeclaration = {
  name: "mark_attendance",
  description: "Mark attendance (present, absent, off) for a specific subject on a specific date.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      subjectId: { type: Type.STRING, description: "The exact ID of the subject from the user's context" },
      date: { type: Type.STRING, description: "Date in YYYY-MM-DD format" },
      status: { type: Type.STRING, description: "present, absent, or off" }
    },
    required: ["subjectId", "date", "status"]
  }
};

const addExtraClassTool: FunctionDeclaration = {
  name: "add_extra_class",
  description: "Add an extra class or lecture for a subject.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      subjectId: { type: Type.STRING, description: "The exact subject ID" },
      date: { type: Type.STRING, description: "Date in YYYY-MM-DD format" },
      startTime: { type: Type.STRING, description: "Time in HH:MM format (24-hour)" },
      endTime: { type: Type.STRING, description: "Time in HH:MM format (24-hour)" },
      type: { type: Type.STRING, description: "e.g. Lecture, Lab, Tutorial" }
    },
    required: ["subjectId", "date", "startTime", "endTime"]
  }
};

const markFullDayOffTool: FunctionDeclaration = {
  name: "mark_full_day_off",
  description: "Mark the entire day as OFF (no classes).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      date: { type: Type.STRING, description: "Date in YYYY-MM-DD format" }
    },
    required: ["date"]
  }
};

export class AiChatService {
  static async handleChat(message: string, history: any[], studentContext: any) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const subjectsText = (studentContext?.subjects || []).map((s: any) => `- ${s.name || s.subjectName} (ID: ${s.id || s.subjectId})`).join('\n');

      const systemInstruction = `You are AttendX AI, a helpful assistant for a student attendance app.
You have the following student context:
Total Classes: ${studentContext?.totalClasses || 0}
Total Attended: ${studentContext?.totalAttended || 0}
Overall Percentage: ${studentContext?.overallPercentage || 0}%
Target Percentage: ${studentContext?.targetPercentage || 75}%

Subjects:
${subjectsText}

IMPORTANT INSTRUCTION: Always use the exact subject name (e.g., "Digital Communication") in your text responses, NEVER the raw ID. Only use the ID for the tool arguments.

You can perform actions like marking attendance, adding extra classes, marking a full day off, or navigating the app.
When a user asks you to perform an action, call the appropriate tool.
Keep your responses short, conversational, and direct, as they will be spoken via Text-to-Speech.`;

      const formattedHistory = history.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content || msg.text || '' }]
      }));
      
      const chat = ai.chats.create({
        model: "gemini-3.8-flash",
        config: {
          systemInstruction,
          temperature: 0.7,
          tools: [{
            functionDeclarations: [
              navigateTool, switchThemeTool, markAttendanceTool, addExtraClassTool, markFullDayOffTool
            ]
          }]
        },
        history: formattedHistory
      });

      const response = await chat.sendMessage({ message });
      
      let responseText = response.text || "";
      let actionToTake = null;

      if (response.functionCalls && response.functionCalls.length > 0) {
         const call = response.functionCalls[0];
         let type = call.name?.toUpperCase() || "";
         actionToTake = { type, payload: call.args };
         
         // Let's generate a quick friendly acknowledgment text since the function call itself doesn't produce text in this basic setup
         if (!responseText) {
            responseText = `I'll take care of that for you right now.`;
         }
      }

      return {
        reply: responseText,
        action: actionToTake
      };
    } catch (error) {
      console.error("Gemini AI Chat agent error:", error);
      return {
        reply: "I am having trouble connecting to the cloud AI server right now.",
        action: null
      };
    }
  }
}
