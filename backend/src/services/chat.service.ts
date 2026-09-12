import { config } from "../config";
import { AgentOrchestrator } from "../agents/agent.orchestrator";
import { AgentName, isAgentName } from "./agent-router.service";

const TOOL_DECLARATIONS = [
  {
    functionDeclarations: [
      {
        name: "run_agent_task",
        description: "Build or modify a website using the Vibe agent team. Call this when the user asks to create, build, design, code, fix, or modify any website or web app.",
        parameters: {
          type: "OBJECT",
          properties: {
            agent: { type: "STRING", enum: ["developer", "designer", "tester"] },
            task: { type: "STRING", description: "Clear description of what to build or modify." },
          },
          required: ["agent", "task"],
        },
      },
    ],
  },
];

const SYSTEM_PROMPT = `You are Vibe, a friendly AI website builder assistant with a team of 3 agents: Designer, Developer, and Tester.

When the user asks to BUILD, CREATE, CODE, or MAKE a website/app, respond conversationally and call the run_agent_task tool with agent="developer".
When the user asks to DESIGN or PLAN, call run_agent_task with agent="designer".
When the user asks to TEST or VALIDATE, call run_agent_task with agent="tester".
For general questions, answer directly without using tools.

Keep responses concise and helpful.`;

interface ChatResponse {
  text: string;
  agent?: AgentName;
  task?: string;
}

export async function handleTextChat(
  userMessage: string,
  projectId: string,
  onCodeUpdate: (files: Record<string, string>) => void,
  onWorkflowEvent: (event: object) => void
): Promise<ChatResponse> {
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
    throw new Error(data.error?.message || `Gemini request failed: ${response.status}`);
  }

  const parts = data.candidates?.[0]?.content?.parts || [];
  let textParts: string[] = [];
  let toolCall: { name: string; args?: Record<string, unknown> } | null = null;

  for (const part of parts) {
    if (part.text) textParts.push(part.text);
    if (part.functionCall) toolCall = part.functionCall;
  }

  const responseText = textParts.join("\n") || "Done!";

  if (toolCall && toolCall.name === "run_agent_task" && toolCall.args) {
    const args = toolCall.args;
    const agent = args.agent as string;
    const task = args.task as string;

    if (isAgentName(agent) && task) {
      const orchestrator = new AgentOrchestrator(projectId);
      orchestrator.onEvent((event) => {
        onWorkflowEvent(event);
      });

      orchestrator.start(task, agent).catch((err) => {
        console.error("Agent workflow error:", err);
      });

      return {
        text: responseText,
        agent,
        task,
      };
    }
  }

  return { text: responseText };
}
