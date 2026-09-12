import { v4 as uuid } from "uuid";
import { DesignerAgent } from "./designer/designer.agent";
import { DeveloperAgent } from "./developer/developer.agent";
import { TesterAgent } from "./tester/tester.agent";
import {
  AgentMessage,
  DesignPlan,
  GeneratedFile,
  ValidationResult,
  WorkflowState,
} from "./agent.types";
import { AgentName } from "../services/agent-router.service";

export type WorkflowEvent = {
  type: "agent_thinking" | "agent_message" | "agent_speaking" | "workflow_step" | "code_update" | "validation_update" | "complete";
  agent?: "designer" | "developer" | "tester";
  message?: AgentMessage;
  step?: WorkflowState["currentStep"];
  files?: GeneratedFile[];
  validation?: ValidationResult;
};

type WorkflowCallback = (event: WorkflowEvent) => void;

export class AgentOrchestrator {
  private designer: DesignerAgent;
  private developer: DeveloperAgent;
  private tester: TesterAgent;
  private state: WorkflowState;
  private callback: WorkflowCallback | null = null;

  constructor(projectId: string) {
    this.designer = new DesignerAgent();
    this.developer = new DeveloperAgent();
    this.tester = new TesterAgent();
    this.state = {
      projectId,
      currentStep: "design",
      messages: [],
      isActive: false,
    };
  }

  onEvent(callback: WorkflowCallback): void {
    this.callback = callback;
  }

  private emit(event: WorkflowEvent): void {
    this.callback?.(event);
  }

  getState(): WorkflowState {
    return { ...this.state };
  }

  async start(userRequest: string, targetAgent?: AgentName): Promise<void> {
    this.state.isActive = true;

    try {
      if (targetAgent === "designer") {
        await this.runDesignerOnly(userRequest);
      } else if (targetAgent === "developer") {
        await this.runDeveloperOnly(userRequest);
      } else if (targetAgent === "tester") {
        await this.runTesterOnly(userRequest);
      } else {
        await this.runFullPipeline(userRequest);
      }
    } catch (err) {
      console.error("[Orchestrator] Pipeline error:", err);
      const errorAgent = targetAgent || "developer";
      this.emit({
        type: "agent_message",
        agent: errorAgent,
        message: {
          id: `msg-${Date.now()}-error`,
          role: errorAgent,
          content: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
          timestamp: new Date(),
        },
      });
      this.complete();
    }
  }

  private async runDesignerOnly(userRequest: string): Promise<void> {
    this.state.currentStep = "design";
    this.emit({ type: "workflow_step", step: "design" });
    this.emit({ type: "agent_thinking", agent: "designer" });

    const designMsg = await this.designer.process({ userRequest });
    this.state.messages.push(designMsg);
    this.state.designPlan = this.designer.parsePlan(designMsg.content) || undefined;

    this.emit({ type: "agent_message", agent: "designer", message: designMsg });
    this.emit({ type: "agent_speaking", agent: "designer", message: designMsg });
    this.complete();
  }

  private async runDeveloperOnly(userRequest: string): Promise<void> {
    this.state.currentStep = "develop";
    this.emit({ type: "workflow_step", step: "develop" });
    this.emit({ type: "agent_thinking", agent: "developer" });

    const planFromRequest: DesignPlan = {
      websiteType: "custom",
      goal: userRequest,
      targetAudience: "users",
      sections: ["main content"],
      features: [],
      style: { theme: "modern", colors: [], typography: "system", layout: "responsive", spacing: "comfortable" },
      responsiveBehavior: ["mobile-friendly"],
      accessibilityRequirements: ["semantic HTML"],
      requirements: [userRequest],
    };

    const devMsg = await this.developer.process({ designPlan: planFromRequest });
    this.state.messages.push(devMsg);

    const result = this.developer.parseFiles(devMsg.content);
    if (result) {
      this.state.generatedFiles = result.files;
      this.emit({ type: "code_update", files: result.files });
    } else {
      console.error("[Orchestrator] Developer returned no parseable files");
    }

    this.emit({ type: "agent_message", agent: "developer", message: devMsg });
    this.emit({ type: "agent_speaking", agent: "developer", message: devMsg });
    this.complete();
  }

