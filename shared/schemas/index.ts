import { z } from "zod";

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
});

export const projectSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string(),
  status: z.enum(["draft", "active", "published"]),
});

export const generateCodeSchema = z.object({
  prompt: z.string().min(1),
  language: z.string().min(1),
});

export const voiceRequestSchema = z.object({
  audioUrl: z.string().url(),
  language: z.string(),
});
