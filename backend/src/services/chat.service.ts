import { config } from "../config";
import { AgentOrchestrator } from "../agents/agent.orchestrator";
import { AgentName, isAgentName } from "./agent-router.service";
import { synthesizeSpeech } from "./tts.service";
import { emitToProject } from "./event-bus";

const TOOL_DECLARATIONS = [
  {
    functionDeclarations: [
      {
        name: "run_agent_task",
        description: "Build or modify a website. Call when user asks to create, build, code, design, or modify a website or app.",
        parameters: {
          type: "OBJECT",
          properties: {
            agent: { type: "STRING", enum: ["developer", "designer", "tester"] },
            task: { type: "STRING", description: "What to build or modify." },
          },
          required: ["agent", "task"],
        },
      },
    ],
  },
];

const SYSTEM_PROMPT = `You are Vibe, a friendly AI website builder. You have 3 agents: Designer, Developer, Tester.

RULES:
- User asks to BUILD/CREATE/CODE/MAKE → call run_agent_task(agent="developer", task="...")
- User asks to DESIGN/PLAN → call run_agent_task(agent="designer", task="...")
- User asks to TEST/VALIDATE → call run_agent_task(agent="tester", task="...")
- General questions → answer directly, no tools
- Keep responses SHORT (1-2 sentences max) because they will be spoken aloud
- Always respond with a text response AND optionally a tool call`;

export interface ChatResult {
  text: string;
  audio?: string;
  audioMimeType?: string;
  agent?: AgentName;
  task?: string;
}

export async function handleTextChat(
  userMessage: string,
  projectId: string
): Promise<ChatResult> {
  const apiKey = config.geminiApiKey;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const model = config.geminiModel || "gemini-2.5-flash";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userMessage }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        tools: TOOL_DECLARATIONS,
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      }),
    }
  );

  const data = await response.json() as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          functionCall?: { name: string; args?: Record<string, unknown> };
        }>;
      };
    }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(data.error?.message || `Gemini failed: ${response.status}`);
  }

  const parts = data.candidates?.[0]?.content?.parts || [];
  let textParts: string[] = [];
  let toolCall: { name: string; args?: Record<string, unknown> } | null = null;

  for (const part of parts) {
    if (part.text) textParts.push(part.text);
    if (part.functionCall) toolCall = part.functionCall;
  }

  const responseText = textParts.join("\n") || "Done!";

  let agent: AgentName | undefined;
  let task: string | undefined;

  if (toolCall?.name === "run_agent_task" && toolCall.args) {
    const a = toolCall.args.agent as string;
    const t = toolCall.args.task as string;
    if (isAgentName(a) && t) {
      agent = a;
      task = t;

      const orchestrator = new AgentOrchestrator(projectId);
      orchestrator.onEvent((event) => {
        emitToProject(projectId, { type: "workflow_event", event });
      });
      orchestrator.start(task, agent).catch((err) => {
        console.error("Agent error:", err);
      });
    }
  }

  let audio: string | undefined;
  let audioMimeType: string | undefined;

  try {
    const ttsAgent: AgentName = agent || "designer";
    const tts = await synthesizeSpeech(responseText, ttsAgent);
    audio = tts.audio;
    audioMimeType = tts.mimeType;
  } catch (err) {
    console.error("TTS failed:", err);
  }

  if (audio) {
    emitToProject(projectId, { type: "audio_response", audio, audioMimeType });
  }
  emitToProject(projectId, { type: "text_response", text: responseText });

  return { text: responseText, audio, audioMimeType, agent, task };
}
