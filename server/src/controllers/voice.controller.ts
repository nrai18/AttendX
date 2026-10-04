import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

import fs from "fs";

export class VoiceController {
  static async synthesize(req: AuthenticatedRequest, res: Response) {
    const { text, voice_id = 'pNInz6obpgDQGcFmaJgB' } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    try {
      const elevenlabs = new ElevenLabsClient({
        apiKey: process.env.ELEVENLABS_API_KEY || "", 
      });

      const audioStream = await elevenlabs.textToSpeech.stream(
        voice_id, 
        {
          text: text,
          modelId: 'eleven_turbo_v2_5',
          outputFormat: 'mp3_44100_128', 
        }
      );

      res.set({
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
      });

      for await (const chunk of audioStream) {
        res.write(chunk);
      }
      res.end();
    } catch (error) {
      console.error("ElevenLabs TTS Error:", error);
      res.status(500).json({ error: "TTS synthesis failed" });
    }
  }

  static async transcribe(req: AuthenticatedRequest, res: Response) {
    if (!req.file) {
      return res.status(400).json({ error: "Audio file is required" });
    }

    try {
      const elevenlabs = new ElevenLabsClient({
        apiKey: process.env.ELEVENLABS_API_KEY || "", 
      });

      const response = await elevenlabs.speechToText.convert({
        file: fs.createReadStream(req.file.path),
        modelId: "scribe_v2"
      });

      // Cleanup temp file
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error deleting temp file:", err);
      });

      res.json({ text: response.text });
    } catch (error) {
      console.error("ElevenLabs STT Error:", error);
      res.status(500).json({ error: "STT transcription failed" });
      
      fs.unlink(req.file.path, () => {});
    }
  }
}








