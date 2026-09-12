import { Request, Response } from "express";
import { loginSchema, registerSchema } from "../schemas/auth";

export async function login(req: Request, res: Response) {
  const { error, data } = loginSchema.safeParse(req.body);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ token: "jwt-token", user: data.email });
}

export async function register(req: Request, res: Response) {
  const { error, data } = registerSchema.safeParse(req.body);
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ message: "User created", user: data.email });
}
