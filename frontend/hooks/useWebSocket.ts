"use client";
import { useRef, useState, useCallback, useEffect } from "react";

interface SpeechRecognitionEventLike extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

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

let sharedAudioContext: AudioContext | null = null;
type AudioPlayback = HTMLAudioElement | AudioBufferSourceNode;

function getAudioContext(): AudioContext {
  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new AudioContext({ sampleRate: 24000 });
  }
  if (sharedAudioContext.state === "suspended") {
    sharedAudioContext.resume();
  }
  return sharedAudioContext;
}

export function useWebSocket(projectId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const audioRef = useRef<AudioPlayback | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({ designer: "idle", developer: "idle", tester: "idle" });
  const [currentStep, setCurrentStep] = useState("");
  const [generatedFiles, setGeneratedFiles] = useState<Record<string, string>>({});
  const [validationResult, setValidationResult] = useState<WorkflowEvent["validation"] | null>(null);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [audioQueue, setAudioQueue] = useState<Array<{ base64: string; mimeType: string }>>([]);
  const isPlayingRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningRequestedRef = useRef(false);
  const sendTextRef = useRef<(text: string) => void>(() => undefined);

  const startSession = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    if (connecting) return;

    setConnecting(true);
    setAudioError(null);
    void getAudioContext().resume().catch((error) => {
      console.warn("[Audio] Could not unlock audio:", error);
    });
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000/ws/conversation";
    console.log(`[WS] Connecting to ${wsUrl}...`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected, sending start_session");
      ws.send(JSON.stringify({ type: "start_session", projectId }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[WS] Received:", data.type);

        if (data.type === "live_ready") {
          setConnected(true);
          setConnecting(false);
          console.log("[WS] Session ready");
        }

        if (data.type === "session_started") {
          console.log("[WS] Session started:", data.sessionId);
        }

        if (data.type === "ai_thinking") {
          setAiThinking(true);
        }

        if (data.type === "text_response" && data.text) {
          setAiThinking(false);
          console.log("[WS] Text response:", data.text.substring(0, 80));
          setEvents((prev) => [...prev, {
            type: "text_response",
            message: { id: `ai-${Date.now()}`, role: "vibe", content: data.text, timestamp: new Date().toISOString() },
          }]);
        }

        if (data.type === "audio_response" && data.audio) {
          setAiThinking(false);
          console.log(`[WS] Audio response received, mime=${data.audioMimeType}, length=${data.audio.length}`);
          setAudioError(null);
          queueAudio(data.audio, data.audioMimeType || "audio/wav");
        }

        if (data.type === "audio_error") {
          console.error("[WS] Audio error from server:", data.message);
          setAudioError(data.message);
          setAiSpeaking(false);
        }

        if (data.type === "error") {
          setAiThinking(false);
          console.error("[WS] Error:", data.message);
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
      } catch (e) {
        console.error("[WS] Parse error:", e);
      }
    };

    ws.onclose = (event) => {
      console.log("[WS] Closed:", event.code, event.reason);
      setConnected(false);
      setConnecting(false);
    };
    ws.onerror = (event) => {
      console.error("[WS] WebSocket error:", event);
      setConnected(false);
      setConnecting(false);
    };
  }, [projectId, connecting]);

  function queueAudio(base64: string, mimeType: string) {
    setAudioQueue((prev) => [...prev, { base64, mimeType }]);
  }

  useEffect(() => {
    if (audioQueue.length === 0 || isPlayingRef.current) return;
    const next = audioQueue[0];
    setAudioQueue((prev) => prev.slice(1));
    isPlayingRef.current = true;
    setAiSpeaking(true);
    playAudio(next.base64, next.mimeType).then(() => {
      isPlayingRef.current = false;
      setAiSpeaking(false);
    });
  }, [audioQueue]);

  const sendText = useCallback((text: string) => {
    setEvents((prev) => [...prev, {
      type: "user_message",
      message: { id: `user-${Date.now()}`, role: "user", content: text, timestamp: new Date().toISOString() },
    }]);
    wsRef.current?.send(JSON.stringify({ type: "text_message", text }));
  }, []);
  sendTextRef.current = sendText;

  useEffect(() => {
    setSpeechSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  const stopListening = useCallback(() => {
    listeningRequestedRef.current = false;
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setAudioError("Speech input is not supported in this browser. Use Chrome or Edge.");
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "en-IN";
      recognition.onresult = (event) => {
        const last = event.results[event.results.length - 1];
        const transcript = last?.[0]?.transcript?.trim();
        if (transcript && last.isFinal) {
          sendTextRef.current(transcript);
        }
      };
      recognition.onerror = (event) => {
        if (event.error !== "aborted" && event.error !== "no-speech") {
          setAudioError(`Microphone error: ${event.error}`);
        }
        setListening(false);
      };
      recognition.onend = () => {
        setListening(false);
        if (listeningRequestedRef.current && !isPlayingRef.current) {
          try {
            recognition.start();
            setListening(true);
          } catch {
            // The browser can reject a restart while it is still closing.
          }
        }
      };
      recognitionRef.current = recognition;
    }

    listeningRequestedRef.current = true;
    setAudioError(null);
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch {
      setAudioError("Microphone is already active or permission was denied.");
    }
  }, []);

  const interrupt = useCallback(() => {
    if (audioRef.current) {
      if (audioRef.current instanceof AudioBufferSourceNode) audioRef.current.stop();
      else audioRef.current.pause();
      audioRef.current = null;
    }
    setAiSpeaking(false);
    isPlayingRef.current = false;
    setAudioQueue([]);
    wsRef.current?.send(JSON.stringify({ type: "interrupt" }));
  }, []);

  const stopSession = useCallback(() => {
    stopListening();
    wsRef.current?.send(JSON.stringify({ type: "stop_session" }));
    wsRef.current?.close();
    wsRef.current = null;
    if (audioRef.current) {
      if (audioRef.current instanceof AudioBufferSourceNode) audioRef.current.stop();
      else audioRef.current.pause();
      audioRef.current = null;
    }
    isPlayingRef.current = false;
    setAudioQueue([]);
    setConnected(false);
    setConnecting(false);
    setEvents([]);
    setAgentStatus({ designer: "idle", developer: "idle", tester: "idle" });
    setCurrentStep("");
    setGeneratedFiles({});
    setValidationResult(null);
    setAiSpeaking(false);
    setAiThinking(false);
    setAudioError(null);
  }, [stopListening]);

  function playAudio(base64Data: string, mimeType: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        console.log(`[Audio] Playing audio, mime=${mimeType}, base64 length=${base64Data.length}`);

        if (mimeType.includes("pcm")) {
          playPCM(base64Data, mimeType).then(resolve);
          return;
        }

        const byteString = atob(base64Data);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }

        const ctx = await getAudioContext();
        const audioBuffer = await ctx.decodeAudioData(ab.slice(0));
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => {
          audioRef.current = null;
          if (listeningRequestedRef.current) startListening();
          resolve();
        };
        source.start();
        audioRef.current = source;
      } catch (err) {
        console.error("[Audio] playAudio error:", err);
        setAudioError("The voice response could not be played. Check browser audio permissions.");
        resolve();
      }
    });
  }

  function playPCM(base64Data: string, mimeType: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        const byteString = atob(base64Data);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }

        const rateMatch = mimeType.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;

        const raw = new Int16Array(ab);
        const float32 = new Float32Array(raw.length);
        for (let i = 0; i < raw.length; i++) {
          float32[i] = raw[i] / 32768.0;
        }

        const ctx = getAudioContext();
        const buffer = ctx.createBuffer(1, float32.length, sampleRate);
        buffer.getChannelData(0).set(float32);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);

        source.onended = () => resolve();
        source.start();
      } catch (err) {
        console.error("[Audio] playPCM error:", err);
        resolve();
      }
    });
  }

  return {
    connected,
    connecting,
    events,
    agentStatus,
    currentStep,
    generatedFiles,
    validationResult,
    aiSpeaking,
    aiThinking,
    audioError,
    listening,
    speechSupported,
    startSession,
    startListening,
    stopListening,
    sendText,
    interrupt,
    stopSession,
  };
}
