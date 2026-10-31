import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
import { supabase } from "../supabase/client";

const lovableAuth = createLovableAuth();

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

async function isSupabaseProviderEnabled(provider: string): Promise<{ enabled: boolean; projectRef?: string }> {
  try {
    const url =
      (supabase as any)?.supabaseUrl ||
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
      process.env.SUPABASE_URL ||
      "https://efqiekytujylkcnlxnod.supabase.co";

    const key =
      (supabase as any)?.supabaseKey ||
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
      process.env.SUPABASE_PUBLISHABLE_KEY;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`${url}/auth/v1/settings`, {
      method: "GET",
      headers: key ? { apikey: key } : {},
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data?.external && typeof data.external[provider] === "boolean") {
        return { enabled: data.external[provider], projectRef: "efqiekytujylkcnlxnod" };
      }
    }
  } catch {
    // In case of network timeout, allow fallback
  }
  return { enabled: true };
}

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: "google" | "apple" | "microsoft" | "lovable", opts?: SignInOptions) => {
      const isClient = typeof window !== "undefined";
      const redirectUri = opts?.redirect_uri || (isClient ? `${window.location.origin}/auth/callback` : undefined);

      // In a Lovable iframe editor environment, try lovable broker
      const isFramed = isClient && window.parent && window.parent !== window;
      const isLovableHost = isClient && ["lovable.app", "lovableproject.com", "gptengineer.run"].some((h) => window.location.hostname.endsWith(h));

      if (isFramed && isLovableHost) {
        try {
          const result = await lovableAuth.signInWithOAuth(provider, {
            ...opts,
            redirect_uri: redirectUri,
            extraParams: { ...opts?.extraParams },
          });

          if (result.redirected) return result;
          if (!result.error && result.tokens) {
            await supabase.auth.setSession(result.tokens);
            return result;
          }
        } catch {
          // Fall through to native Supabase OAuth
        }
      }

      // Check whether provider is enabled in Supabase before redirecting to avoid 400 raw JSON
      if (provider !== "lovable") {
        const status = await isSupabaseProviderEnabled(provider);
        if (!status.enabled) {
          return {
            error: new Error(
              `Unsupported provider: ${provider} is not enabled in your Supabase project (${status.projectRef || "efqiekytujylkcnlxnod"}). Please enable it in the Supabase Dashboard under Authentication → Providers → Google.`
            ),
            isProviderNotEnabled: true,
          };
        }
      }

      // Standalone / Direct Supabase OAuth flow (reliable on localhost and custom domains)
      try {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: provider === "google" ? "google" : (provider as any),
          options: {
            redirectTo: redirectUri,
            queryParams: opts?.extraParams,
          },
        });

        if (error) {
          return { error };
        }

        if (data?.url && isClient) {
          window.location.assign(data.url);
          return { error: null, redirected: true };
        }

        return { error: null, redirected: true };
      } catch (e) {
        return { error: e instanceof Error ? e : new Error(String(e)) };
      }
    },
  },
};

