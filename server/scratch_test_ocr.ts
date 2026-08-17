import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || "dummy",
    });

    const prompt = "Analyze this image";
    const contents: any[] = [
      prompt,
      {
        inlineData: {
          mimeType: "image/png",
          data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        }
      }
    ];

    console.log("Calling model...");
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents,
      config: {
        responseMimeType: "application/json"
      }
    });

    console.log("Success:", response.text);
  } catch (err: any) {
    console.error("Error calling AI:", err.message || err);
    if (err.status) console.error("Status:", err.status);
    if (err.details) console.error("Details:", err.details);
  }
}

main();
