import { config } from "../config";
import { AgentName } from "./agent-router.service";

const voices: Record<AgentName, string> = {
  developer: "arvind",
  designer: "meera",
  tester: "aditi",
};

export async function synthesizeSpeech(
  text: string,
  agent: AgentName
): Promise<{ audio: string; mimeType: string }> {
  if (!config.sarvamApiKey) throw new Error("SARVAM_API_KEY is not configured");

  const response = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.sarvamApiKey}`,
    },
    body: JSON.stringify({
      text,
      model: "bulbul:v1",
      voice: { name: voices[agent] },
      language: { sourceLanguage: config.sarvamLanguage },
    }),
  });
  const data = (await response.json()) as {
    audio?: string;
    audios?: string[];
    audio_url?: string;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error || `Text-to-speech failed with status ${response.status}`);
  }
  const audio = data.audio || data.audios?.[0] || data.audio_url;
  if (!audio) throw new Error("Text-to-speech returned no audio");
  return { audio, mimeType: "audio/wav" };
}
