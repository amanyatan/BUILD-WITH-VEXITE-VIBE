"use client";
import "./globals.css";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const publicPaths = ["/", "/login"];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (publicPaths.includes(pathname)) {
      setChecking(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login");
      } else {
        setChecking(false);
      }
    });
  }, [pathname, router]);

  if (checking && !publicPaths.includes(pathname)) {
    return (
      <html lang="en" suppressHydrationWarning>
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
      <body suppressHydrationWarning>
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
