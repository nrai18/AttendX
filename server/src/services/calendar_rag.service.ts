import { AIManager } from "../utils/ai_manager";

export class CalendarRagService {
  static async extractEventsFromDocument(fileBuffer: Buffer, mimetype: string): Promise<any[]> {
    try {
      const response = await AIManager.generateContent({
        model: "gemini-3.8-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `You are an expert document-parsing AI. Your task is to analyze the attached academic calendar and extract all events into a strict JSON structure. 

CRITICAL RULE: If the calendar contains a table with different columns for different semesters or cohorts (e.g., "I Sem", "III and V Sem", "VII Sem"), you MUST segregate the events into separate objects in the JSON array, one for each specific column. DO NOT group them all under a generic document title.

CRITICAL RULE 2: DO NOT EXTRACT HOLIDAYS. You MUST strictly ignore all public, national, religious, or gazetted holidays (e.g. Diwali, Christmas, Janmashtami, Muharram, Independence Day). Do not include them in the JSON output.

CRITICAL RULE 3: When reading dates from a complex monthly grid, trace the column down to the event. The correct date is ONLY the number written INSIDE the column for that specific month. You MUST ignore the day numbers written on the far-left margin, as they belong to the first column (e.g. June).

CRITICAL RULE 4: You MUST sort all events in chronological order by startDate within each targetSemester array.

Categorize each event strictly into one of the following ENUM values:
- EXAM (for mid-terms, end-semester, cycle tests, etc.)
- LAB_EXAM (for practicals, lab demos, lab exams)
- COMMENCEMENT (for start of classes, registration, orientation)
- VACATION (for mid-semester breaks, semester breaks)
- FEST (for cultural or sports festivals)
- OTHER (for anything else)

Return a JSON array of objects following this exact schema. Do not output anything else.
[
  {
    "targetSemester": "String (e.g., 'Semester 1', 'Semester 2', 'B.Tech Year 3', etc.)",
    "events": [
      {
        "title": "String (The name of the event)",
        "startDate": "YYYY-MM-DD",
        "endDate": "YYYY-MM-DD",
        "category": "EXAM | LAB_EXAM | COMMENCEMENT | VACATION | FEST | OTHER"
      }
    ]
  }
]`
              },
              {
                inlineData: {
                  data: fileBuffer.toString("base64"),
                  mimeType: mimetype === "application/octet-stream" ? "application/pdf" : mimetype
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          temperature: 0.1
        }
      });
      
      const text = response.text;
      const parsed = JSON.parse(text || "[]");
      
      // Sort events chronologically to guarantee correct order on the frontend
      for (const group of parsed) {
        if (group.events && Array.isArray(group.events)) {
          group.events.sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        }
      }
      
      return parsed;
    } catch (error) {
      console.error("Gemini calendar extraction failed:", error);
      return [];
    }
  }
}
