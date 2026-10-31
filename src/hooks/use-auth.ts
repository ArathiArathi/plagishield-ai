import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { secureUserCache } from "@/lib/cache/secure-cache";

// Module-level shared reactive state
let sharedSession: Session | null = null;
let sharedUser: User | null = null;
let sharedLoading = true;
let isInitialized = false;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function initAuth() {
  if (isInitialized || typeof window === "undefined") return;
  isInitialized = true;

  supabase.auth.getSession().then(({ data }) => {
    sharedSession = data.session;
    sharedUser = data.session?.user ?? null;
    sharedLoading = false;
    notify();
  }).catch((err) => {
    console.error("[useAuth] Failed getting initial session:", err);
    sharedLoading = false;
    notify();
  });

  supabase.auth.onAuthStateChange((event, session) => {
    sharedSession = session;
    sharedUser = session?.user ?? null;
    sharedLoading = false;

    if (event === "SIGNED_OUT") {
      secureUserCache.clearAll();
      try {
        sessionStorage.clear();
      } catch {
        // ignore
      }
    } else if (event === "SIGNED_IN") {
      // Purge stale cache from previous sessions when a new login occurs
      secureUserCache.clearAll();
    }

    notify();
  });
}

export function useAuth() {
  initAuth();

  const [state, setState] = useState(() => ({
    session: sharedSession,
    user: sharedUser,
    loading: sharedLoading,
  }));

  useEffect(() => {
    const update = () => {
      setState({
        session: sharedSession,
        user: sharedUser,
        loading: sharedLoading,
      });
    };

    listeners.add(update);

    // Sync immediately if module-level state progressed
    if (
      state.session !== sharedSession ||
      state.user !== sharedUser ||
      state.loading !== sharedLoading
    ) {
      update();
    }

    return () => {
      listeners.delete(update);
    };
  }, [state.session, state.user, state.loading]);

  const signOut = async () => {
    secureUserCache.clearAll();
    try {
      sessionStorage.clear();
    } catch {
      // ignore
    }
    const res = await supabase.auth.signOut();
    sharedSession = null;
    sharedUser = null;
    sharedLoading = false;
    notify();
    return res;
  };

  return {
    session: state.session,
    user: state.user,
    loading: state.loading,
    isAuthenticated: !!state.session,
    signOut,
  };
}