  private async runTesterOnly(userRequest: string): Promise<void> {
    this.state.currentStep = "test";
    this.emit({ type: "workflow_step", step: "test" });
    this.emit({ type: "agent_thinking", agent: "tester" });

    const testMsg = await this.tester.process({ files: this.state.generatedFiles || [] });
    this.state.messages.push(testMsg);

    const validation = this.tester.parseValidation(testMsg.content);
    if (validation) {
      this.state.validationResult = validation;
      this.emit({ type: "validation_update", validation });
    }

    this.emit({ type: "agent_message", agent: "tester", message: testMsg });
    this.emit({ type: "agent_speaking", agent: "tester", message: testMsg });
    this.complete();
  }

  private async runFullPipeline(userRequest: string): Promise<void> {
    this.state.currentStep = "design";
    this.emit({ type: "workflow_step", step: "design" });
    this.emit({ type: "agent_thinking", agent: "designer" });

    const designMsg = await this.designer.process({ userRequest });
    this.state.messages.push(designMsg);
    this.state.designPlan = this.designer.parsePlan(designMsg.content) || undefined;

    this.emit({ type: "agent_message", agent: "designer", message: designMsg });
    this.emit({ type: "agent_speaking", agent: "designer", message: designMsg });

    if (!this.state.designPlan) {
      console.warn("[Orchestrator] Design plan parse failed, using default plan");
      // Create a default plan instead of aborting
      this.state.designPlan = {
        websiteType: "custom",
        goal: userRequest,
        targetAudience: "users",
        sections: ["main content"],
        features: [],
        style: { theme: "modern", colors: [], typography: "system", layout: "responsive", spacing: "comfortable" },
        responsiveBehavior: ["mobile-friendly"],
        accessibilityRequirements: ["semantic HTML"],
        requirements: [userRequest],
      };
    }

    await this.develop();
  }

  private async develop(): Promise<void> {
    this.state.currentStep = "develop";
    this.emit({ type: "workflow_step", step: "develop" });
    this.emit({ type: "agent_thinking", agent: "developer" });

    const devMsg = await this.developer.process({ designPlan: this.state.designPlan! });
    this.state.messages.push(devMsg);

    const result = this.developer.parseFiles(devMsg.content);
    if (result) {
      this.state.generatedFiles = result.files;
      this.emit({ type: "code_update", files: result.files });
    } else {
      console.error("[Orchestrator] Developer returned no parseable files");
    }

    this.emit({ type: "agent_message", agent: "developer", message: devMsg });
    this.emit({ type: "agent_speaking", agent: "developer", message: devMsg });

    await this.test();
  }

  private async test(): Promise<void> {
    this.state.currentStep = "test";
    this.emit({ type: "workflow_step", step: "test" });
    this.emit({ type: "agent_thinking", agent: "tester" });

    const testMsg = await this.tester.process({ files: this.state.generatedFiles || [] });
    this.state.messages.push(testMsg);

    const validation = this.tester.parseValidation(testMsg.content);
    if (validation) {
      this.state.validationResult = validation;
      this.emit({ type: "validation_update", validation });
    }

    this.emit({ type: "agent_message", agent: "tester", message: testMsg });
    this.emit({ type: "agent_speaking", agent: "tester", message: testMsg });

    if (validation?.status === "failed" && validation.errors.length > 0) {
      await this.fix();
    } else {
      this.complete();
    }
  }

  private async fix(): Promise<void> {
    this.state.currentStep = "fix";
    this.emit({ type: "workflow_step", step: "fix" });
    this.emit({ type: "agent_thinking", agent: "developer" });

    const filesString = JSON.stringify(this.state.generatedFiles, null, 2);
    const validationString = JSON.stringify(this.state.validationResult, null, 2);

    const fixMsg = await this.developer.fix(
      this.state.designPlan!,
      filesString,
      validationString
    );
    this.state.messages.push(fixMsg);

    const fixResult = this.developer.parseFiles(fixMsg.content);
    if (fixResult) {
      this.state.generatedFiles = fixResult.files;
      this.emit({ type: "code_update", files: fixResult.files });
    }

    this.emit({ type: "agent_message", agent: "developer", message: fixMsg });

    await this.test();
  }

  private complete(): void {
    this.state.currentStep = "complete";
    this.state.isActive = false;
    this.emit({ type: "workflow_step", step: "complete" });
    this.emit({ type: "complete" });
  }

  stop(): void {
    this.state.isActive = false;
  }
}
