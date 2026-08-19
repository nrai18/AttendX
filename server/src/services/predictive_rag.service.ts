import { GoogleGenAI } from "@google/genai";
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

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const prompt = `You are an AI academic advisor analyzing a student's attendance patterns.
Here is the data of the classes they have missed (some have reasons/remarks attached):
${JSON.stringify(absentLogs.map((l: any) => ({
  date: l.dateFormatted,
  subject: l.subjectName,
  time: l.startTime + " - " + l.endTime,
  reason: l.remarks || "No reason specified"
})), null, 2)}

Analyze this data and return a JSON object with the following schema:
{
  "summary": "A short 2-3 sentence personalized summary of their absence patterns.",
  "keyReasons": ["List of main reasons for missing class (e.g. 'Medical/Fever', 'Techfest OD', or 'Unspecified')"],
  "vulnerableTimings": ["List of specific timings or days they miss most often (e.g. 'Friday mornings', '14:00 - 15:40')"],
  "recommendation": "One encouraging sentence of advice to improve their attendance based on their specific vulnerabilities."
}

CRITICAL RULE: Return ONLY a valid JSON object. No markdown blocks or extra text.`;

    try {
      const candidateModels = ["gemini-3.6-flash", "gemini-3.5-flash-lite"];
      let response: any = null;

      for (const modelName of candidateModels) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: [{ text: prompt }],
            config: {
              responseMimeType: "application/json",
              temperature: 0.2
            }
          });
          if (response?.text) break;
        } catch (e) {
          console.warn(modelName + " failed, falling back...");
        }
      }
      
      if (!response?.text) {
        throw new Error("AI failed to return a valid response.");
      }
      
      const parsed = JSON.parse(response.text);
      return parsed;
    } catch (error) {
      console.error("Predictive AI error:", error);
      return {
        summary: "AI insights are currently unavailable.",
        keyReasons: ["Could not analyze data"],
        vulnerableTimings: ["Could not analyze data"],
        recommendation: "Try again later."
      };
    }
  }
}
