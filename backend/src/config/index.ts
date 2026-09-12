import dotenv from "dotenv";
import path from "path";

const workingDirectory = process.cwd();
const projectRoot = path.basename(workingDirectory).toLowerCase() === "backend"
  ? path.resolve(workingDirectory, "..")
  : workingDirectory;
const envFiles = [
  path.resolve(projectRoot, ".env"),
  path.resolve(projectRoot, "backend/.env"),
  path.resolve(projectRoot, "frontend/.env.local"),
];

for (const envFile of envFiles) {
  dotenv.config({ path: envFile });
}

export const config = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || "development",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  aiProvider: process.env.AI_PROVIDER || "groq",
  aiApiKey: process.env.AI_API_KEY || "",
  aiModel: process.env.AI_MODEL || "llama-3.3-70b-versatile",
  groqApiKey: process.env.GROQ_API_KEY || "",
  groqModel: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  geminiLiveModel: process.env.GEMINI_LIVE_MODEL || "gemini-2.5-flash",
  sarvamApiKey: process.env.SARVAM_API_KEY || "",
  sarvamLanguage: process.env.SARVAM_LANGUAGE || "en-IN",
  tavilyApiKey: process.env.TAVILY_API_KEY || "",
  githubClientId: process.env.GITHUB_CLIENT_ID || "",
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || "",
  githubAccessToken: process.env.GITHUB_ACCESS_TOKEN || "",
};

export function validateConfig(): void {
  if (!config.geminiApiKey) {
    console.error("Missing GEMINI_API_KEY. Native audio-to-audio conversation at /ws/conversation is disabled.");
  }
  if (!config.groqApiKey) {
    console.warn("Missing GROQ_API_KEY. Agent task execution will not be available.");
  }
}
