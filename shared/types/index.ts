export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "published";
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface Agent {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
}

export interface GeneratedCode {
  id: string;
  projectId: string;
  language: string;
  code: string;
  createdAt: string;
}

export interface VoiceRequest {
  audioUrl: string;
  language: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  htmlUrl: string;
}
