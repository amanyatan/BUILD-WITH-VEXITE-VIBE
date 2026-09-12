"use client";
import "./globals.css";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store";

const publicPaths = ["/", "/login"];
const isSupabaseConfigured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const setUser = useAppStore((s) => s.setUser);

  useEffect(() => {
    if (!isSupabaseConfigured || publicPaths.includes(pathname)) {
      setChecking(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login");
      } else {
        setUser(session.user.email || null);
        localStorage.setItem("user_email", session.user.email || "");
        setChecking(false);
      }
    }).catch(() => {
      setChecking(false);
    });
  }, [pathname, router, setUser]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user?.email || null);
      if (session?.user?.email) {
        localStorage.setItem("user_email", session.user.email);
      }
    });
    return () => subscription.unsubscribe();
  }, [setUser]);

  if (checking && !publicPaths.includes(pathname)) {
    return (
      <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#6d5dfc" />
        <title>Vibe - AI Website Builder</title>
      </head>
      <body suppressHydrationWarning>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#697386" }}>
            Loading...
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#6d5dfc" />
        <meta name="description" content="Vibe - AI-powered website builder. Describe your idea and watch it come to life." />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="preconnect" href="https://wipxzkfchccnpxdkoswj.supabase.co" />
        <link rel="dns-prefetch" href="https://wipxzkfchccnpxdkoswj.supabase.co" />
        <title>Vibe - AI Website Builder</title>
      </head>
      <body suppressHydrationWarning>
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
