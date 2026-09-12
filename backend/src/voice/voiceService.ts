import { config } from "../config";

const agentVoices: Record<string, string> = {
  designer: "priya",
  developer: "rahul",
  tester: "neha",
};

export async function transcribeAudio(audioBuffer: Buffer, mimeType = "audio/wav"): Promise<string> {
  if (!config.groqApiKey) throw new Error("GROQ_API_KEY is not configured");
  const form = new FormData();
  form.append("file", new Blob([audioBuffer], { type: mimeType }), "audio.wav");
  form.append("model", "whisper-large-v3-turbo");
  form.append("response_format", "json");

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.groqApiKey}` },
    body: form,
  });
  const data = (await response.json()) as { text?: string; error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message || `Transcription failed with status ${response.status}`);
  return data.text || "";
}

export async function synthesizeText(
  text: string,
  agent: "designer" | "developer" | "tester" = "designer"
): Promise<string> {
  if (!config.sarvamApiKey) throw new Error("SARVAM_API_KEY is not configured");
  if (!text?.trim()) return "";

  const speaker = agentVoices[agent] || "shubh";
  const truncated = text.substring(0, 2500);

  const response = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": config.sarvamApiKey,
    },
    body: JSON.stringify({
      text: truncated,
      language_code: config.sarvamLanguage || "en-IN",
      speaker,
      model: "bulbul:v3",
      output_audio_codec: "wav",
      speech_sample_rate: 24000,
    }),
  });

  const data = (await response.json()) as { audios?: string[]; audio?: string; audio_url?: string; error?: string };
  if (!response.ok) throw new Error(data.error || `Synthesis failed with status ${response.status}`);

  const audio = data.audios?.[0] || data.audio || data.audio_url || "";
  if (!audio) throw new Error("TTS returned no audio");
  return audio;
}

export function getAgentVoice(agent: string): string {
  return agentVoices[agent] || "shubh";
}
