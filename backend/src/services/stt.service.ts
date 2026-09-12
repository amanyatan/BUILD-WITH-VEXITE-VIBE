import { config } from "../config";

export async function transcribeAudio(audio: Buffer, mimeType = "audio/wav"): Promise<string> {
  if (!config.groqApiKey) throw new Error("GROQ_API_KEY is not configured");
  const form = new FormData();
  form.append("file", new Blob([audio], { type: mimeType }), "audio.wav");
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
