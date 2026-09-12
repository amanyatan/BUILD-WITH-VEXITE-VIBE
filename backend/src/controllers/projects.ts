import { Request, Response } from "express";

export async function listProjects(_req: Request, res: Response) {
  res.json({ projects: [] });
}

export async function getProject(req: Request, res: Response) {
  res.json({ project: { id: req.params.id } });
}

export async function createProject(req: Request, res: Response) {
  res.status(201).json({ message: "Project created", project: req.body });
}

export async function updateProject(req: Request, res: Response) {
  res.json({ message: "Project updated", project: { id: req.params.id } });
}

export async function deleteProject(req: Request, res: Response) {
  res.json({ message: "Project deleted" });
}
