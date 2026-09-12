import { generateText } from "./provider";

export async function generateCode(prompt: string, language: string) {
  return generateText(
    "You are a precise code-generation assistant. Return only the requested code.",
    `Generate ${language} code for: ${prompt}`
  );
}
