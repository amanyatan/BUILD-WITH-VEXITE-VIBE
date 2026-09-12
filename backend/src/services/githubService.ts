import { Octokit } from "@octokit/rest";
import { config } from "../config";

export function getOctokit() {
  return new Octokit({ auth: config.githubAccessToken });
}

export async function getRepos() {
  const octokit = getOctokit();
  const repos = await octokit.repos.listForAuthenticatedUser();
  return repos.data;
}
