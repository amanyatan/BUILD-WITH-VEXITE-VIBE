export interface User { id: string; email: string; name: string; avatar?: string; }
export interface Project { id: string; name: string; description: string; status: "draft" | "active" | "published"; createdAt: string; updatedAt: string; userId: string; }
export interface Agent { id: string; name: string; type: string; config: Record<string, unknown>; }
