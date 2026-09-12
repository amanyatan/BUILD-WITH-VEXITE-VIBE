import { Router } from "express";
import { connectRepo, getRepos, createPR } from "../controllers/github";

const router = Router();

router.post("/connect", connectRepo);
router.get("/repos", getRepos);
router.post("/pr", createPR);

export { router as githubRoutes };
