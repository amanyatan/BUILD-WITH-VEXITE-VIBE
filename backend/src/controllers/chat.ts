import { Request, Response } from "express";
import { handleTextChat } from "../services/chat.service";

export async function chat(req: Request, res: Response) {
  try {
    const { message, projectId } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }
    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }

    const result = await handleTextChat(message, projectId);
    res.json(result);
  } catch (err) {
    console.error("Chat error:", err);
    const message = err instanceof Error ? err.message : "Chat failed";
    res.status(500).json({ error: message });
  }
}
