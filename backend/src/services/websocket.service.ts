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

  orchestrator.start(args.task).catch((err) => {
    console.error("Agent workflow error:", err);
    send(session.ws, { type: "error", message: `Agent workflow failed: ${err.message}` });
  });

  return {
    status: "started",
    message: `The ${args.agent} agent is now working on: ${args.task}. Code updates will appear in the editor as they are generated.`,
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
        responseModalities: ["AUDIO"],
        tools: toolDeclarations,
        systemInstruction: {
          parts: [{
            text: `You are Vibe, a friendly AI website builder assistant. You have a team of 3 agents: Designer, Developer, and Tester.

Your role:
- Be conversational, warm, and helpful. Greet the user and ask clarifying questions when needed.
- When the user asks to BUILD, CREATE, or CODE a website/app, use the run_agent_task tool with agent="developer" and a clear task description.
- When the user asks to DESIGN or PLAN, use run_agent_task with agent="designer".
- When the user asks to TEST or VALIDATE, use run_agent_task with agent="tester".
- When the user asks general questions (what is React? how does CSS work? etc.), answer directly from your knowledge — do NOT use tools for general knowledge questions.
- Keep audio responses short and natural (2-3 sentences max).
- Confirm when agents start working and let the user know code will appear in the editor.

Example interactions:
User: "Build a tic tac toe game for me"
You: "Great idea! Let me have the Developer agent build a tic-tac-toe game for you right now. The code will appear in your editor shortly."
[Then call run_agent_task with agent="developer", task="Build a tic-tac-toe game with HTML, CSS, and JavaScript"]

User: "What is React?"
You: "React is a JavaScript library for building user interfaces, maintained by Meta. It lets you create reusable UI components. Would you like me to build something with React?"

User: "Make the button blue"
You: "Sure! Let me have the Developer update that for you."
[Then call run_agent_task with agent="developer", task="Change the button color to blue"]`,
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
