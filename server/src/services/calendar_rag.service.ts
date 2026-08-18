import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import * as pdfParseModule from "pdf-parse";

// CommonJS import workaround for pdf-parse
const pdfParse = (pdfParseModule as any).default || pdfParseModule;

const eventSchema = z.object({
  events: z.array(z.object({
    title: z.string().describe("The name or title of the academic event"),
    startDate: z.string().describe("The start date in YYYY-MM-DD format. Ensure year is correct. If year is missing, infer it from the context."),
    endDate: z.string().describe("The end date in YYYY-MM-DD format. If single day event, this should equal startDate."),
    eventType: z.enum(["holiday", "vacation", "exam", "other"]).describe("The type of event"),
    isSemesterBased: z.boolean().describe("True if this event only applies to specific semesters/years (e.g. exams, midterms). False if it is a global holiday for all students."),
  })).describe("List of extracted events from the academic calendar")
});

const parser = StructuredOutputParser.fromZodSchema(eventSchema);

export class CalendarRagService {
  static async extractEventsFromDocument(fileBuffer: Buffer, mimetype: string): Promise<any[]> {
    let textContent = "";
    
    if (mimetype === "application/pdf") {
      const data = await pdfParse(fileBuffer);
      textContent = data.text;
    } else {
      // Assuming it's a text file or CSV if not PDF
      textContent = fileBuffer.toString("utf-8");
    }

    if (!textContent || textContent.trim().length === 0) {
      throw new Error("Could not extract text from the document");
    }

    const model = new ChatGoogleGenerativeAI({
      model: "gemini-3.6-flash",
      temperature: 0,
      apiKey: process.env.GEMINI_API_KEY, // Ensure this is set
    });

    const prompt = new PromptTemplate({
      template: `You are an AI assistant tasked with extracting academic calendar events from a university document.
You must extract all important dates including holidays, vacations, exams, and other key academic milestones.
If the document mentions a year (like Academic Calendar 2026-2027), make sure to apply the correct year to the dates.

{format_instructions}

Document Text:
{document_text}`,
      inputVariables: ["document_text"],
      partialVariables: { format_instructions: parser.getFormatInstructions() },
    });

    const chain = prompt.pipe(model).pipe(parser);

    try {
      const response = await chain.invoke({
        document_text: textContent
      });
      return (response as any).events;
    } catch (error) {
      console.error("Failed to parse document with Langchain:", error);
      throw new Error("AI parsing failed. Please try again.");
    }
  }
}
