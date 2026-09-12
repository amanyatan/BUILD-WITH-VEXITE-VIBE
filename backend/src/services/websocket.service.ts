import { IncomingMessage, Server } from "http";
import { randomUUID } from "crypto";
import { WebSocket, WebSocketServer } from "ws";
import { config } from "../config";
import { AgentName, isAgentName } from "./agent-router.service";
import { AgentOrchestrator } from "../agents/agent.orchestrator";
import { searchWeb } from "./tavily.service";

type ClientMessage =
  | { type: "start_session"; projectId?: string }
  | { type: "audio_chunk"; audio: string; mimeType?: string }
  | { type: "text_message"; text: string }
  | { type: "select_agent"; agent: AgentName }
  | { type: "interrupt" }
  | { type: "stop_session" };

interface LiveSession {
  id: string;
  ws: WebSocket;
  live: WebSocket | null;
  projectId?: string;
  activeAgent: AgentName | null;
  closed: boolean;
  liveReady: boolean;
  pendingLiveMessages: object[];
}

const toolDeclarations = [
  {
    functionDeclarations: [
      {
        name: "run_agent_task",
        description: "Execute a website task with the selected Vibe agent and stream any generated code updates.",
        parameters: {
          type: "OBJECT",
          properties: {
            agent: { type: "STRING", enum: ["developer", "designer", "tester"] },
            task: { type: "STRING", description: "The requested website task." },
          },
          required: ["agent", "task"],
        },
      },
      {
        name: "web_search",
        description: "Search current public web information when the user asks for current research.",
        parameters: {
          type: "OBJECT",
          properties: { query: { type: "STRING" } },
          required: ["query"],
        },
      },
    ],
  },
];

function send(ws: WebSocket, message: object): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function sendLive(live: WebSocket | null, message: object): void {
  if (live?.readyState === WebSocket.OPEN) live.send(JSON.stringify(message));
}

function queueOrSendLive(session: LiveSession, message: object): void {
  if (session.liveReady && session.live?.readyState === WebSocket.OPEN) {
    session.live.send(JSON.stringify(message));
  } else if (session.pendingLiveMessages.length < 80) {
    session.pendingLiveMessages.push(message);
  }
}

function closeSocket(ws: WebSocket | null): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) ws.close();
}

async function runAgentTask(session: LiveSession, args: { agent?: string; task?: string }): Promise<object> {
  if (!isAgentName(args.agent) || !args.task) throw new Error("Agent task requires a valid agent and task");
  session.activeAgent = args.agent;
  const orchestrator = new AgentOrchestrator(session.projectId || session.id);
  orchestrator.onEvent((event) => {
    if (event.type === "code_update" && event.files) {
      send(session.ws, {
        type: "code_update",
        files: Object.fromEntries(event.files.map((file) => [file.path, file.content])),
      });
    }
    send(session.ws, { type: "workflow_event", event });
  });
  await orchestrator.start(args.task);
  return { status: "completed", agent: args.agent, task: args.task };
}

async function handleToolCall(session: LiveSession, toolCall: { functionCalls?: Array<{ id: string; name: string; args?: Record<string, unknown> }> }): Promise<void> {
  const functionResponses = [];
  for (const call of toolCall.functionCalls || []) {
    try {
      const result =
        call.name === "web_search"
          ? { results: await searchWeb(String(call.args?.query || "")) }
          : call.name === "run_agent_task"
            ? await runAgentTask(session, call.args as { agent?: string; task?: string })
            : { error: `Unknown tool: ${call.name}` };
      functionResponses.push({ name: call.name, id: call.id, response: { result } });
    } catch (error) {
      functionResponses.push({
        name: call.name,
        id: call.id,
        response: { error: error instanceof Error ? error.message : "Tool execution failed" },
      });
    }
  }
  sendLive(session.live, { toolResponse: { functionResponses } });
}

