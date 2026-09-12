import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { AgentOrchestrator, WorkflowEvent } from "../agents/agent.orchestrator";
import { setupConversationWebSocket } from "../services/websocket.service";

interface ClientConnection {
  ws: WebSocket;
  projectId: string;
  orchestrator: AgentOrchestrator;
}

const clients = new Map<string, ClientConnection>();

export function setupWebSocket(server: Server): void {
  setupConversationWebSocket(server);
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url || "/", "http://localhost").pathname;
    if (pathname !== "/ws") return;
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
  });

  wss.on("connection", (ws: WebSocket) => {
    let projectId = "";
    let orchestrator: AgentOrchestrator | null = null;

    ws.on("message", async (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === "join_project") {
          projectId = msg.projectId;
          orchestrator = new AgentOrchestrator(projectId);

          orchestrator.onEvent((event: WorkflowEvent) => {
            ws.send(JSON.stringify({ type: "workflow_event", event }));
          });

          clients.set(projectId, { ws, projectId, orchestrator });
          ws.send(JSON.stringify({ type: "joined", projectId }));
        }

        if (msg.type === "start_workflow" && orchestrator) {
          ws.send(JSON.stringify({ type: "workflow_started" }));
          await orchestrator.start(msg.userRequest);
        }

        if (msg.type === "stop_workflow" && orchestrator) {
          orchestrator.stop();
          ws.send(JSON.stringify({ type: "workflow_stopped" }));
        }

      } catch (err) {
        ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
      }
    });

    ws.on("close", () => {
      if (projectId) {
        clients.delete(projectId);
      }
    });
  });
}

export function broadcastToProject(projectId: string, message: object): void {
  const client = clients.get(projectId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(message));
  }
}
