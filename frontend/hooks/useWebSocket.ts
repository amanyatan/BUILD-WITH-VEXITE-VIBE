"use client";
import { useRef, useState, useCallback, useEffect } from "react";

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
const captureWorkletSource = `
class VibePcmCapture extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;
    const ratio = sampleRate / 16000;
    const outputLength = Math.max(1, Math.floor(input.length / ratio));
    const pcm = new Int16Array(outputLength);
    for (let i = 0; i < outputLength; i += 1) {
      const sample = input[Math.min(input.length - 1, Math.floor(i * ratio))];
      pcm[i] = Math.max(-1, Math.min(1, sample)) * 0x7fff;
    }
    this.port.postMessage(pcm.buffer, [pcm.buffer]);
    return true;
  }
}
registerProcessor("vibe-pcm-capture", VibePcmCapture);
`;

function encodeBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

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
  const microphoneRef = useRef<MediaStream | null>(null);
  const captureContextRef = useRef<AudioContext | null>(null);
  const captureSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const captureNodeRef = useRef<AudioWorkletNode | null>(null);
  const captureGainRef = useRef<GainNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
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
  const [audioQueue, setAudioQueue] = useState<Array<{ base64: string; mimeType: string }>>([]);
  const isPlayingRef = useRef(false);

  const stopMicrophone = useCallback(() => {
    captureNodeRef.current?.disconnect();
    captureSourceRef.current?.disconnect();
    captureGainRef.current?.disconnect();
    microphoneRef.current?.getTracks().forEach((track) => track.stop());
    void captureContextRef.current?.close();
    captureNodeRef.current = null;
    captureSourceRef.current = null;
    captureGainRef.current = null;
    microphoneRef.current = null;
    captureContextRef.current = null;
  }, []);

  const startSession = useCallback(async () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    if (connecting) return;

    setConnecting(true);
    setAudioError(null);
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000/ws/conversation";
    console.log(`[WS] Connecting to ${wsUrl}...`);
    try {
      const microphone = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const captureContext = new AudioContext();
      const workletUrl = URL.createObjectURL(new Blob([captureWorkletSource], { type: "application/javascript" }));
      await captureContext.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      microphoneRef.current = microphone;
      captureContextRef.current = captureContext;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WS] Connected, sending start_session");
        ws.send(JSON.stringify({ type: "start_session", projectId }));
        const source = captureContext.createMediaStreamSource(microphone);
        const capture = new AudioWorkletNode(captureContext, "vibe-pcm-capture");
        const silentGain = captureContext.createGain();
        silentGain.gain.value = 0;
        capture.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "audio_chunk", audio: encodeBase64(event.data), mimeType: "audio/pcm;rate=16000" }));
          }
        };
        source.connect(capture);
        capture.connect(silentGain);
        silentGain.connect(captureContext.destination);
        captureSourceRef.current = source;
        captureNodeRef.current = capture;
        captureGainRef.current = silentGain;
      };

      ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[WS] Received:", data.type);

        if (data.type === "live_ready") {
          setConnected(true);
          setConnecting(false);
          ws.send(JSON.stringify({
            type: "text_message",
            text: "Greet the user briefly in spoken audio and ask what they would like to build.",
          }));
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
      stopMicrophone();
      setConnected(false);
      setConnecting(false);
      };
      ws.onerror = (event) => {
      console.error("[WS] WebSocket error:", event);
      stopMicrophone();
      setConnected(false);
      setConnecting(false);
      };
    } catch (error) {
      stopMicrophone();
      setConnecting(false);
      setAudioError(error instanceof Error ? error.message : "Microphone access is required.");
    }
  }, [projectId, connecting, stopMicrophone]);

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

  const interrupt = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setAiSpeaking(false);
    isPlayingRef.current = false;
    setAudioQueue([]);
    wsRef.current?.send(JSON.stringify({ type: "interrupt" }));
  }, []);

  const stopSession = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "stop_session" }));
    wsRef.current?.close();
    wsRef.current = null;
    stopMicrophone();
    if (audioRef.current) {
      audioRef.current.pause();
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
  }, [stopMicrophone]);

  function playAudio(base64Data: string, mimeType: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        console.log(`[Audio] Playing audio, mime=${mimeType}, base64 length=${base64Data.length}`);

        if (mimeType.includes("pcm")) {
          playPCM(base64Data, mimeType).then(resolve);
          return;
        }

        // Decode base64 to ArrayBuffer
        const byteString = atob(base64Data);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }

        const blob = new Blob([ab], { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        console.log(`[Audio] Created blob URL: ${url}`);

        const audio = new Audio();
        audio.preload = "auto";
        audioRef.current = audio;

        audio.onloadeddata = () => {
          console.log("[Audio] Audio loaded, attempting play...");
        };

        audio.onended = () => {
          console.log("[Audio] Playback ended");
          URL.revokeObjectURL(url);
          audioRef.current = null;
          resolve();
        };

        audio.onerror = (e) => {
          console.error("[Audio] Audio element error:", e);
          URL.revokeObjectURL(url);
          audioRef.current = null;
          resolve();
        };

        audio.src = url;

        // Try to play - browsers may block autoplay
        const playPromise = audio.play();
        if (playPromise) {
          playPromise.catch((err) => {
            console.warn("[Audio] autoplay blocked, trying on user gesture:", err.message);
            // Autoplay blocked - add one-time click handler to play
            const handler = () => {
              document.removeEventListener("click", handler);
              audio.play().catch((e) => {
                console.error("[Audio] Still can't play after gesture:", e);
                resolve();
              });
            };
            document.addEventListener("click", handler, { once: true });
            // Also try to play after a small delay in case there's already been interaction
            setTimeout(() => {
              audio.play().catch(() => {});
            }, 100);
          });
        }
      } catch (err) {
        console.error("[Audio] playAudio error:", err);
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

        // Decode PCM to float32
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
    startSession,
    sendText,
    interrupt,
    stopSession,
  };
}
