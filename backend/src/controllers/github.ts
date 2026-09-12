import { Request, Response } from "express";

export async function connectRepo(req: Request, res: Response) {
  res.json({ message: "Repository connected", repo: req.body.repo });
}

export async function getRepos(_req: Request, res: Response) {
  res.json({ repos: [] });
}

export async function createPR(req: Request, res: Response) {
  res.json({ message: "Pull request created", pr: req.body });
}
