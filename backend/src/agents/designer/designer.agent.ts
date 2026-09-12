import { BaseAgent } from "../base";
import { AgentMessage, DesignPlan } from "../agent.types";
import { buildDesignerPrompt } from "./designer.prompt";
import { generateJSON } from "../../ai/provider";

export class DesignerAgent extends BaseAgent {
  constructor() {
    super("designer-1", "Designer", "designer");
  }

  async process(input: { userRequest: string }): Promise<AgentMessage> {
    this.setStatus("thinking");

    const { system, user } = buildDesignerPrompt(input.userRequest);

    console.log("[Designer] Creating design plan...");
    const response = await generateJSON(system, user, 4096);
    console.log("[Designer] Design plan created");

    const plan = response as DesignPlan;

    const message: AgentMessage = {
      id: `msg-${Date.now()}-designer`,
      role: "designer",
      content: JSON.stringify(plan),
      timestamp: new Date(),
      metadata: { type: "design_plan", plan },
    };

    this.addMessage(message);
    this.state.lastMessage = message;
    this.setStatus("idle");

    return message;
  }

  parsePlan(response: string): DesignPlan | null {
    try {
      return JSON.parse(response) as DesignPlan;
    } catch (err) {
      console.error("[Designer] Failed to parse plan JSON:", err);
      return null;
    }
  }
}
