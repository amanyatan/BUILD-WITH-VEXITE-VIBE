import { z } from "zod";

export const generateCodeSchema = z.object({
  prompt: z.string().min(1),
  language: z.string().min(1),
});

export const validateCodeSchema = z.object({
  code: z.string().min(1),
  language: z.string().min(1),
});