function connectGemini(session: LiveSession): void {
  if (!config.geminiApiKey) {
    send(session.ws, { type: "error", message: "GEMINI_API_KEY is required." });
    return;
  }

  const url =
    "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent" +
    `?key=${encodeURIComponent(config.geminiApiKey)}`;

  const live = new WebSocket(url);
  session.live = live;

  live.on("open", () => {
    sendLive(live, {
      setup: {
        model: `models/${config.geminiLiveModel}`,
        responseModalities: ["AUDIO"],
        tools: toolDeclarations,
        systemInstruction: {
          parts: [{
            text: "You are Vibe, an AI website builder with 3 agents: Designer, Developer, and Tester. When the user describes a website idea, first ask any clarifying questions as the Designer, then use run_agent_task to have the Developer build it, then the Tester validates it. Respond naturally and briefly in audio. The user can interrupt you at any time.",
          }],
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    });
    session.liveReady = false;
  });

  live.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString()) as {
        setupComplete?: object;
        toolCall?: { functionCalls?: Array<{ id: string; name: string; args?: Record<string, unknown> }> };
        serverContent?: {
          modelTurn?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string }; text?: string }> };
          turnComplete?: boolean;
          interrupted?: boolean;
          inputTranscription?: { text?: string };
          outputTranscription?: { text?: string };
        };
      };

      if (message.setupComplete) {
        session.liveReady = true;
        for (const pending of session.pendingLiveMessages.splice(0)) sendLive(live, pending);
        send(session.ws, { type: "live_ready", sessionId: session.id });
      }

      if (message.toolCall) {
        void handleToolCall(session, message.toolCall);
        return;
      }

      const content = message.serverContent;
      for (const part of content?.modelTurn?.parts || []) {
        if (part.inlineData?.data) {
          send(session.ws, {
            type: "audio_response",
            audio: part.inlineData.data,
            mimeType: part.inlineData.mimeType || "audio/pcm;rate=24000",
          });
        }
        if (part.text) {
          send(session.ws, { type: "text_response", text: part.text });
        }
      }

      if (content?.inputTranscription?.text) {
        send(session.ws, { type: "input_transcript", text: content.inputTranscription.text });
      }
      if (content?.outputTranscription?.text) {
        send(session.ws, { type: "output_transcript", text: content.outputTranscription.text });
      }
      if (content?.interrupted) send(session.ws, { type: "interrupted" });
      if (content?.turnComplete) send(session.ws, { type: "turn_complete" });
    } catch {
      send(session.ws, { type: "error", message: "Invalid message from Gemini Live" });
    }
  });

  live.on("error", (error) => {
    console.error("Gemini Live error:", error.message);
    send(session.ws, { type: "error", message: `Gemini Live failed: ${error.message}` });
  });

  live.on("close", () => {
    session.live = null;
    session.liveReady = false;
    if (!session.closed) send(session.ws, { type: "error", message: "Gemini Live disconnected" });
  });
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
      live: null,
      activeAgent: null,
      closed: false,
      liveReady: false,
      pendingLiveMessages: [],
    };
    sessions.set(ws, session);
    send(ws, { type: "session_started", sessionId: session.id });

    ws.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString()) as ClientMessage;

        if (message.type === "start_session") {
          session.projectId = message.projectId;
          connectGemini(session);

        } else if (message.type === "text_message") {
          if (!message.text?.trim()) throw new Error("Empty text message");
          queueOrSendLive(session, {
            clientContent: { turns: [{ parts: [{ text: message.text }] }], turnComplete: true },
          });

        } else if (message.type === "audio_chunk") {
          if (!message.audio || message.audio.length > 200_000) throw new Error("Invalid audio chunk");
          queueOrSendLive(session, {
            realtimeInput: { audio: { data: message.audio, mimeType: message.mimeType || "audio/pcm;rate=16000" } },
          });

        } else if (message.type === "select_agent" && isAgentName(message.agent)) {
          session.activeAgent = message.agent;
          send(ws, { type: "agent_selected", agent: message.agent });
          queueOrSendLive(session, {
            clientContent: { turns: [{ parts: [{ text: `Switch to ${message.agent} agent mode.` }] }], turnComplete: true },
          });

        } else if (message.type === "interrupt") {
          sendLive(session.live, {
            clientContent: { turns: [{ parts: [{ text: "Stop. The user is speaking." }] }], turnComplete: true },
          });
          send(ws, { type: "interrupted" });

        } else if (message.type === "stop_session") {
          session.closed = true;
          closeSocket(session.live);
          ws.close(1000, "Session stopped");

        } else {
          throw new Error("Unknown message type");
        }
      } catch (error) {
        send(ws, { type: "error", message: error instanceof Error ? error.message : "Invalid message" });
      }
    });

    ws.on("close", () => {
      session.closed = true;
      closeSocket(session.live);
      sessions.delete(ws);
    });
  });
}

export function broadcastToProject(projectId: string, message: object): void {
  // reserved for future use
}
