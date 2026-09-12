import { Request, Response } from "express";
import { transcribeAudio, synthesizeText } from "../voice/voiceService";

function pcmToWav(pcmBuffer: Buffer, sampleRate = 16000, channels = 1, bitsPerSample = 16): Buffer<ArrayBuffer> {
  const dataLength = pcmBuffer.length;
  const headerLength = 44;
  const totalLength = headerLength + dataLength;
  const buffer = Buffer.alloc(totalLength);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(totalLength - 8, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28);
  buffer.writeUInt16LE(channels * bitsPerSample / 8, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataLength, 40);
  pcmBuffer.copy(buffer, headerLength);

  return buffer;
}

export async function transcribe(req: Request, res: Response) {
  try {
    const { audio, mimeType } = req.body;
    if (!audio) {
      return res.status(400).json({ error: "Audio data required" });
    }

    let audioBuffer: Buffer<ArrayBuffer> = Buffer.from(audio, "base64") as Buffer<ArrayBuffer>;

    if (mimeType?.includes("pcm")) {
      const rateMatch = mimeType.match(/rate=(\d+)/);
      const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 16000;
      audioBuffer = pcmToWav(audioBuffer, sampleRate);
    }

    const transcript = await transcribeAudio(audioBuffer);
    res.json({ transcript });
  } catch (err) {
    console.error("Transcription error:", err);
    res.status(500).json({ error: "Transcription failed" });
  }
}

export async function synthesize(req: Request, res: Response) {
  try {
    const { text, agent } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text required" });
    }

    const audioUrl = await synthesizeText(text, agent || "designer");
    res.json({ audioUrl });
  } catch (err) {
    console.error("Synthesis error:", err);
    res.status(500).json({ error: "Synthesis failed" });
  }
}
