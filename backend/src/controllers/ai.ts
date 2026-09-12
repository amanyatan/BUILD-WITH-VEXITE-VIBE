import { Request, Response } from "express";
import { generateCodeSchema, validateCodeSchema } from "../schemas/ai";

export async function generateCode(req: Request, res: Response) {
  const { error, data } = generateCodeSchema.safeParse(req.body);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ code: "// Generated code", language: data.language });
}

export async function validateCode(req: Request, res: Response) {
  const { error } = validateCodeSchema.safeParse(req.body);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ valid: true, errors: [] });
}
