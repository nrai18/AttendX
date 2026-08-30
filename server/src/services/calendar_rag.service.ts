import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";

// CommonJS import workaround is removed

const eventSchema = z.array(z.object({
  targetSemester: z.string().describe("String (e.g., 'Semester 1', 'Semester 2', 'B.Tech Year 3', etc.)"),
  events: z.array(z.object({
    title: z.string().describe("The name of the event"),
    startDate: z.string().describe("YYYY-MM-DD (e.g., '2026-10-01')"),
    endDate: z.string().describe("YYYY-MM-DD (If it's a single day event, make this the same as startDate)"),
    category: z.enum(["EXAM", "LAB_EXAM", "COMMENCEMENT", "VACATION", "FEST", "HOLIDAY", "OTHER"]),
    isHoliday: z.boolean()
  }))
}));

const parser = StructuredOutputParser.fromZodSchema(eventSchema);

export class CalendarRagService {
  static async extractEventsFromDocument(fileBuffer: Buffer, mimetype: string): Promise<any[]> {
    let textContent = "";
    
    // Normalize mimetype
    let validMimeType = mimetype;
    if (!validMimeType || validMimeType === "application/octet-stream") {
      validMimeType = "image/png";
    }

    if (validMimeType.includes("pdf")) {
      const originalWarn = console.warn;
      const originalLog = console.log;
      const filterMsg = (args: any[]) => {
        if (typeof args[0] === 'string' && args[0].includes('Ran out of space in font private use area')) return true;
        return false;
      };
      
      try {
        const pdfParse = require("pdf-parse");
        console.warn = (...args) => { if (!filterMsg(args)) originalWarn.apply(console, args); };
        console.log = (...args) => { if (!filterMsg(args)) originalLog.apply(console, args); };
        const data = await pdfParse(fileBuffer);
        console.warn = originalWarn;
        console.log = originalLog;
        textContent = data.text;
      } catch (e) {
        console.warn = originalWarn;
        console.log = originalLog;
        console.error("pdf-parse extraction warning:", e);
      }
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const prompt = `You are an expert document-parsing AI. Your task is to analyze the attached academic calendar PDF and extract all events into a strict JSON structure. 

The PDF contains a matrix-style calendar where the vertical columns represent Months (June to January) and the horizontal rows represent Days of the Week.
IMPORTANT: The calendar matrix contains holidays embedded inside it. You MUST extract all of these holidays!

Categorize each event strictly into one of the following ENUM values:
- EXAM (for mid-terms, end-semester, cycle tests, etc.)
- LAB_EXAM (for practicals, lab demos, lab exams)
- COMMENCEMENT (for start of classes, registration, orientation)
- VACATION (for mid-semester breaks, semester breaks)
- FEST (for cultural or sports festivals)
- HOLIDAY (for public, national, or religious holidays)
- OTHER (for anything else, such as result declarations, showing answer sheets, exams, registration)

Return a JSON array of objects following this exact schema. If an event applies to all students, duplicate it into the array for every semester option.
[
  {
    "targetSemester": "String (e.g., 'Semester 1', 'Semester 2', 'B.Tech Year 3', etc.)",
    "events": [
      {
        "title": "String (The name of the event)",
        "startDate": "YYYY-MM-DD",
        "endDate": "YYYY-MM-DD",
        "category": "String (Must be one of the ENUM values above)",
        "isHoliday": Boolean
      }
    ]
  }
]

CRITICAL VISUAL & LOGICAL PARSING RULES:
1. HOW TO READ THE MATRIX TEXT FALLBACK (CRITICAL FOR DATES!):
   In the raw extracted text below, you will see lines like: "SAT 20 18 15 Indepen dence Day 19 17 14 19 16".
   The numbers following the Day of the Week correspond EXACTLY to the 8 columns (Months) in order: 
   1. June | 2. July | 3. August | 4. September | 5. October | 6. November | 7. December | 8. January
   
   To find the exact date of a holiday embedded in this row, look at its horizontal placement or the context of the column.
   For example, in "SAT 20 18 15 Indepen dence Day", Independence Day is in August. The 3rd month is August, and the 3rd number in the row is 15. So Independence Day is August 15th!
   In "SUN 14 12 9 13 11 8 Diwali (Deepavali) 13 10", Diwali is in November. The 6th month is November, and the 6th number in the row is 8. So Diwali is November 8th!

2. EXTRACT ALL SEMESTERS (CRITICAL!): The table explicitly contains columns for "I Sem", "III and V Sem", and "VII Sem". You MUST ensure the JSON array contains objects for ALL of these target semesters. Do NOT drop "Semester III" or "Semester V".

3. HARDCODED HOLIDAY EXCEPTIONS (CRITICAL): Due to PDF formatting, the AI often misaligns these specific holidays. You MUST use these exact dates regardless of what the text formatting looks like:
   - "Milad-Un-Nabi" is August 26, 2026 (YYYY-08-26)
   - "Janmashtami" is September 4, 2026 (YYYY-09-04)
   - "Muharram" is June 26, 2026 (YYYY-06-26)
   Do not use internal knowledge, trust these rules!

4. READ THE DATES INSIDE THE EVENT BLOCKS: For regular events, the exact date is often written right next to the event name (e.g., "01-03, Oct.'26"). Always use that explicit date if present!

5. MULTI-DAY EXAMS AND EVENTS: If the event name says "Mid Semester Exam" or "Mid Semester Break" and is associated with multiple dates, or if the explicitly written date is a range like "09 to 14", you MUST capture the ENTIRE range. startDate is the FIRST date, and endDate is the LAST date.

GENERAL RULES:
1. DATE FORMATTING: Output all dates strictly as "YYYY-MM-DD". If an event block shows a range (e.g., "02-04, Nov"), startDate is "2026-11-02" and endDate is "2026-11-04".
2. HOLIDAY HANDLING: If the category is "HOLIDAY", set \`isHoliday\` to \`true\`. For all other categories, set it to \`false\`. NEVER set \`isHoliday\` to true for "showing answer sheets" or regular academic milestones.
3. STRICT JSON: Output ONLY raw, valid JSON. Do not wrap the output in markdown code blocks like \`\`\`json.

Here is the raw extracted text from the PDF as a fallback reference to help you find all the holidays and events:
\${textContent}
`;

    const contents: any[] = [{ text: prompt }];
    if (validMimeType.includes("pdf")) {
      contents.push({
        inlineData: {
          mimeType: "application/pdf",
          data: fileBuffer.toString("base64")
        }
      });
    } else {
      contents.push({
        inlineData: {
          mimeType: validMimeType,
          data: fileBuffer.toString("base64")
        }
      });
    }

    const candidateModels = ["gemini-3.6-flash", "gemini-3.5-flash-lite"];
    let response: any = null;
    let lastError: any = null;

    for (const modelName of candidateModels) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents,
            config: {
              responseMimeType: "application/json"
            }
          });
          if (response && response.text) break;
        } catch (err: any) {
          lastError = err;
          const isTransient = err?.status === "UNAVAILABLE" || err?.code === 503 || err?.code === 429 || String(err?.message || "").includes("demand");
          if (isTransient && attempt === 0) {
            await new Promise((res) => setTimeout(res, 800));
            continue;
          }
          break;
        }
      }
      if (response && response.text) break;
    }

    if (!response && lastError) {
      console.error("Failed to parse document with Gemini:", lastError);
      throw new Error("AI parsing failed due to high demand. Please try again.");
    }

    const textResponse = response?.text || "";
    let parsedAiResult: any = null;
    try {
      parsedAiResult = JSON.parse(textResponse);
    } catch (e) {
      const jsonMatch = textResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        parsedAiResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to extract JSON array from AI response");
      }
    }

    let result = parsedAiResult || [];

    // Ensure all targetSemesters are fully unrolled (if the AI returns combined ones like "III and V")
    if (Array.isArray(result)) {
      const finalResult: any[] = [];
      result.forEach(group => {
        const name = (group.targetSemester || "");
        if (name.includes("and") || name.includes(",")) {
          // split "Semester III and V" or "Semester 3 and 5"
          const matches = name.match(/[IVX]+|\d+/gi);
          if (matches && matches.length > 0) {
            matches.forEach((sem: string) => {
              finalResult.push({
                targetSemester: `Semester ${sem.toUpperCase()}`,
                events: [...(group.events || [])]
              });
            });
          } else {
            finalResult.push(group);
          }
        } else {
          finalResult.push(group);
        }
      });
      result = finalResult;
    }

    return result;
  }
}
 
