"use client";
import { Suspense, useMemo, useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Send, Mic, MicOff, RefreshCw, Play, Square, Volume2, Loader2, MessageSquare, Phone, PhoneOff } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAppStore } from "@/store";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function WorkspacePage() {
  return <Suspense fallback={<div style={{ padding: 40 }}>Loading workspace…</div>}><WorkspaceContent /></Suspense>;
}

function WorkspaceContent() {
  const params = useSearchParams();
  const projectId = params.get("id") || "";
  const projects = useAppStore((s) => s.projects);
  const project = projects.find((p) => p.id === projectId);
  const files = useAppStore((s) => s.files);
  const setFile = useAppStore((s) => s.setFile);
  const [activeFile, setActiveFile] = useState("index.html");
  const [prompt, setPrompt] = useState("");
  const [previewKey, setPreviewKey] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Int16Array[]>([]);

  const { connected, connecting, events, agentStatus, currentStep, generatedFiles, validationResult, aiSpeaking, aiThinking, startSession, sendText, sendAudio, interrupt, stopSession } = useWebSocket(projectId);

  const messages = events.filter((e) => e.type === "agent_message" || e.type === "user_message" || e.type === "workflow_step" || e.type === "text_response");

  const srcDoc = useMemo(() => {
    const html = generatedFiles["index.html"] || files["index.html"];
    const css = generatedFiles["style.css"] || files["style.css"];
    const js = generatedFiles["script.js"] || files["script.js"];
    if (!html && !css && !js) return "";
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body>${html}<script>${js}<\/script></body></html>`;
  }, [files, generatedFiles]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  function handleStartConversation() {
    setSessionStarted(true);
    startSession();
  }

  function handleEndConversation() {
    stopSession();
    setSessionStarted(false);
    setIsRecording(false);
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    recordedChunksRef.current = [];
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || !sessionStarted) return;
    sendText(prompt.trim());
    setPrompt("");
  }

  async function toggleRecording() {
    if (isRecording) {
      processorRef.current?.disconnect();
      processorRef.current = null;
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      setIsRecording(false);

      if (recordedChunksRef.current.length > 0) {
        const totalLen = recordedChunksRef.current.reduce((sum, c) => sum + c.length, 0);
        const merged = new Int16Array(totalLen);
        let offset = 0;
        for (const chunk of recordedChunksRef.current) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }
        recordedChunksRef.current = [];

        let binary = "";
        const bytes = new Uint8Array(merged.buffer);
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        sendAudio(btoa(binary));
      }
      return;
    }
    try {
      recordedChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 } });
      mediaStreamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        recordedChunksRef.current.push(new Int16Array(int16));
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone error:", err);
    }
  }

  const agentCards = [
    { key: "designer" as const, name: "Designer", image: "/Agentsimages/Designer.png", color: "#6d5dfc" },
    { key: "developer" as const, name: "Developer", image: "/Agentsimages/Developer.png", color: "#20a36f" },
    { key: "tester" as const, name: "Tester", image: "/Agentsimages/Tester.png", color: "#e67e22" },
  ];

  return (
    <AppShell title={project?.name || "Vibe Workspace"}>
      <div className="workspace-page">
        <section className="chat-panel">
          <div className="workspace-title">
            <div>
              <h1>{project?.name || "New Project"}</h1>
              <small>AI workspace · {Object.keys(generatedFiles).length} files</small>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="agent-pill">
                <span style={{ display: "inline-block", width: 5, height: 5, background: connected ? "#20a36f" : "#e74c3c", borderRadius: "50%", marginRight: 4 }} />
                {connected ? "Live" : "Connecting…"}
              </span>
              {aiSpeaking && <Volume2 size={14} color="#6d5dfc" style={{ animation: "spin 1s linear infinite" }} />}
              {sessionStarted && (
                <button className="button button-danger" onClick={handleEndConversation} style={{ padding: "4px 10px", fontSize: 11 }}>
                  <PhoneOff size={12} /> End
                </button>
              )}
            </div>
          </div>

          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", display: "flex", gap: 14 }}>
            {agentCards.map((agent) => (
              <div key={agent.key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: agent.color }}>
                <span style={{ fontSize: 10 }}>●</span>
                <span style={{ fontWeight: 700 }}>{agent.name}</span>
                {agentStatus[agent.key] === "thinking" && <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />}
                {agentStatus[agent.key] === "speaking" && <Volume2 size={11} />}
              </div>
            ))}
          </div>

          <div className="messages">
            {!sessionStarted && (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 24 }}>
                  {agentCards.map((agent) => (
                    <div key={agent.key} style={{ textAlign: "center" }}>
                      <div style={{ width: 64, height: 64, borderRadius: 16, overflow: "hidden", border: `2px solid ${agent.color}`, position: "relative" }}>
                        <Image src={agent.image} alt={agent.name} fill style={{ objectFit: "cover" }} />
                      </div>
                      <p style={{ fontSize: 11, marginTop: 6, color: agent.color, fontWeight: 700 }}>{agent.name}</p>
                    </div>
                  ))}
                </div>
                <h2 style={{ fontSize: 20, margin: "0 0 8px", letterSpacing: "-0.03em" }}>Ready to build?</h2>
                <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20, maxWidth: 320, margin: "0 auto 20px" }}>
                  Start a conversation with your AI team. Describe what you want to build and watch it come to life.
                </p>
                <button
                  className="button button-primary"
                  onClick={handleStartConversation}
                  disabled={connecting}
                  style={{ padding: "12px 28px", fontSize: 14 }}
                >
                  {connecting ? <Loader2 size={16} className="animate-spin" /> : <Phone size={16} />} {connecting ? "Connecting…" : "Start Conversation"}
                </button>
                {connecting && (
                  <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 8 }}>Connecting to AI…</p>
                )}
              </div>
            )}

            {sessionStarted && messages.length === 0 && !aiThinking && (
              <div style={{ textAlign: "center", padding: "30px 20px" }}>
                <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 4 }}>Conversation started!</p>
                <p style={{ color: "var(--muted)", fontSize: 12 }}>Try: &ldquo;Build a tic-tac-toe game for me&rdquo;</p>
              </div>
            )}

            {aiThinking && (
              <div style={{ textAlign: "center", padding: "10px 0" }}>
                <span style={{ fontSize: 12, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Loader2 size={12} className="animate-spin" /> Vibe is thinking…
                </span>
              </div>
            )}

            {messages.map((event, i) => {
              if (event.type === "workflow_step") {
                const labels: Record<string, string> = {
                  design: "Designer is designing",
                  develop: "Developer is coding",
                  test: "Tester is validating",
                  fix: "Developer is fixing",
                  complete: "Done!",
                };
                return (
                  <div key={i} style={{ textAlign: "center", padding: "5px 0" }}>
                    <span style={{ fontSize: 11, color: "var(--muted)", background: "var(--line)", padding: "3px 10px", borderRadius: 99 }}>
                      {labels[event.step || ""] || event.step}
                    </span>
                  </div>
                );
              }

              if (event.type === "text_response" && event.message) {
                return (
                  <div key={i} className="message agent" style={{ borderLeft: "3px solid #6d5dfc" }}>
                    <small style={{ color: "#6d5dfc" }}>vibe</small>
                    {event.message.content}
                  </div>
                );
              }

              if (event.type === "agent_message" && event.message) {
                const role = event.message.role;
                const colors: Record<string, string> = { designer: "#6d5dfc", developer: "#20a36f", tester: "#e67e22", user: "#697386" };
                let text = event.message.content;
                try {
                  const parsed = JSON.parse(text);
                  if (role === "developer" && parsed.files) text = `Generated: ${parsed.files.map((f: { path: string }) => f.path).join(", ")}`;
                  else if (role === "tester" && parsed.status) text = `Validation: ${parsed.status}. ${parsed.errors?.length || 0} errors.`;
                } catch { /* use raw */ }

                return (
                  <div key={i} className={`message ${role === "user" ? "user" : "agent"}`} style={role !== "user" ? { borderLeft: `3px solid ${colors[role] || "#999"}` } : {}}>
                    {role !== "user" && <small style={{ color: colors[role] }}>{role}</small>}
                    {text}
                  </div>
                );
              }
              return null;
            })}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-form" onSubmit={handleSend}>
            {sessionStarted && (
              <button type="button" className="icon-button" onClick={toggleRecording} aria-label={isRecording ? "Stop" : "Voice"}>
                {isRecording ? <MicOff size={15} color="#e74c3c" /> : <Mic size={15} />}
              </button>
            )}
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={!sessionStarted ? "Start a conversation first…" : "Type or use mic…"}
              disabled={!sessionStarted || !connected}
            />
            {aiSpeaking ? (
              <button type="button" className="button button-primary" onClick={interrupt} style={{ background: "#e74c3c" }}>
                <Square size={14} />
              </button>
            ) : (
              <button className="button button-primary" type="submit" disabled={!sessionStarted || !prompt.trim() || !connected}>
                <Send size={14} />
              </button>
            )}
          </form>
        </section>

        <section className="preview-panel">
          <div className="preview-toolbar">
            <span>
              Live preview
              {validationResult && (
                <span className={`status ${validationResult.status === "passed" ? "status-ready" : "status-draft"}`} style={{ marginLeft: 7 }}>
                  {validationResult.status === "passed" ? "✓ Passed" : validationResult.status === "failed" ? "✗ Failed" : "⚠ Warnings"}
                </span>
              )}
            </span>
            <div style={{ display: "flex", gap: 3 }}>
              <button className="icon-button" onClick={() => setPreviewKey((k) => k + 1)}><RefreshCw size={15} /></button>
              <button className="button button-secondary" onClick={() => setPreviewKey((k) => k + 1)}><Play size={13} /> Run</button>
            </div>
          </div>
          <div className="preview-frame">
            {srcDoc ? (
              <iframe key={previewKey} title="Live preview" sandbox="allow-scripts" srcDoc={srcDoc} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--muted)", fontSize: 13 }}>
                <MessageSquare size={16} style={{ marginRight: 8 }} /> Preview will appear here
              </div>
            )}
          </div>
        </section>

        <section className="editor-panel">
          <div className="editor-tabs">
            {(["index.html", "style.css", "script.js"] as const).map((file) => (
              <button key={file} className={`editor-tab ${activeFile === file ? "active" : ""}`} onClick={() => setActiveFile(file)}>
                {file}
              </button>
            ))}
          </div>
          <div className="editor-content">
            <textarea
              value={generatedFiles[activeFile] || files[activeFile] || ""}
              onChange={(e) => setFile(activeFile, e.target.value)}
              spellCheck={false}
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
