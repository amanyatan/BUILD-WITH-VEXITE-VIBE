"use client";
import { useRef, useState, useCallback } from "react";

interface WorkflowEvent {
  type: string;
  agent?: string;
  message?: { id: string; role: string; content: string; timestamp: string };
  step?: string;
  files?: Array<{ path: string; content: string }>;
  validation?: { status: string; errors: string[]; warnings: string[] };
}

interface AgentStatus {
  designer: "idle" | "thinking" | "speaking" | "working";
  developer: "idle" | "thinking" | "speaking" | "working";
  tester: "idle" | "thinking" | "speaking" | "working";
}

export function useWebSocket(projectId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({ designer: "idle", developer: "idle", tester: "idle" });
  const [currentStep, setCurrentStep] = useState("");
  const [generatedFiles, setGeneratedFiles] = useState<Record<string, string>>({});
  const [validationResult, setValidationResult] = useState<WorkflowEvent["validation"] | null>(null);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

  const startSession = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    if (connecting) return;

    setConnecting(true);
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000/ws/conversation";
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "start_session", projectId }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "live_ready") {
          setConnected(true);
          setConnecting(false);
        }

        if (data.type === "workflow_event") {
          const wfEvent = data.event as WorkflowEvent;
          setEvents((prev) => [...prev, wfEvent]);
          if (wfEvent.type === "agent_thinking" && wfEvent.agent) setAgentStatus((p) => ({ ...p, [wfEvent.agent!]: "thinking" }));
          if (wfEvent.type === "agent_speaking" && wfEvent.agent) setAgentStatus((p) => ({ ...p, [wfEvent.agent!]: "speaking" }));
          if (wfEvent.type === "agent_message" && wfEvent.agent) setAgentStatus((p) => ({ ...p, [wfEvent.agent!]: "idle" }));
          if (wfEvent.type === "workflow_step" && wfEvent.step) setCurrentStep(wfEvent.step);
          if (wfEvent.type === "code_update" && wfEvent.files) {
            const m: Record<string, string> = {};
            wfEvent.files.forEach((f) => { m[f.path] = f.content; });
            setGeneratedFiles((prev) => ({ ...prev, ...m }));
          }
          if (wfEvent.type === "validation_update" && wfEvent.validation) setValidationResult(wfEvent.validation);
        }

        if (data.type === "code_update" && data.files) {
          setGeneratedFiles((prev) => ({ ...prev, ...data.files }));
        }

        if (data.type === "audio_response" && data.audio) {
          setAiSpeaking(true);
          playBase64Audio(data.audio, data.audioMimeType || "audio/wav").finally(() => setAiSpeaking(false));
        }

        if (data.type === "text_response" && data.text) {
          setEvents((prev) => [...prev, {
            type: "text_response",
            message: { id: `ai-${Date.now()}`, role: "designer", content: data.text, timestamp: new Date().toISOString() },
          }]);
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      setConnected(false);
      setConnecting(false);
    };
    ws.onerror = () => {
      setConnected(false);
      setConnecting(false);
    };
  }, [projectId, connecting]);

  const sendText = useCallback(async (text: string) => {
    setAiThinking(true);
    setEvents((prev) => [...prev, {
      type: "user_message",
      message: { id: `user-${Date.now()}`, role: "user", content: text, timestamp: new Date().toISOString() },
    }]);

    try {
      const res = await fetch(`${apiUrl}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chat failed");

      setEvents((prev) => [...prev, {
        type: "text_response",
        message: { id: `ai-${Date.now()}`, role: data.agent || "designer", content: data.text, timestamp: new Date().toISOString() },
      }]);

      if (data.audio) {
        setAiSpeaking(true);
        playBase64Audio(data.audio, data.audioMimeType || "audio/wav").finally(() => setAiSpeaking(false));
      }
    } catch (err) {
      setEvents((prev) => [...prev, {
        type: "text_response",
        message: { id: `err-${Date.now()}`, role: "designer", content: `Error: ${err instanceof Error ? err.message : "Failed"}`, timestamp: new Date().toISOString() },
      }]);
    } finally {
      setAiThinking(false);
    }
  }, [projectId, apiUrl]);

  const sendAudio = useCallback(async (base64PCM: string) => {
    setAiThinking(true);
    setEvents((prev) => [...prev, {
      type: "user_message",
      message: { id: `user-${Date.now()}`, role: "user", content: "🎤 Speaking…", timestamp: new Date().toISOString() },
    }]);

    try {
      const transRes = await fetch(`${apiUrl}/voice/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64PCM, mimeType: "audio/pcm;rate=16000" }),
      });
      const transData = await transRes.json();
      if (!transRes.ok) throw new Error(transData.error || "Transcription failed");

      const transcript = transData.transcript;
      if (!transcript?.trim()) {
        setAiThinking(false);
        return;
      }

      setEvents((prev) => {
        const filtered = prev.filter((e) => e.message?.content !== "🎤 Speaking…");
        return [...filtered, {
          type: "user_message",
          message: { id: `user-${Date.now()}`, role: "user", content: transcript, timestamp: new Date().toISOString() },
        }];
      });

      const chatRes = await fetch(`${apiUrl}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: transcript, projectId }),
      });
      const chatData = await chatRes.json();
      if (!chatRes.ok) throw new Error(chatData.error || "Chat failed");

      setEvents((prev) => [...prev, {
        type: "text_response",
        message: { id: `ai-${Date.now()}`, role: chatData.agent || "designer", content: chatData.text, timestamp: new Date().toISOString() },
      }]);

      if (chatData.audio) {
        setAiSpeaking(true);
        playBase64Audio(chatData.audio, chatData.audioMimeType || "audio/wav").finally(() => setAiSpeaking(false));
      }
    } catch (err) {
      setEvents((prev) => [...prev, {
        type: "text_response",
        message: { id: `err-${Date.now()}`, role: "designer", content: `Error: ${err instanceof Error ? err.message : "Failed"}`, timestamp: new Date().toISOString() },
      }]);
    } finally {
      setAiThinking(false);
    }
  }, [projectId, apiUrl]);

  const interrupt = useCallback(() => {
    setAiSpeaking(false);
  }, []);

  const stopSession = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
    setConnecting(false);
    setEvents([]);
    setAgentStatus({ designer: "idle", developer: "idle", tester: "idle" });
    setCurrentStep("");
    setGeneratedFiles({});
    setValidationResult(null);
    setAiSpeaking(false);
    setAiThinking(false);
  }, []);

  async function playBase64Audio(base64Data: string, mimeType: string): Promise<void> {
    try {
      const byteString = atob(base64Data);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);

      let blob: Blob;
      if (mimeType.includes("wav")) {
        blob = new Blob([ab], { type: "audio/wav" });
      } else if (mimeType.includes("pcm")) {
        const rateMatch = mimeType.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;
        const raw = new Int16Array(ab);
        const float32 = new Float32Array(raw.length);
        for (let i = 0; i < raw.length; i++) float32[i] = raw[i] / 32768.0;
        const ctx = audioCtxRef.current || new AudioContext({ sampleRate });
        audioCtxRef.current = ctx;
        const buffer = ctx.createBuffer(1, float32.length, sampleRate);
        buffer.getChannelData(0).set(float32);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        return new Promise((resolve) => {
          source.onended = () => resolve();
          source.start();
        });
      } else {
        blob = new Blob([ab], { type: mimeType });
      }

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      return new Promise((resolve) => {
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        audio.play().catch(() => resolve());
      });
    } catch {
      // ignore
    }
  }

  return { connected, connecting, events, agentStatus, currentStep, generatedFiles, validationResult, aiSpeaking, aiThinking, startSession, sendText, sendAudio, interrupt, stopSession };
}
