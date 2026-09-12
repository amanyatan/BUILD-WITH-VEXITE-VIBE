import { Router } from "express";
import { generateCode, validateCode } from "../controllers/ai";
import { chat } from "../controllers/chat";

const router = Router();

router.post("/generate", generateCode);
router.post("/validate", validateCode);
router.post("/chat", chat);

export { router as aiRoutes };
