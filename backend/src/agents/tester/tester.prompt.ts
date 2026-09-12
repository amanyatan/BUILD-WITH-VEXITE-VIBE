import { getTesterSystemPrompt } from "./tester.knowledge";

export function buildTesterPrompt(generatedFiles: string): { system: string; user: string } {
  return {
    system: getTesterSystemPrompt(generatedFiles),
    user: `Validate these generated website files:\n\n${generatedFiles}`,
  };
}
