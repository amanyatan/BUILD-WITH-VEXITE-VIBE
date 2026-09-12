"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2, Wifi, WifiOff } from "lucide-react";

type Agent = "developer" | "designer" | "tester";
type Status = "Idle" | "Connecting" | "Listening" | "Speaking" | "Error" | "Disconnected";

const agents: Array<{ id: Agent; label: string; image: string }> = [
  { id: "developer", label: "Developer", image: "/Agentsimages/Developer.png" },
  { id: "designer", label: "Designer", image: "/Agentsimages/Designer.png" },
  { id: "tester", label: "Tester", image: "/Agentsimages/Tester.png" },
];

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

const workletSource = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;
    let level = 0;
    for (let i = 0; i < input.length; i += 1) level += input[i] * input[i];
    level = Math.sqrt(level / input.length);
    const ratio = sampleRate / 16000;
    const outputLength = Math.max(1, Math.floor(input.length / ratio));
    const pcm = new Int16Array(outputLength);
    for (let i = 0; i < outputLength; i += 1) {
      const sample = input[Math.min(input.length - 1, Math.floor(i * ratio))];
      pcm[i] = Math.max(-1, Math.min(1, sample)) * 0x7fff;
    }
    this.port.postMessage({ pcm: pcm.buffer, level }, [pcm.buffer]);
    return true;
  }
}
registerProcessor("pcm-capture-processor", PcmCaptureProcessor);
`;

export function ConversationButton({ onCodeUpdate }: { onCodeUpdate?: (files: Record<string, string>) => void }) {
  const [status, setStatus] = useState<Status>("Idle");
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [error, setError] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const captureRef = useRef<AudioWorkletNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const playbackTimeRef = useRef(0);
  const playbackSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const speakingRef = useRef(false);

  const stopPlayback = useCallback(() => {
    for (const source of playbackSourcesRef.current) {
      try {
        source.stop();
      } catch {
        // The source may have completed between the interruption check and stop.
      }
    }
    playbackSourcesRef.current = [];
    playbackTimeRef.current = 0;
    speakingRef.current = false;
  }, []);

  const stopConversation = useCallback(() => {
    stopPlayback();
    captureRef.current?.disconnect();
    sourceRef.current?.disconnect();
    gainRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    contextRef.current?.close();
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "stop_session" }));
      socketRef.current.close(1000, "Session stopped");
    }
    captureRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    contextRef.current = null;
    socketRef.current = null;
    setStatus("Disconnected");
  }, [stopPlayback]);

  const playPcm = useCallback((encoded: string) => {
    const context = contextRef.current;
    if (!context) return;
    const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    const samples = new Int16Array(bytes.buffer);
    const audio = context.createBuffer(1, samples.length, 24000);
    const channel = audio.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) channel[index] = samples[index] / 0x7fff;
    const source = context.createBufferSource();
    source.buffer = audio;
    source.connect(context.destination);
    const start = Math.max(context.currentTime + 0.02, playbackTimeRef.current);
    source.start(start);
    playbackTimeRef.current = start + audio.duration;
    playbackSourcesRef.current.push(source);
    speakingRef.current = true;
    setStatus("Speaking");
    source.onended = () => {
      playbackSourcesRef.current = playbackSourcesRef.current.filter((item) => item !== source);
      if (!playbackSourcesRef.current.length) {
        speakingRef.current = false;
        setStatus("Listening");
      }
    };
  }, []);

  const startConversation = async () => {
    setError("");
    setStatus("Connecting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const context = new AudioContext();
      const workletUrl = URL.createObjectURL(new Blob([workletSource], { type: "application/javascript" }));
      await context.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);
      const socket = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000/ws/conversation");
      streamRef.current = stream;
      contextRef.current = context;
      socketRef.current = socket;
      socket.onopen = () => {
        socket.send(JSON.stringify({ type: "start_session" }));
        const source = context.createMediaStreamSource(stream);
        const capture = new AudioWorkletNode(context, "pcm-capture-processor");
        const gain = context.createGain();
        gain.gain.value = 0;
        capture.port.onmessage = (event: MessageEvent<{ pcm: ArrayBuffer; level: number }>) => {
          if (socket.readyState !== WebSocket.OPEN) return;
          if (event.data.level > 0.035 && speakingRef.current) {
            stopPlayback();
            socket.send(JSON.stringify({ type: "interrupt" }));
          }
          socket.send(JSON.stringify({ type: "audio_chunk", audio: toBase64(event.data.pcm), mimeType: "audio/pcm;rate=16000" }));
        };
        source.connect(capture);
        capture.connect(gain);
        gain.connect(context.destination);
        sourceRef.current = source;
        captureRef.current = capture;
        gainRef.current = gain;
        setStatus("Listening");
      };
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data) as { type: string; agent?: Agent; audio?: string; files?: Record<string, string>; message?: string };
        if (message.type === "agent_selected" && message.agent) setActiveAgent(message.agent);
        if (message.type === "live_ready") setStatus("Listening");
        if (message.type === "audio_response" && message.audio) playPcm(message.audio);
        if (message.type === "code_update" && message.files) onCodeUpdate?.(message.files);
        if (message.type === "interrupted") stopPlayback();
        if (message.type === "error") {
          setError(message.message || "Live conversation failed");
          setStatus("Error");
        }
      };
      socket.onerror = () => {
        setError("Unable to connect to Gemini Live conversation.");
        setStatus("Error");
      };
      socket.onclose = () => {
        if (status !== "Error") setStatus("Disconnected");
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone permission was denied.");
      setStatus("Error");
    }
  };

  useEffect(() => () => stopConversation(), [stopConversation]);

  return (
    <section className="conversation-panel" aria-labelledby="conversation-title">
      <div className="conversation-heading">
        <div>
          <p className="eyebrow">Native audio conversation</p>
          <h2 id="conversation-title">Talk to your Vibe team</h2>
          <p className="conversation-copy">Raw PCM audio travels through one persistent WebSocket. You can interrupt the agent while it speaks.</p>
        </div>
        <span className={`conversation-status status-${status.toLowerCase()}`} role="status">
          {status === "Listening" && <Wifi size={14} />}
          {status === "Disconnected" && <WifiOff size={14} />}
          {status}
        </span>
      </div>
      <div className="agent-cards" aria-label="Conversation agents">
        {agents.map((agent) => (
          <button className={`agent-card ${activeAgent === agent.id ? "agent-card-active" : ""}`} key={agent.id} onClick={() => socketRef.current?.send(JSON.stringify({ type: "select_agent", agent: agent.id }))} type="button">
            <img src={agent.image} alt={`${agent.label} agent`} />
            <strong>{agent.label}</strong>
          </button>
        ))}
      </div>
      <div className="conversation-controls">
        {status === "Idle" || status === "Disconnected" || status === "Error" ? (
          <button className="button button-primary" type="button" onClick={startConversation}><Mic size={17} /> Start Conversation</button>
        ) : (
          <button className="button button-secondary" type="button" onClick={stopConversation}><MicOff size={17} /> Stop Conversation</button>
        )}
        {status === "Speaking" && <Volume2 className="speaking-icon" aria-label="AI is speaking" />}
      </div>
      {error && <p className="conversation-error" role="alert">{error}</p>}
    </section>
  );
}
