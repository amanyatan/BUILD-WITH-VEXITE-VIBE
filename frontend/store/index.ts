"use client";
import { create } from "zustand";
import type { Project } from "@/types";

const defaultFiles: Record<string, string> = {
  "index.html": "",
  "style.css": "",
  "script.js": "",
};

export type Files = typeof defaultFiles;

interface AgentStatus {
  designer: "idle" | "thinking" | "speaking" | "working";
  developer: "idle" | "thinking" | "speaking" | "working";
  tester: "idle" | "thinking" | "speaking" | "working";
}

interface WorkflowStep {
  step: "design" | "develop" | "test" | "fix" | "complete" | "";
  designPlan?: Record<string, unknown>;
  generatedFiles?: Record<string, string>;
  validationResult?: {
    status: string;
    errors: string[];
    warnings: string[];
    suggestions: string[];
  };
}

interface AppState {
  user: string | null;
  projects: Project[];
  currentProject: string | null;
  files: Files;
  agentStatus: AgentStatus;
  workflow: WorkflowStep;
  setUser: (user: string | null) => void;
  addProject: (project: Project) => void;
  removeProject: (id: string) => void;
  setCurrentProject: (id: string | null) => void;
  setFile: (name: string, content: string) => void;
  setFiles: (files: Record<string, string>) => void;
  setAgentStatus: (agent: keyof AgentStatus, status: AgentStatus[keyof AgentStatus]) => void;
  setWorkflowStep: (step: WorkflowStep["step"]) => void;
  setDesignPlan: (plan: Record<string, unknown>) => void;
  setGeneratedFiles: (files: Record<string, string>) => void;
  setValidationResult: (result: WorkflowStep["validationResult"]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: typeof window !== "undefined" ? localStorage.getItem("user_email") || null : null,
  projects: [],
  currentProject: null,
  files: defaultFiles,
  agentStatus: { designer: "idle", developer: "idle", tester: "idle" },
  workflow: { step: "" },
  setUser: (user) => set({ user }),
  addProject: (project) => set((s) => ({ projects: [...s.projects, project] })),
  removeProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
  setCurrentProject: (id) => set({ currentProject: id }),
  setFile: (name, content) => set((s) => ({ files: { ...s.files, [name]: content } })),
  setFiles: (files) => set({ files }),
  setAgentStatus: (agent, status) => set((s) => ({ agentStatus: { ...s.agentStatus, [agent]: status } })),
  setWorkflowStep: (step) => set((s) => ({ workflow: { ...s.workflow, step } })),
  setDesignPlan: (plan) => set((s) => ({ workflow: { ...s.workflow, designPlan: plan } })),
  setGeneratedFiles: (files) => set((s) => ({ workflow: { ...s.workflow, generatedFiles: files } })),
  setValidationResult: (result) => set((s) => ({ workflow: { ...s.workflow, validationResult: result } })),
}));
