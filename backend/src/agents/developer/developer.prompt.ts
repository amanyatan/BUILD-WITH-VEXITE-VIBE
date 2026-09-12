import { getDeveloperSystemPrompt } from "./developer.knowledge";

export function buildDeveloperPrompt(designPlan: string): { system: string; user: string } {
  return {
    system: getDeveloperSystemPrompt(designPlan),
    user: `Generate the complete website files based on this design plan:\n\n${designPlan}`,
  };
}

export function buildDeveloperFixPrompt(
  designPlan: string,
  currentFiles: string,
  validationReport: string
): { system: string; user: string } {
  return {
    system: getDeveloperSystemPrompt(designPlan),
    user: `The Tester Agent found issues. Fix the following files:

Current files:
${currentFiles}

Validation report:
${validationReport}

Return the corrected files.`,
  };
}
