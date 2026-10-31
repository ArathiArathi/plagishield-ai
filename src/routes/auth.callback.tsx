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

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function handleAuth() {
      try {
        const url = new URL(window.location.href);

        // Check for OAuth error query parameters
        const error = url.searchParams.get("error") || url.searchParams.get("error_code");
        const errorDesc =
          url.searchParams.get("error_description") ||
          url.searchParams.get("message");

        if (error) {
          let friendly = errorDesc || error;
          if (friendly.toLowerCase().includes("unsupported provider") || friendly.toLowerCase().includes("not enabled")) {
            friendly =
              "Google sign-in is not enabled in your Supabase project. Please enable Google in Supabase Dashboard → Authentication → Providers → Google.";
          }
          if (active) setErrorMsg(friendly);
          toast.error(friendly);
          return;
        }

        // Check for PKCE authorization code in URL
        const code = url.searchParams.get("code");
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error("[OAuth Callback] exchangeCodeForSession error:", exchangeError);
            if (active) setErrorMsg(exchangeError.message);
            toast.error(exchangeError.message);
            return;
          }
        }

        // Verify active session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          toast.success("Signed in successfully with Google");
          navigate({ to: "/dashboard", replace: true });
          return;
        }

        // Listen for onAuthStateChange in case session is being processed asynchronously
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
          if (event === "SIGNED_IN" && s) {
            subscription.unsubscribe();
            toast.success("Signed in successfully with Google");
            navigate({ to: "/dashboard", replace: true });
          }
        });

        // Timeout fallback after 8 seconds if no session is acquired
        const timer = setTimeout(() => {
          if (active) {
            setErrorMsg("Authentication timed out. Please try signing in again.");
            toast.error("Sign-in timed out. Please try again.");
          }
        }, 8000);

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
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="h-7 w-7" strokeWidth={2.4} />
        </div>

        {errorMsg ? (
          <div className="space-y-4">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Authentication Issue</h1>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{errorMsg}</p>
            </div>
            <Button
              className="w-full"
              variant="default"
              onClick={() => navigate({ to: "/login", replace: true })}
            >
              Back to Sign In
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <h1 className="text-lg font-semibold text-foreground">Completing sign-in</h1>
            <p className="text-xs text-muted-foreground">
              Verifying your credentials and establishing secure session...
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
