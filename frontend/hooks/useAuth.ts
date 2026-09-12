import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store";

export function useAuth() {
  const setUser = useAppStore((state) => state.setUser);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user?.email || null);
    });
    return () => subscription.unsubscribe();
  }, [setUser]);
}
