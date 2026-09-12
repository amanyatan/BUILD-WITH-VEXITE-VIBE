"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Suspense } from "react";

export default function AuthCallbackPage() {
  return <Suspense><Callback /></Suspense>;
}

function Callback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(() => {
        router.push("/dashboard");
      });
    }

    const hash = window.location.hash;
    if (hash) {
      supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN") {
          router.push("/dashboard");
        }
      });
    }
  }, [searchParams, router]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#697386" }}>
      Signing you in...
    </div>
  );
}
