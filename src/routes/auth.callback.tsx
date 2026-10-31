import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: "Authenticating — PlagiShield AI" },
      { name: "description", content: "Completing authentication..." },
    ],
  }),
  component: AuthCallbackPage,
});

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [providerError, setProviderError] = useState(false);

  useEffect(() => {
    let active = true;

    async function handleAuth() {
      try {
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));

        // Check for OAuth error in query or hash fragment
        const error =
          url.searchParams.get("error") ||
          url.searchParams.get("error_code") ||
          hashParams.get("error") ||
          hashParams.get("error_code");

        const errorDesc =
          url.searchParams.get("error_description") ||
          url.searchParams.get("message") ||
          hashParams.get("error_description") ||
          hashParams.get("message");

        if (error) {
          let friendly = errorDesc || error;
          if (
            friendly.toLowerCase().includes("unsupported provider") ||
            friendly.toLowerCase().includes("not enabled")
          ) {
            friendly =
              "Google sign-in is not yet enabled in your Supabase project. You can enable it in the Supabase Dashboard, or sign in directly with email & password.";
            if (active) setProviderError(true);
          }
          if (active) setErrorMsg(friendly);
          toast.error(friendly);
          return;
        }

        // 1. Check if a session is already present (e.g. from background client auto-exchange)
        const { data: initialData } = await supabase.auth.getSession();
        if (initialData.session) {
          if (typeof window !== "undefined") {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          toast.success("Signed in successfully");
          navigate({ to: "/dashboard", replace: true });
          return;
        }

        // 2. Handle Implicit Grant (Hash fragment tokens: #access_token=...&refresh_token=...)
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
          const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (!sessionErr && sessionData.session) {
            if (typeof window !== "undefined") {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
            toast.success("Signed in successfully");
            navigate({ to: "/dashboard", replace: true });
            return;
          }
        }

        // 3. Handle PKCE authorization code (?code=...)
        const code = url.searchParams.get("code");
        if (code) {
          // Attempt exchange code for session
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.warn("[OAuth Callback] exchangeCodeForSession notice:", exchangeError.message);
            // Check if Supabase client already completed the exchange in parallel
            const { data: checkData } = await supabase.auth.getSession();
            if (checkData.session) {
              if (typeof window !== "undefined") {
                window.history.replaceState({}, document.title, window.location.pathname);
              }
              toast.success("Signed in successfully");
              navigate({ to: "/dashboard", replace: true });
              return;
            }

            if (active) setErrorMsg(exchangeError.message);
            toast.error(exchangeError.message);
            return;
          }

          const { data: verifiedData } = await supabase.auth.getSession();
          if (verifiedData.session) {
            if (typeof window !== "undefined") {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
            toast.success("Signed in successfully with Google");
            navigate({ to: "/dashboard", replace: true });
            return;
          }
        }

        // 4. Listen for onAuthStateChange in case session is finalizing asynchronously
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
          if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && s) {
            subscription.unsubscribe();
            if (typeof window !== "undefined") {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
            toast.success("Signed in successfully");
            navigate({ to: "/dashboard", replace: true });
          }
        });

        // 5. Fallback timeout after 6 seconds
        const timer = setTimeout(() => {
          if (active) {
            setErrorMsg("Authentication session was not established. Please try signing in again.");
          }
        }, 6000);

        return () => {
          clearTimeout(timer);
          subscription.unsubscribe();
        };
      } catch (err) {
        console.error("[OAuth Callback] Error handling OAuth redirect:", err);
        const msg = err instanceof Error ? err.message : "Authentication failed";
        if (active) setErrorMsg(msg);
        toast.error(msg);
      }
    }

    handleAuth();

    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="h-7 w-7" strokeWidth={2.4} />
        </div>

        {errorMsg ? (
          <div className="space-y-4 text-left">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <h1 className="text-base font-semibold">Authentication Notice</h1>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {errorMsg}
            </p>

            {providerError && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/90 space-y-2">
                <p className="font-medium text-amber-300">How to enable Google in Supabase:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Open your Supabase Project Dashboard</li>
                  <li>Navigate to <strong>Authentication</strong> → <strong>Providers</strong></li>
                  <li>Toggle <strong>Google</strong> to enabled and input your Google OAuth credentials</li>
                </ol>
              </div>
            )}

            <div className="pt-2 flex flex-col gap-2">
              <Button
                className="w-full"
                variant="default"
                onClick={() => navigate({ to: "/login", replace: true })}
              >
                Back to Sign In
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <h1 className="text-lg font-semibold text-foreground">Completing authentication</h1>
            <p className="text-xs text-muted-foreground">
              Verifying your credentials and establishing a secure session...
            </p>
            <div className="pt-4 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
