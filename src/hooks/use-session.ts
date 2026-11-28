import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    // Subscribe first so an OAuth callback's INITIAL_SESSION/SIGNED_IN event
    // cannot be missed while getSession() is initializing the client.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: sessionData, error }) => {
      if (error) console.error('[Auth] Could not load session:', error.message);
      setUser(sessionData.session?.user ?? null);
      setLoading(false);
    }).catch((error: unknown) => {
      console.error('[Auth] Could not load session:', error);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return { user, loading };
}
