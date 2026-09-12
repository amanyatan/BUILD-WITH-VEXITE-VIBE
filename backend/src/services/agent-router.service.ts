import { developerKnowledge } from "../agents/developer/developer.knowledge";
import { designerKnowledge } from "../agents/designer/designer.knowledge";
import { testerKnowledge } from "../agents/tester/tester.knowledge";

export type AgentName = "developer" | "designer" | "tester";

const agentNames: AgentName[] = ["developer", "designer", "tester"];

export function isAgentName(value: unknown): value is AgentName {
  return typeof value === "string" && agentNames.includes(value as AgentName);
}

export function detectAgent(text: string): AgentName | null {
  const normalized = text.toLowerCase();
  return agentNames.find((agent) => new RegExp(`\\b${agent}\\b`).test(normalized)) || null;
}

export function getAgentKnowledge(agent: AgentName): string {
  return {
    developer: developerKnowledge,
    designer: designerKnowledge,
    tester: testerKnowledge,
  }[agent];
}

export function getAgentLabel(agent: AgentName): string {
  return agent[0].toUpperCase() + agent.slice(1);
}
