import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authenticate";
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import * as googleTTS from 'google-tts-api';
import https from "https";

import fs from "fs";

export class VoiceController {
  static async synthesize(req: AuthenticatedRequest, res: Response) {
    const text = req.body.text || req.query.text;
    const voice_id = req.body.voice_id || req.query.voiceId || 'pNInz6obpgDQGcFmaJgB';

    if (!text || typeof text !== 'string') {
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
      console.warn("ElevenLabs TTS Error or Quota Exceeded. Falling back to Google TTS.", error);
      try {
        const chunks = await googleTTS.getAllAudioBase64(text, {
          lang: 'en',
          slow: false,
          host: 'https://translate.google.com',
        });
        
        const buffers = chunks.map(c => Buffer.from(c.base64, 'base64'));
        const finalBuffer = Buffer.concat(buffers);
        
        res.set({
          'Content-Type': 'audio/mpeg',
          'Content-Length': finalBuffer.length.toString(),
        });
        
        res.status(200).send(finalBuffer);
      } catch (fallbackError) {
        console.error("Google TTS fallback generation failed:", fallbackError);
        if (!res.headersSent) {
          res.status(500).json({ error: "TTS synthesis failed entirely" });
        } else {
          res.end();
        }
      }
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








