import { IncomingMessage, Server } from "http";
import { randomUUID } from "crypto";
import { WebSocket, WebSocketServer } from "ws";
import { config } from "../config";
import { AgentName, isAgentName } from "./agent-router.service";
import { AgentOrchestrator } from "../agents/agent.orchestrator";
import { synthesizeSpeech } from "./tts.service";
import { emitToProject, subscribeToProject } from "./event-bus";

type ClientMessage =
  | { type: "start_session"; projectId?: string }
  | { type: "text_message"; text: string }
  | { type: "interrupt" }
  | { type: "stop_session" };

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
- Keep responses SHORT (1-2 sentences max) because they will be spoken aloud`;

function send(ws: WebSocket, message: object): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

async function handleTextMessage(session: LiveSession, text: string): Promise<void> {
  const apiKey = config.geminiApiKey;
  if (!apiKey) {
    send(session.ws, { type: "error", message: "GEMINI_API_KEY not configured" });
    return;
  }

  const model = config.geminiModel || "gemini-2.5-flash";

  let responseText = "";
  let agent: AgentName | undefined;
  let task: string | undefined;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
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
    const textParts: string[] = [];
    let toolCall: { name: string; args?: Record<string, unknown> } | null = null;

    for (const part of parts) {
      if (part.text) textParts.push(part.text);
      if (part.functionCall) toolCall = part.functionCall;
    }

    responseText = textParts.join("\n") || "Done!";

    if (toolCall?.name === "run_agent_task" && toolCall.args) {
      const a = toolCall.args.agent as string;
      const t = toolCall.args.task as string;
      if (isAgentName(a) && t) {
        agent = a;
        task = t;

        const orchestrator = new AgentOrchestrator(session.projectId || session.id);
        orchestrator.onEvent((event) => {
          emitToProject(session.projectId || session.id, { type: "workflow_event", event });
        });
        orchestrator.start(task, agent).catch((err) => {
          console.error("Agent error:", err);
          send(session.ws, { type: "error", message: `Agent failed: ${err.message}` });
        });
      }
    }
  } catch (err) {
    responseText = `Sorry, I encountered an error: ${err instanceof Error ? err.message : "Unknown error"}`;
    console.error("Gemini error:", err);
  }

  send(session.ws, { type: "text_response", text: responseText });

  try {
    const ttsAgent: AgentName = agent || "designer";
    console.log(`[WS] Calling TTS for agent=${ttsAgent}, text="${responseText.substring(0, 60)}..."`);
    const tts = await synthesizeSpeech(responseText, ttsAgent);
    console.log(`[WS] TTS success, audio length=${tts.audio.length}`);
    send(session.ws, { type: "audio_response", audio: tts.audio, audioMimeType: tts.mimeType });
  } catch (err) {
    console.error("[WS] TTS failed:", err);
    send(session.ws, {
      type: "audio_error",
      message: `Voice synthesis failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    });
  }
}

interface LiveSession {
  id: string;
  ws: WebSocket;
  projectId?: string;
  closed: boolean;
}

export function setupConversationWebSocket(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });
  const sessions = new Map<WebSocket, LiveSession>();

  server.on("upgrade", (request: IncomingMessage, socket, head) => {
    const pathname = new URL(request.url || "/", "http://localhost").pathname;
    if (pathname !== "/ws/conversation") return;
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
  });

  wss.on("connection", (ws: WebSocket) => {
    const session: LiveSession = {
      id: randomUUID(),
      ws,
      closed: false,
    };
    sessions.set(ws, session);
    send(ws, { type: "session_started", sessionId: session.id });

    ws.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString()) as ClientMessage;

        if (message.type === "start_session") {
          session.projectId = message.projectId;
          send(ws, { type: "live_ready", sessionId: session.id });

          if (message.projectId) {
            const unsub = subscribeToProject(message.projectId, (msg) => send(ws, msg));
            ws.on("close", () => unsub());
          }

        } else if (message.type === "text_message") {
          if (!message.text?.trim()) {
            send(ws, { type: "error", message: "Empty text message" });
            return;
          }
          send(ws, { type: "ai_thinking" });
          handleTextMessage(session, message.text.trim()).catch((err) => {
            console.error("Text handling error:", err);
            send(ws, { type: "error", message: "Failed to process message" });
          });

        } else if (message.type === "interrupt") {
          send(ws, { type: "interrupted" });

        } else if (message.type === "stop_session") {
          session.closed = true;
          ws.close(1000, "Session stopped");

        } else {
          send(ws, { type: "error", message: "Unknown message type" });
        }
      } catch (error) {
        send(ws, { type: "error", message: error instanceof Error ? error.message : "Invalid message" });
      }
    });

    ws.on("close", () => {
      session.closed = true;
      sessions.delete(ws);
    });
  });
}

export function broadcastToProject(projectId: string, message: object): void {
  // reserved
}
