import { Request, Response } from "express";
import { transcribeAudio, synthesizeText } from "../voice/voiceService";

export async function transcribe(req: Request, res: Response) {
  try {
    const { audio } = req.body;
    if (!audio) {
      return res.status(400).json({ error: "Audio data required" });
    }

    const audioBuffer = Buffer.from(audio, "base64");
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
