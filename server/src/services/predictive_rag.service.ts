import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AttendanceService } from "./attendance.service";

export class PredictiveRagService {
  static async generateInsights(userId: string) {
    const { logs } = await AttendanceService.getAttendanceLogs(userId, {});
    
    // Include all non-present statuses (absent, missed, medical, od)
    const absentLogs = logs.filter((log: any) => 
      ["absent", "missed", "medical", "od"].includes(log.status?.toLowerCase() || "")
    );
    
    if (absentLogs.length === 0) {
      return {
        summary: "You have perfect attendance!",
        keyReasons: ["Consistent attendance"],
        vulnerableTimings: ["None"],
        recommendation: "Keep up the excellent work!",
      };
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Analyze the following class absence logs for a college student and provide actionable, dynamic insights. 
Do not use generic bullet points. Identify clustering (e.g. end of week, mornings), main reasons from remarks (e.g. "exam prep", "personal", "medical", "OD/official duty", "overslept"), and provide a concise, natural language summary.

Absence Data:
${JSON.stringify(absentLogs.map((l: any) => ({
    date: l.date,
    dayOfWeek: new Date(l.date).toLocaleDateString('en-US', { weekday: 'long' }),
    time: l.startTime,
    subject: l.subjectName,
    status: l.status,
    remarks: l.remarks || "No reason given"
})), null, 2)}`;

      const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
          summary: {
            type: Type.STRING,
            description: "A natural paragraph summarizing their absence patterns and primary reasons, similar to: 'You have accumulated multiple absences clustered toward the end of the week...'"
          },
          keyReasons: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Top 3-4 specific reasons for absence (e.g., 'Exam preparation', 'Fatigue/Sleep', 'Medical/Health', 'Official Duty')."
          },
          vulnerableTimings: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Top 2-3 specific timings or days they struggle with (e.g., 'Thursdays', 'Morning slots (09:00)')."
          },
          recommendation: {
            type: Type.STRING,
            description: "A single, actionable, encouraging sentence suggesting a solution based on their specific patterns."
          }
        },
        required: ["summary", "keyReasons", "vulnerableTimings", "recommendation"]
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.4
        }
      });

      if (response.text) {
        return JSON.parse(response.text);
      }
    } catch (error) {
      console.error("Failed to generate Gemini predictive insights:", error);
    }

    // Fallback to deterministic if Gemini fails
    return this.generateDeterministicFallback(absentLogs);
  }

  private static generateDeterministicFallback(absentLogs: any[]) {
    // 1. Calculate vulnerable timings
    const timingsCount: Record<string, number> = {};
    const daysCount: Record<string, number> = {};
    
    absentLogs.forEach((log: any) => {
      if (log.startTime) {
        const timeKey = log.startTime.slice(0, 5);
        timingsCount[timeKey] = (timingsCount[timeKey] || 0) + 1;
      }
      if (log.date) {
        const day = new Date(log.date).toLocaleDateString('en-US', { weekday: 'long' });
        daysCount[day] = (daysCount[day] || 0) + 1;
      }
    });

    const sortedTimings = Object.entries(timingsCount).sort((a, b) => b[1] - a[1]);
    const sortedDays = Object.entries(daysCount).sort((a, b) => b[1] - a[1]);
    
    const vulnerableTimings = [];
    if (sortedDays.length > 0) vulnerableTimings.push(`Most missed day: ${sortedDays[0][0]}s`);
    if (sortedTimings.length > 0) {
      const topTime = sortedTimings[0][0];
      const timeOfDay = parseInt(topTime.split(":")[0]) < 11 ? "Morning" : "Afternoon/Evening";
      vulnerableTimings.push(`Frequent missed time: ${topTime} (${timeOfDay} classes)`);
    }
    if (vulnerableTimings.length === 0) vulnerableTimings.push("No clear pattern");

    // 2. Key reasons (remarks)
    const remarksCount: Record<string, number> = {};
    let missingReasonCount = 0;
    
    absentLogs.forEach((log: any) => {
      if (log.remarks && log.remarks.trim() !== "") {
        const r = log.remarks.trim().toLowerCase();
        remarksCount[r] = (remarksCount[r] || 0) + 1;
      } else {
        missingReasonCount++;
      }
    });

    const sortedRemarks = Object.entries(remarksCount).sort((a, b) => b[1] - a[1]);
    const keyReasons = [];
    if (sortedRemarks.length > 0) {
      keyReasons.push(`"${sortedRemarks[0][0]}" (${sortedRemarks[0][1]} times)`);
    } else {
      keyReasons.push("No specific remarks provided");
    }

    // 3. Generate Summary & Recommendation
    let summary = `You have missed ${absentLogs.length} classes so far. `;
    if (sortedDays.length > 0 && sortedDays[0][1] > 2) {
      summary += `You tend to miss classes mostly on ${sortedDays[0][0]}s. `;
    }

    let recommendation = "Try to maintain a consistent routine to avoid missing these classes.";
    if (missingReasonCount > absentLogs.length * 0.5) {
      recommendation = "Consider adding remarks when marking classes as missed so we can better track why you are absent.";
    }

    return {
      summary: summary.trim(),
      keyReasons,
      vulnerableTimings,
      recommendation
    };
  }
}
