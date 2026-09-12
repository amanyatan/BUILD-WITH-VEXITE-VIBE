type EventHandler = (event: object) => void;

const projectListeners = new Map<string, Set<EventHandler>>();

export function subscribeToProject(projectId: string, handler: EventHandler): () => void {
  if (!projectListeners.has(projectId)) {
    projectListeners.set(projectId, new Set());
  }
  projectListeners.get(projectId)!.add(handler);

  return () => {
    const listeners = projectListeners.get(projectId);
    if (listeners) {
      listeners.delete(handler);
      if (listeners.size === 0) projectListeners.delete(projectId);
    }
  };
}

export function emitToProject(projectId: string, message: object): void {
  const listeners = projectListeners.get(projectId);
  if (listeners) {
    for (const handler of listeners) {
      try { handler(message); } catch { /* ignore */ }
    }
  }
}
