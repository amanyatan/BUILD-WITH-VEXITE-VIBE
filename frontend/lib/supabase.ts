import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  client = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseAnonKey || "placeholder-key");
  return client;
}

// Legacy export for backward compatibility
export const supabase = typeof window !== "undefined"
  ? (() => {
      if (!supabaseUrl || !supabaseAnonKey) {
        return createClient("https://placeholder.supabase.co", "placeholder-key");
      }
      return createClient(supabaseUrl, supabaseAnonKey);
    })()
  : createClient("https://placeholder.supabase.co", "placeholder-key");
