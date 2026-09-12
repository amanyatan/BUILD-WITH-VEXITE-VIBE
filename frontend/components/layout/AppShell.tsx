"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, FolderKanban, Settings, HelpCircle, Bell, LogOut } from "lucide-react";
import { useAppStore } from "@/store";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children, title }: { children: React.ReactNode; title?: string }) {
  const path = usePathname();
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("user_email");
    if (stored) {
      setUserEmail(stored);
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.email) {
          setUserEmail(session.user.email);
          localStorage.setItem("user_email", session.user.email);
        }
      });
    }
  }, []);

  const displayName = userEmail ? userEmail.split("@")[0] : user || "Guest";
  const initials = displayName.slice(0, 2).toUpperCase();

  async function handleLogout() {
    await supabase.auth.signOut();
    localStorage.removeItem("user_email");
    router.push("/login");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand"><b className="brand-mark">V</b><span>vibe</span></Link>
        <div className="nav-label">Workspace</div>
        {nav.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`nav-link ${path === href ? "active" : ""}`}>
            <Icon size={17} /><span>{label}</span>
          </Link>
        ))}
        <div className="nav-label">Support</div>
        <a className="nav-link" href="mailto:hello@vibe.local"><HelpCircle size={17} /><span>Help center</span></a>
        <div className="sidebar-spacer" />
        <div className="user-chip">
          <div className="avatar">{initials}</div>
          <div>
            <strong>{displayName}</strong>
            <span>{userEmail || "Guest"}</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "8px 10px", border: 0, background: "transparent", color: "#727b8c", cursor: "pointer", borderRadius: 10, fontSize: 13, width: "100%" }}
        >
          <LogOut size={15} /><span>Sign out</span>
        </button>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <span className="topbar-title">{title || "Workspace"}</span>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Notifications"><Bell size={17} /></button>
            <div className="avatar">{initials}</div>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
