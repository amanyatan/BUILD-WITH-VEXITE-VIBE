"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push("/dashboard");
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user && !data.user.confirmed_at) {
          setMessage("Check your email for the confirmation link!");
        } else {
          router.push("/dashboard");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        localStorage.setItem("user_email", data.user.email || email);
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-visual">
        <Link href="/" className="brand"><b className="brand-mark">V</b><span>vibe</span></Link>
        <div className="orb orb-a" />
        <div className="orb orb-b" />
        <h1>Code in your<br />Mother Tongue.</h1>
        <p>The multi-agent tools help you understand your prompts and code in the simplest way.</p>
      </section>
      <section className="login-card">
        <div className="eyebrow"><Sparkles size={13} style={{ verticalAlign: "middle" }} /> Welcome to Vibe</div>
        <h2>{isSignUp ? "Create your workspace" : "Welcome back"}</h2>
        <p>{isSignUp ? "Start making something you want to share." : "Your next great idea is only a prompt away."}</p>

        {error && <div style={{ background: "#fff0f2", color: "#d54f61", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}
        {message && <div style={{ background: "#e9e5ff", color: "#5041e6", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{message}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder={isSignUp ? "At least 8 characters" : "Enter your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <button className="button button-primary" type="submit" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <>{isSignUp ? "Create account" : "Sign in"} <ArrowRight size={15} /></>}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 25 }}>
          {isSignUp ? "Already have an account? " : "New to Vibe? "}
          <button
            className="muted-link"
            style={{ border: 0, background: "none", padding: 0, cursor: "pointer" }}
            onClick={() => { setIsSignUp(!isSignUp); setError(""); setMessage(""); }}
          >
            {isSignUp ? "Sign in" : "Create an account"}
          </button>
        </p>
      </section>
    </main>
  );
}
