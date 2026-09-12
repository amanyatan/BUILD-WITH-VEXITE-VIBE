import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Sparkles, WandSparkles, Mic, Github, Check } from "lucide-react";
import { LiveLoader } from "@/components/landing/LiveLoader";

export default function Home() {
  return (
    <main style={{ margin: 0, padding: 0 }}>
      <section style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden" }}>
        <Image src="/herosection image.jpg" alt="Hero" fill style={{ objectFit: "cover" }} priority />
        <nav className="landing-nav">
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 24, color: "#fff", letterSpacing: "-0.04em" }}><span style={{ width: 30, height: 30, borderRadius: 9, background: "#6d5dfc", display: "grid", placeItems: "center", color: "#fff", fontSize: 15 }}>V</span>vibe</Link>
          <div className="landing-nav-menu" aria-label="Main navigation">
            <span className="landing-nav-item">Home</span>
            <span className="landing-nav-item">About</span>
            <span className="landing-nav-item">Contact Us</span>
            <span className="landing-nav-item">Docs</span>
          </div>
          <div className="landing-nav-actions">
            <Link href="/login" style={{ color: "#fff", fontSize: 13, fontWeight: 700, background: "#6d5dfc", padding: "8px 16px", borderRadius: 9, textDecoration: "none" }}>Sign in</Link>
          </div>
        </nav>
      </section>

      <section style={{ background: "#172033", padding: "78px 28px", textAlign: "center" }}>
        <div style={{ maxWidth: 1050, margin: "0 auto" }}>
          <div className="eyebrow"><Sparkles size={13} style={{ verticalAlign: "middle" }} /> AI website creation, reimagined</div>
          <h1 style={{ fontSize: "clamp(48px, 8vw, 92px)", lineHeight: .94, letterSpacing: "-.08em", margin: "22px auto", maxWidth: 850 }}>Make the web feel like <span style={{ color: "#6d5dfc" }}>you.</span></h1>
          <p style={{ color: "rgba(255,255,255,.6)", maxWidth: 560, margin: "0 auto", lineHeight: 1.7, fontSize: 17 }}>Describe your idea. Vibe&apos;s design, development, and testing agents turn it into a real website you can ship.</p>
          <Link href="/login" className="button button-primary" style={{ marginTop: 30, padding: "14px 22px" }}>Create your first site <ArrowRight size={16} /></Link>
          <div className="landing-showcase">
          <div className="panel landing-command-panel" style={{ padding: 0, overflow: "hidden", textAlign: "left", background: "#202331", borderRadius: 14, border: "1px solid rgba(255,255,255,.08)", boxShadow: "0 25px 80px #6d5dfc1c" }}>
            <div style={{ background: "#202331", height: 34, display: "flex", alignItems: "center", gap: 5, padding: "0 13px", borderBottom: "1px solid rgba(255,255,255,.08)" }}><i style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff7e89" }} /><i style={{ width: 8, height: 8, borderRadius: "50%", background: "#ffd15c" }} /><i style={{ width: 8, height: 8, borderRadius: "50%", background: "#72d9a8" }} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", minHeight: 300 }}>
              <div style={{ borderRight: "1px solid rgba(255,255,255,.08)", padding: 20, background: "rgba(255,255,255,.03)" }}><small style={{ color: "rgba(255,255,255,.4)" }}>YOUR PROJECT</small><b style={{ display: "block", margin: "12px 0 28px", color: "#fff" }}>Sonder Studio</b><div style={{ display: "grid", gap: 13, color: "rgba(255,255,255,.5)", fontSize: 12 }}><span>✦ Chat with agents</span><span>◈ Live preview</span><span>⌘ Code editor</span></div></div>
              <div style={{ padding: 30, background: "#f7f8fc" }}><small style={{ color: "#6d5dfc", fontWeight: 800 }}>DESIGNER AGENT · DONE</small><h2 style={{ fontSize: 30, margin: "14px 0 8px", letterSpacing: "-.05em", color: "#172033" }}>A calmer way to plan your next trip.</h2><p style={{ color: "#697386", maxWidth: 410, lineHeight: 1.6 }}>Your landing page is ready with a warm palette, editorial typography, and clear booking flow.</p><div style={{ display: "flex", gap: 9, marginTop: 22 }}><span className="status status-ready">✓ Tested</span><span className="status" style={{ background: "#e9e5ff", color: "#5041e6" }}>3 files generated</span></div></div>
            </div>
            <LiveLoader />
            </div>
          </div>
        </div>
      </section>
      <section style={{ background: "#fff", padding: "78px 28px" }}><div style={{ maxWidth: 1050, margin: "0 auto" }}><div className="eyebrow">From thought to live site</div><h2 style={{ fontSize: 38, letterSpacing: "-.06em", margin: "12px 0 35px", color: "#172033" }}>One creative loop.<br />No blank canvas anxiety.</h2><div className="project-grid"><Feature icon={<WandSparkles />} title="Describe it naturally" copy="Talk to Vibe like a collaborator. Text or voice, messy ideas welcome." /><Feature icon={<Sparkles />} title="Three agents, one flow" copy="Designer, Developer, and Tester agents work together to make the details click." /><Feature icon={<Github />} title="Own what you make" copy="Edit every line, preview changes live, then push your finished site to GitHub." /></div></div></section>
      <footer style={{ padding: "25px 28px", textAlign: "center", color: "#697386", fontSize: 12 }}>© 2026 Vibe · Made for people with ideas.</footer>
    </main>
  );
}
function Feature({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) { return <div className="panel"><div style={{ color: "#6d5dfc", marginBottom: 22 }}>{icon}</div><h3 style={{ margin: "0 0 9px", fontSize: 16 }}>{title}</h3><p style={{ margin: 0, color: "#697386", lineHeight: 1.6, fontSize: 13 }}>{copy}</p></div>; }
