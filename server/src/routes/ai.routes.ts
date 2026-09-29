import { Router } from "express";
import { AiController } from "../controllers/ai.controller";
import { VoiceController } from "../controllers/voice.controller";
import { authenticate } from "../middleware/authenticate";
import multer from "multer";
import os from "os";

const upload = multer({ dest: os.tmpdir() });
const router = Router();

router.post("/chat", authenticate, AiController.chat);
router.post("/tts", authenticate, VoiceController.synthesize);
router.post("/stt", authenticate, upload.single("audio"), VoiceController.transcribe);

export default router;

