"use client";
import { useEffect, useRef, useState, useCallback } from "react";

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
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({ designer: "idle", developer: "idle", tester: "idle" });
  const [currentStep, setCurrentStep] = useState("");
  const [generatedFiles, setGeneratedFiles] = useState<Record<string, string>>({});
  const [validationResult, setValidationResult] = useState<WorkflowEvent["validation"] | null>(null);
  const [aiSpeaking, setAiSpeaking] = useState(false);

  useEffect(() => {
    if (!projectId) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000/ws/conversation";
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: "start_session", projectId }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "session_started") {
          // waiting for live_ready
        }

        if (data.type === "live_ready") {
          setConnected(true);
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
            setGeneratedFiles(m);
          }
          if (wfEvent.type === "validation_update" && wfEvent.validation) setValidationResult(wfEvent.validation);
        }

        if (data.type === "code_update" && data.files) {
          setGeneratedFiles(data.files);
        }

        if (data.type === "input_transcript" && data.text) {
          setEvents((prev) => [...prev, {
            type: "user_message",
            message: { id: `user-${Date.now()}`, role: "user", content: data.text, timestamp: new Date().toISOString() },
          }]);
        }

        if (data.type === "output_transcript" && data.text) {
          setEvents((prev) => [...prev, {
            type: "agent_message",
            message: { id: `ai-${Date.now()}`, role: "designer", content: data.text, timestamp: new Date().toISOString() },
          }]);
        }

        if (data.type === "text_response" && data.text) {
          setEvents((prev) => [...prev, {
            type: "agent_message",
            message: { id: `ai-${Date.now()}`, role: "designer", content: data.text, timestamp: new Date().toISOString() },
          }]);
        }

        if (data.type === "audio_response" && data.audio) {
          setAiSpeaking(true);
          playAudioPCM(data.audio, data.mimeType || "audio/pcm;rate=24000").finally(() => setAiSpeaking(false));
        }

        if (data.type === "turn_complete") {
          setAiSpeaking(false);
        }

        if (data.type === "interrupted") {
          setAiSpeaking(false);
        }

        if (data.type === "error") {
          console.error("WS error:", data.message);
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    return () => { ws.close(); };
  }, [projectId]);

  const sendText = useCallback((text: string) => {
    wsRef.current?.send(JSON.stringify({ type: "text_message", text }));
  }, []);

  const sendAudio = useCallback((base64PCM: string) => {
    wsRef.current?.send(JSON.stringify({ type: "audio_chunk", audio: base64PCM }));
  }, []);

  const interrupt = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "interrupt" }));
  }, []);

  const stopSession = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "stop_session" }));
  }, []);

  function playAudioPCM(base64Data: string, mimeType: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        const rateMatch = mimeType.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;

        const raw = atob(base64Data);
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

        const int16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
          float32[i] = int16[i] / 32768.0;
        }

        const ctx = audioCtxRef.current || new AudioContext({ sampleRate });
        audioCtxRef.current = ctx;

        const buffer = ctx.createBuffer(1, float32.length, sampleRate);
        buffer.getChannelData(0).set(float32);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => resolve();
        source.start();
      } catch {
        resolve();
      }
    });
  }

  return { connected, events, agentStatus, currentStep, generatedFiles, validationResult, aiSpeaking, sendText, sendAudio, interrupt, stopSession };
}
