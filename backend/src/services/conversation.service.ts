import { generateText } from "../ai/provider";
import {
  AgentName,
  detectAgent,
  getAgentKnowledge,
  getAgentLabel,
} from "./agent-router.service";
import { searchWeb } from "./tavily.service";

export interface ConversationTurn {
  role: "user" | "assistant";
  text: string;
}

export interface ConversationResult {
  agent: AgentName;
  text: string;
  files?: Record<string, string>;
}

function extractFiles(text: string): Record<string, string> | undefined {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (!match) return undefined;
  try {
    const parsed = JSON.parse(match[1]) as { files?: Array<{ path: string; content: string }> };
    if (!parsed.files) return undefined;
    return Object.fromEntries(parsed.files.map((file) => [file.path, file.content]));
  } catch {
    return undefined;
  }
}

export async function handleConversation(
  transcript: string,
  activeAgent: AgentName | null,
  history: ConversationTurn[]
): Promise<ConversationResult> {
  const selectedAgent = detectAgent(transcript) || activeAgent;
  if (!selectedAgent) {
    return {
      agent: "designer",
      text: "Which agent would you like to use: Developer, Designer, or Tester?",
    };
  }

  let context = "";
  if (/\b(search|latest|current|research|look up|find online)\b/i.test(transcript)) {
    context = `\nWeb research:\n${await searchWeb(transcript)}\n`;
  }

  const system = `${getAgentKnowledge(selectedAgent)}

You are the ${getAgentLabel(selectedAgent)} agent in a live voice conversation.
Use the knowledge base above. Be concise and conversational because your answer will be spoken aloud.
Never claim to have changed files unless you return the changes.
${selectedAgent === "developer" ? 'For code requests, include a JSON code block: {"files":[{"path":"index.html","content":"..."},{"path":"style.css","content":"..."},{"path":"script.js","content":"..."}]}.' : ""}
${selectedAgent === "tester" ? "When validating files, clearly separate errors, warnings, and next actions." : ""}`;
  const recentHistory = history.slice(-8).map((turn) => `${turn.role}: ${turn.text}`).join("\n");
  const text = await generateText(system, `${recentHistory}\nuser: ${transcript}${context}`);
  return { agent: selectedAgent, text, files: selectedAgent === "developer" ? extractFiles(text) : undefined };
}
