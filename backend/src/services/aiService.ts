import { generateText } from "../ai/provider";

export async function generateContent(prompt: string) {
  return generateText("You are a helpful Vibe AI assistant.", prompt);
}
