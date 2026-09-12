import { Router } from "express";
import { generateCode, validateCode } from "../controllers/ai";

const router = Router();

router.post("/generate", generateCode);
router.post("/validate", validateCode);

export { router as aiRoutes };
