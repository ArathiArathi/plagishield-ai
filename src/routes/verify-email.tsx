import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MailCheck, Loader2, ArrowRight } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/verify-email")({
  head: () => ({ meta: [{ title: "Verify your email — PlagiShield AI" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  component: VerifyEmailPage,
});

export function VerifyEmailPage() {
  const search = Route.useSearch();
  const [email, setEmail] = useState(search.email || "");
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (search.email && !email) {
      setEmail(search.email);
    }
  }, [search.email, email]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleResend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const targetEmail = email.trim();
    if (!targetEmail) {
      toast.error("Please enter your email address to resend verification.");
      return;
    }
    if (cooldown > 0) {
      toast.info(`Please wait ${cooldown}s before requesting another verification email.`);
      return;
    }

    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: targetEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Verification email resent. Check your inbox and spam folder.");
      setCooldown(60);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend verification email");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell
      title="Verify your email"
      subtitle="We sent a verification link to your email address."
      footer={
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <span>Already confirmed your email?</span>
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-border bg-muted/30 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailCheck className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">
            {email ? (
              <>
                Confirmation email sent to:{" "}
                <span className="font-semibold text-primary">{email}</span>
              </>
            ) : (
              "Click the link in your email to activate your account."
            )}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Check your spam or junk folder if you don't see it within a few minutes.
          </p>

          <Button asChild className="mt-5 w-full">
            <Link to="/login" className="flex items-center justify-center gap-2">
              <span>Continue to sign in</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="border-t border-border/60 pt-4">
          <p className="text-xs text-muted-foreground mb-3 text-center">
            Didn't receive the email?
          </p>
          {!search.email ? (
            <form onSubmit={handleResend} className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor="resend-email" className="text-xs">
                  Your email address
                </Label>
                <Input
                  id="resend-email"
                  type="email"
                  placeholder="you@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="w-full text-xs"
                disabled={resending || cooldown > 0}
              >
                {resending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Sending...
                  </span>
                ) : cooldown > 0 ? (
                  `Resend email (${cooldown}s)`
                ) : (
                  "Resend verification email"
                )}
              </Button>
            </form>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => handleResend()}
              disabled={resending || cooldown > 0}
            >
              {resending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Sending...
                </span>
              ) : cooldown > 0 ? (
                `Resend email (${cooldown}s)`
              ) : (
                "Resend verification email"
              )}
            </Button>
          )}
        </div>
      </div>
    </AuthShell>
  );
}
