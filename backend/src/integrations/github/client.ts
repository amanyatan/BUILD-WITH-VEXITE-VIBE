import { Octokit } from "@octokit/rest";
import { config } from "../../config";

export const githubClient = new Octokit({ auth: config.githubAccessToken });
