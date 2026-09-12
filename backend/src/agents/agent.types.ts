export interface AgentMessage {
  id: string;
  role: "designer" | "developer" | "tester" | "user" | "orchestrator";
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface DesignPlan {
  websiteType: string;
  goal: string;
  targetAudience: string;
  sections: string[];
  features: string[];
  style: {
    theme: string;
    colors: string[];
    typography: string;
    layout: string;
    spacing: string;
  };
  responsiveBehavior: string[];
  accessibilityRequirements: string[];
  requirements: string[];
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface CodeGenerationResult {
  files: GeneratedFile[];
}

export interface ValidationResult {
  status: "passed" | "passed_with_warnings" | "failed";
  errors: string[];
  warnings: string[];
  suggestions: string[];
  fixes: string[];
}

export interface AgentState {
  id: string;
  name: string;
  role: "designer" | "developer" | "tester";
  status: "idle" | "thinking" | "speaking" | "working";
  lastMessage?: AgentMessage;
}

export interface WorkflowState {
  projectId: string;
  currentStep: "design" | "develop" | "test" | "fix" | "complete";
  designPlan?: DesignPlan;
  generatedFiles?: GeneratedFile[];
  validationResult?: ValidationResult;
  messages: AgentMessage[];
  isActive: boolean;
}

export interface VoiceChunk {
  agent: "designer" | "developer" | "tester";
  audio: Buffer;
  transcript?: string;
}

export interface WSMessage {
  type: "user_message" | "agent_message" | "voice_chunk" | "code_update" | "workflow_update" | "agent_status";
  payload: unknown;
}
