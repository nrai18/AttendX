import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AttendanceService } from "./attendance.service";

export class PredictiveRagService {
  static async generateInsights(userId: string) {
    // Get all attendance logs for the active semester
    const { logs } = await AttendanceService.getAttendanceLogs(userId, {});
    
    // We only care about absences with remarks or missing trends
    const absentLogs = logs.filter((log: any) => log.status === "absent");
    
    // If very few absences, return a default positive message
    if (absentLogs.length === 0) {
      return {
        summary: "You have perfect attendance!",
        keyReasons: ["Consistent attendance"],
        vulnerableTimings: ["None"],
        recommendation: "Keep up the excellent work!",
      };
    }

    const prompt = `Here is the data of the classes missed (some have reasons/remarks attached):
${JSON.stringify(absentLogs.map((l: any) => ({
  date: l.dateFormatted,
  subject: l.subjectName,
  time: l.startTime + " - " + l.endTime,
  reason: l.remarks || "No reason specified"
})), null, 2)}

Analyze this data and provide insights.`;

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING, description: "A short 2-3 sentence personalized summary of their absence patterns." },
        keyReasons: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of main reasons for missing class" },
        vulnerableTimings: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific timings or days they miss most often" },
        recommendation: { type: Type.STRING, description: "One encouraging sentence of advice to improve their attendance based on their specific vulnerabilities." },
      },
      required: ["summary", "keyReasons", "vulnerableTimings", "recommendation"]
    };

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are an AI academic advisor analyzing a student's attendance patterns.",
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.2
        }
      });
      
      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("Gemini AI error:", error);
      return {
        summary: "Cloud AI insights are currently unavailable.",
        keyReasons: ["Could not connect to Gemini API"],
        vulnerableTimings: ["Offline"],
        recommendation: "Please try again later."
      };
    }
  }
}
