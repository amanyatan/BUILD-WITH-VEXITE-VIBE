import { Router, Request, Response } from "express";
import { AgentOrchestrator } from "../agents/agent.orchestrator";

const router = Router();

const orchestrators = new Map<string, AgentOrchestrator>();

router.post("/start", async (req: Request, res: Response) => {
  try {
    const { projectId, userRequest } = req.body;

    if (!projectId || !userRequest) {
      return res.status(400).json({ error: "projectId and userRequest required" });
    }

    let orchestrator = orchestrators.get(projectId);
    if (!orchestrator) {
      orchestrator = new AgentOrchestrator(projectId);
      orchestrators.set(projectId, orchestrator);
    }

    orchestrator.onEvent((event) => {
      // Events are sent via WebSocket
    });

    await orchestrator.start(userRequest);

    res.json({ status: "completed", state: orchestrator.getState() });
  } catch (err) {
    console.error("Workflow error:", err);
    res.status(500).json({ error: "Workflow failed" });
  }
});

router.post("/stop", (req: Request, res: Response) => {
  const { projectId } = req.body;
  const orchestrator = orchestrators.get(projectId);
  if (orchestrator) {
    orchestrator.stop();
    orchestrators.delete(projectId);
  }
  res.json({ status: "stopped" });
});

router.get("/state/:projectId", (req: Request, res: Response) => {
  const projectId = String(req.params.projectId);
  const orchestrator = orchestrators.get(projectId);
  if (orchestrator) {
    res.json(orchestrator.getState());
  } else {
    res.status(404).json({ error: "Project not found" });
  }
});

export { router as workflowRoutes };
