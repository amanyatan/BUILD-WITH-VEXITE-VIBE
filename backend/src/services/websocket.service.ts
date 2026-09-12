import { IncomingMessage, Server } from "http";
import { randomUUID } from "crypto";
import { WebSocket, WebSocketServer } from "ws";
import { config } from "../config";
import { AgentName, isAgentName } from "./agent-router.service";
import { AgentOrchestrator } from "../agents/agent.orchestrator";
import { searchWeb } from "./tavily.service";
import { subscribeToProject } from "./event-bus";

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
        description: "Build or modify a website using the Vibe agent team. Use this when the user asks to create, build, design, code, fix, or modify any website or web app. The agents will generate HTML, CSS, and JavaScript files.",
        parameters: {
          type: "OBJECT",
          properties: {
            agent: { type: "STRING", enum: ["developer", "designer", "tester"], description: "Which agent to use. Use 'designer' for planning, 'developer' for coding, 'tester' for validation." },
            task: { type: "STRING", description: "Clear description of what to build or modify." },
          },
          required: ["agent", "task"],
        },
      },
      {
        name: "web_search",
        description: "Search the web for current information when the user asks about recent events, facts, or research.",
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

function runAgentTask(session: LiveSession, args: { agent?: string; task?: string }): { status: string; message: string } {
  if (!args.agent || !args.task) throw new Error("Agent task requires a valid agent and task");
  if (!isAgentName(args.agent)) throw new Error(`Invalid agent: ${args.agent}`);

  const agent: AgentName = args.agent;
  session.activeAgent = agent;

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

  orchestrator.start(args.task, agent).catch((err) => {
    console.error("Agent workflow error:", err);
    send(session.ws, { type: "error", message: `Agent workflow failed: ${err.message}` });
  });

  return {
    status: "started",
    message: `The ${agent} agent is now working on: ${args.task}. Code updates will appear in the editor as they are generated.`,
  };
}

async function handleToolCall(session: LiveSession, toolCall: { functionCalls?: Array<{ id: string; name: string; args?: Record<string, unknown> }> }): Promise<void> {
  const functionResponses = [];
  for (const call of toolCall.functionCalls || []) {
    try {
      const result =
        call.name === "web_search"
          ? { results: await searchWeb(String(call.args?.query || "")) }
          : call.name === "run_agent_task"
            ? runAgentTask(session, call.args as { agent?: string; task?: string })
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
        generationConfig: {
          responseModalities: ["AUDIO"],
        },
        tools: toolDeclarations,
        systemInstruction: {
          parts: [{
            text: `You are Vibe, a friendly AI website builder assistant. You have a team of 3 agents: Designer, Developer, and Tester.

IMPORTANT: Only call ONE agent per request. Never call multiple agents.

Routing rules:
- User says "BUILD", "CREATE", "CODE", "MAKE" a website/app → call run_agent_task with agent="developer"
- User says "DESIGN", "PLAN", "SKETCH" → call run_agent_task with agent="designer"
- User says "TEST", "VALIDATE", "CHECK" → call run_agent_task with agent="tester"
- User asks a general question (what is React? how does CSS work?) → answer directly, do NOT use any tool
- User says "fix", "update", "change" something about existing code → call run_agent_task with agent="developer"

Keep audio responses short (1-2 sentences). Confirm the agent is working and code will appear in the editor.

Examples:
User: "Build a tic tac toe game" → You: "I'll have the Developer build that for you!" [call run_agent_task(agent="developer", task="Build a tic-tac-toe game with HTML, CSS, and JavaScript")]
User: "Design a portfolio website" → You: "Let me have the Designer plan that out!" [call run_agent_task(agent="designer", task="Design a portfolio website plan")]
User: "Test the code" → You: "Running the Tester now!" [call run_agent_task(agent="tester", task="Validate the current website files")]
User: "What is React?" → You: "React is a JavaScript library for building user interfaces. Want me to build something with it?"`,
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

  live.on("unexpected-response", (req, res) => {
    const statusCode = res.statusCode;
    let body = "";
    res.on("data", (chunk) => { body += chunk; });
    res.on("end", () => {
      console.error(`Gemini Live unexpected response ${statusCode}:`, body);
      send(session.ws, { type: "error", message: `Gemini Live rejected connection (${statusCode}): ${body}` });
    });
  });

  live.on("close", (code, reason) => {
    console.error(`Gemini Live closed: code=${code} reason=${reason?.toString() || "none"}`);
    session.live = null;
    session.liveReady = false;
    if (!session.closed) send(session.ws, { type: "error", message: `Gemini Live disconnected (code: ${code})` });
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

          if (message.projectId) {
            const unsub = subscribeToProject(message.projectId, (msg) => send(session.ws, msg));
            ws.on("close", () => unsub());
          }

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
