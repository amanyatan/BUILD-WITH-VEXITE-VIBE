import { getDesignerSystemPrompt } from "./designer.knowledge";

export function buildDesignerPrompt(userRequest: string): { system: string; user: string } {
  return {
    system: getDesignerSystemPrompt(userRequest),
    user: `Analyze this website idea and create a design plan: "${userRequest}"`,
  };
}

export function buildDesignerClarificationPrompt(
  originalRequest: string,
  question: string,
  userAnswer: string
): { system: string; user: string } {
  return {
    system: getDesignerSystemPrompt(originalRequest),
    user: `I asked: "${question}"
User answered: "${userAnswer}"
Now produce the final design plan.`,
  };
}
