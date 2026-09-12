import { config } from "../config";
import { AgentName } from "./agent-router.service";

const voices: Record<AgentName, string> = {
  developer: "rahul",
  designer: "priya",
  tester: "neha",
};

export async function synthesizeSpeech(
  text: string,
  agent: AgentName
): Promise<{ audio: string; mimeType: string }> {
  if (!config.sarvamApiKey) throw new Error("SARVAM_API_KEY is not configured");
  if (!text?.trim()) throw new Error("No text to synthesize");

  const truncated = text.substring(0, 2500);
  const speaker = voices[agent] || "shubh";
  console.log(`[TTS] agent=${agent}, speaker=${speaker}, text="${truncated.substring(0, 60)}..."`);

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

  const rawText = await response.text();
  console.log(`[TTS] status=${response.status}, body_len=${rawText.length}`);

  if (!response.ok) {
    console.error(`[TTS] API error:`, rawText.substring(0, 500));
    throw new Error(`TTS ${response.status}: ${rawText.substring(0, 200)}`);
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`TTS returned non-JSON: ${rawText.substring(0, 200)}`);
  }

  console.log(`[TTS] Response keys: ${Object.keys(data).join(", ")}`);

  // New API returns { audios: ["base64..."] }
  const audios = data.audios as string[] | undefined;
  const audio = audios?.[0] || (data.audio as string) || (data.audio_url as string);

  if (!audio) {
    console.error(`[TTS] No audio in response:`, JSON.stringify(data).substring(0, 500));
    throw new Error("TTS returned no audio data");
  }

  console.log(`[TTS] Got audio, base64 length=${audio.length}`);
  return { audio, mimeType: "audio/wav" };
}
