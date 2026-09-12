"use client";
import { useState, useRef, useCallback } from "react";

export function useVoice() {
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playAgentVoice = useCallback(async (text: string, agent: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/voice/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, agent }),
      });

      const data = await response.json();
      if (data.audioUrl) {
        const audio = new Audio(data.audioUrl);
        audioRef.current = audio;
        setPlaying(agent);

        audio.onended = () => setPlaying(null);
        audio.onerror = () => setPlaying(null);

        await audio.play();
      }
    } catch (err) {
      console.error("Voice synthesis failed:", err);
      setPlaying(null);
    }
  }, []);

  const stopVoice = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(null);
  }, []);

  return { playing, playAgentVoice, stopVoice };
}
