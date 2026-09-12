import { BaseAgent } from "../base";
import { AgentMessage, GeneratedFile, ValidationResult } from "../agent.types";
import { buildTesterPrompt } from "./tester.prompt";
import { generateJSON } from "../../ai/provider";

export class TesterAgent extends BaseAgent {
  constructor() {
    super("tester-1", "Tester", "tester");
  }

  async process(input: { files: GeneratedFile[] }): Promise<AgentMessage> {
    this.setStatus("thinking");

    const filesString = JSON.stringify(input.files, null, 2);
    const { system, user } = buildTesterPrompt(filesString);

    console.log("[Tester] Validating code...");
    const response = await generateJSON(system, user, 4096);
    console.log("[Tester] Validation complete");

    const result = response as ValidationResult;

    const message: AgentMessage = {
      id: `msg-${Date.now()}-tester`,
      role: "tester",
      content: JSON.stringify(result),
      timestamp: new Date(),
      metadata: { type: "validation_report", result },
    };

    this.addMessage(message);
    this.state.lastMessage = message;
    this.setStatus("idle");

    return message;
  }

  parseValidation(response: string): ValidationResult | null {
    try {
      return JSON.parse(response) as ValidationResult;
    } catch (err) {
      console.error("[Tester] Failed to parse validation JSON:", err);
      return null;
    }
  }
}
