import { BaseAgent } from "../base";
import { AgentMessage, CodeGenerationResult, DesignPlan } from "../agent.types";
import { buildDeveloperPrompt, buildDeveloperFixPrompt } from "./developer.prompt";
import { generateJSON } from "../../ai/provider";

export class DeveloperAgent extends BaseAgent {
  constructor() {
    super("developer-1", "Developer", "developer");
  }

  async process(input: { designPlan: DesignPlan }): Promise<AgentMessage> {
    this.setStatus("working");

    const planString = JSON.stringify(input.designPlan, null, 2);
    const { system, user } = buildDeveloperPrompt(planString);

    console.log("[Developer] Generating code...");
    const response = await generateJSON(system, user, 16384);
    console.log("[Developer] Code generated successfully");

    const result = response as CodeGenerationResult;

    const message: AgentMessage = {
      id: `msg-${Date.now()}-developer`,
      role: "developer",
      content: JSON.stringify(result),
      timestamp: new Date(),
      metadata: { type: "code_generation", files: result.files },
    };

    this.addMessage(message);
    this.state.lastMessage = message;
    this.setStatus("idle");

    return message;
  }

  async fix(
    designPlan: DesignPlan,
    currentFiles: string,
    validationReport: string
  ): Promise<AgentMessage> {
    this.setStatus("working");

    const planString = JSON.stringify(designPlan, null, 2);
    const { system, user } = buildDeveloperFixPrompt(planString, currentFiles, validationReport);

    console.log("[Developer] Fixing code...");
    const response = await generateJSON(system, user, 16384);
    console.log("[Developer] Fix generated successfully");

    const result = response as CodeGenerationResult;

    const message: AgentMessage = {
      id: `msg-${Date.now()}-developer-fix`,
      role: "developer",
      content: JSON.stringify(result),
      timestamp: new Date(),
      metadata: { type: "code_fix", files: result.files },
    };

    this.addMessage(message);
    this.state.lastMessage = message;
    this.setStatus("idle");

    return message;
  }

  parseFiles(response: string): CodeGenerationResult | null {
    try {
      const parsed = JSON.parse(response) as CodeGenerationResult;
      if (!parsed.files || !Array.isArray(parsed.files) || parsed.files.length === 0) {
        console.error("[Developer] Parsed JSON but no files array found");
        return null;
      }
      return parsed;
    } catch (err) {
      console.error("[Developer] Failed to parse files JSON:", err);
      console.error("[Developer] Response preview:", response.substring(0, 300));
      return null;
    }
  }
}
