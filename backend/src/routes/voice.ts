import { Router } from "express";
import { transcribe, synthesize } from "../controllers/voice";

const router = Router();

router.post("/transcribe", transcribe);
router.post("/synthesize", synthesize);

export { router as voiceRoutes };
