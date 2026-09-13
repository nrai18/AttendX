import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export class CalendarRagService {
  static async extractEventsFromDocument(fileBuffer: Buffer, mimetype: string): Promise<any[]> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `You are an expert document-parsing AI. Your task is to analyze the attached academic calendar and extract all events into a strict JSON structure. 

Categorize each event strictly into one of the following ENUM values:
- EXAM (for mid-terms, end-semester, cycle tests, etc.)
- LAB_EXAM (for practicals, lab demos, lab exams)
- COMMENCEMENT (for start of classes, registration, orientation)
- VACATION (for mid-semester breaks, semester breaks)
- FEST (for cultural or sports festivals)
- HOLIDAY (for public, national, or religious holidays)
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
        "category": "EXAM | LAB_EXAM | COMMENCEMENT | VACATION | FEST | HOLIDAY | OTHER",
        "isHoliday": boolean
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
      return JSON.parse(text || "[]");
    } catch (error) {
      console.error("Gemini calendar extraction failed:", error);
      return [];
    }
  }
}
