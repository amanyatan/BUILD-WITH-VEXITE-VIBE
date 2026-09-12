import { AgentMessage, AgentState } from "./agent.types";

export abstract class BaseAgent {
  public state: AgentState;
  protected messageHistory: AgentMessage[] = [];

  constructor(id: string, name: string, role: "designer" | "developer" | "tester") {
    this.state = {
      id,
      name,
      role,
      status: "idle",
    };
  }

  protected setStatus(status: AgentState["status"]): void {
    this.state.status = status;
  }

  protected addMessage(message: AgentMessage): void {
    this.messageHistory.push(message);
  }

  abstract process(input: Record<string, unknown>): Promise<AgentMessage>;

  getState(): AgentState {
    return { ...this.state };
  }

  getHistory(): AgentMessage[] {
    return [...this.messageHistory];
  }

  reset(): void {
    this.messageHistory = [];
    this.state.status = "idle";
    this.state.lastMessage = undefined;
  }
}
