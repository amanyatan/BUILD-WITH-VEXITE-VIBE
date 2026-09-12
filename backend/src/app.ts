import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { apiLimiter } from "./middleware/rateLimiter";
import { authRoutes } from "./routes/auth";
import { projectRoutes } from "./routes/projects";
import { aiRoutes } from "./routes/ai";
import { voiceRoutes } from "./routes/voice";
import { githubRoutes } from "./routes/github";
import { workflowRoutes } from "./routes/workflow";
import { config } from "./config";

const app = express();

app.use(helmet());
app.use(morgan("dev"));
app.use(cors({ origin: config.frontendUrl }));
app.use(express.json({ limit: "10mb" }));
app.use("/api", apiLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/github", githubRoutes);
app.use("/api/workflow", workflowRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default app;
