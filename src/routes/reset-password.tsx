import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Lock } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set a new password — PlagiShield AI" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
    error_description:
      typeof search.error_description === "string" ? search.error_description : undefined,
  }),
  component: ResetPasswordPage,
});

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSessionValid, setIsSessionValid] = useState(false);

  useEffect(() => {
    let active = true;

    async function establishRecoverySession() {
      try {
        // 1. If error is present in query params or hash
        if (search.error || search.error_description) {
          if (!active) return;
          setErrorMessage(search.error_description || search.error || "Reset link is invalid");
          setVerifying(false);
          return;
        }

        // 2. Parse hash fragment if implicit flow was used
        if (typeof window !== "undefined" && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
          const hashError = hashParams.get("error_description") || hashParams.get("error");
          if (hashError) {
            if (!active) return;
            setErrorMessage(hashError);
            setVerifying(false);
            return;
          }

          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          if (accessToken && refreshToken) {
            const { error: setSessionErr } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (setSessionErr) {
              if (!active) return;
              setErrorMessage(setSessionErr.message);
              setVerifying(false);
              return;
            }
            if (window.history && window.history.replaceState) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
            if (!active) return;
            setIsSessionValid(true);
            setVerifying(false);
            return;
          }
        }

        // 3. Handle PKCE code in query params
        if (search.code) {
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(search.code);
          if (exchangeErr) {
            if (!active) return;
            setErrorMessage(
              exchangeErr.message.includes("expired")
                ? "This password reset link has expired. Please request a new one."
                : exchangeErr.message,
            );
            setVerifying(false);
            return;
          }
          if (typeof window !== "undefined" && window.history && window.history.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          if (!active) return;
          setIsSessionValid(true);
          setVerifying(false);
          return;
        }

        // 4. Check if an active session already exists (e.g. from Supabase auth listener)
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          if (!active) return;
          setIsSessionValid(true);
          setVerifying(false);
          return;
        }

        // If no code, no hash, and no active session
        if (!active) return;
        setErrorMessage("No active password reset session found. Please request a new reset link.");
        setVerifying(false);
      } catch (err) {
        if (!active) return;
        setErrorMessage(err instanceof Error ? err.message : "Failed to verify reset link");
        setVerifying(false);
      }
    }

    // Set up auth state change listener in case PASSWORD_RECOVERY fires asynchronously
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) {
        if (active) {
          setIsSessionValid(true);
          setErrorMessage(null);
          setVerifying(false);
        }
      }
    });

    establishRecoverySession();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [search.code, search.error, search.error_description]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }
    if (pw !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Password updated successfully. You can now sign in.");
      await supabase.auth.signOut().catch(() => {});
      navigate({ to: "/login" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setSubmitting(false);
    }
  };

  const hasLength = pw.length >= 8;
  const hasMixed = /[a-zA-Z]/.test(pw) && /[0-9!@#$%^&*]/.test(pw);

  if (verifying) {
    return (
      <AuthShell
        title="Verifying link"
        subtitle="Please wait while we verify your password reset link..."
      >
        <div className="flex flex-col items-center justify-center py-10 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Confirming authorization...</p>
        </div>
      </AuthShell>
    );
  }

  if (errorMessage || !isSessionValid) {
    return (
      <AuthShell
        title="Invalid or Expired Link"
        subtitle="We were unable to verify this password reset link."
        footer={
          <Link to="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Reset Link Expired or Invalid</p>
              <p className="mt-1 text-xs opacity-90">
                {errorMessage || "The link may have already been used or has expired."}
              </p>
            </div>
          </div>
          <Button asChild className="w-full">
            <Link to="/forgot-password">Request a new reset link</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a strong password to secure your account."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="new-pw">New password</Label>
          <div className="relative">
            <Input
              id="new-pw"
              type="password"
              placeholder="••••••••"
              required
              minLength={8}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="pl-9"
            />
            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-pw">Confirm new password</Label>
          <div className="relative">
            <Input
              id="confirm-pw"
              type="password"
              placeholder="••••••••"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="pl-9"
            />
            <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {pw.length > 0 && (
          <div className="rounded-md bg-muted/50 p-2.5 text-xs space-y-1">
            <div className="flex items-center gap-1.5">
              <CheckCircle2
                className={`h-3.5 w-3.5 ${hasLength ? "text-emerald-500" : "text-muted-foreground"}`}
              />
              <span className={hasLength ? "text-foreground font-medium" : "text-muted-foreground"}>
                At least 8 characters
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2
                className={`h-3.5 w-3.5 ${hasMixed ? "text-emerald-500" : "text-muted-foreground"}`}
              />
              <span className={hasMixed ? "text-foreground font-medium" : "text-muted-foreground"}>
                Letters and numbers or symbols
              </span>
            </div>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Updating password...
            </span>
          ) : (
            "Update password"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
