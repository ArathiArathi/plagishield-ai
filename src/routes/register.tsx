import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldAlert, Sparkles } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create account — PlagiShield AI" },
      { name: "description", content: "Create your PlagiShield AI account to check originality, AI content, grammar, and citations." },
      { property: "og:title", content: "Create account — PlagiShield AI" },
      { property: "og:description", content: "Create your PlagiShield AI account to check originality, AI content, grammar, and citations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [oauthHelpOpen, setOauthHelpOpen] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  const onChange = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const res = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth/callback`,
      });

      if (res.error) {
        const msg = res.error.message || "Google sign-in failed";
        if (
          msg.toLowerCase().includes("unsupported provider") ||
          msg.toLowerCase().includes("not enabled")
        ) {
          setOauthHelpOpen(true);
          toast.error("Google provider is not enabled in your Supabase project.");
        } else {
          toast.error(msg);
        }
        return;
      }

      if (res.redirected) return;
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed";
      if (msg.toLowerCase().includes("unsupported provider") || msg.toLowerCase().includes("not enabled")) {
        setOauthHelpOpen(true);
      }
      toast.error(msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: "demo@plagishield.ai",
        password: "DemoPassword123!",
      });

      if (error) {
        toast.error(`Demo sign-in failed: ${error.message}`);
        return;
      }

      toast.success("Signed in with Demo Account");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Demo sign-in failed");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            first_name: form.firstName.trim(),
            last_name: form.lastName.trim(),
          },
        },
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("already registered") || msg.includes("already been registered") || msg.includes("user already")) {
          toast.error("That email is already registered. Try signing in instead.");
        } else if (msg.includes("failed to fetch")) {
          toast.error("Couldn't reach the server. Check your connection and try again.");
        } else {
          toast.error(error.message);
        }
        return;
      }

      if (data.session) {
        toast.success("Account created successfully");
        navigate({ to: "/dashboard" });
        return;
      }

      toast.success("Account created. Check your email to confirm it.");
      navigate({ to: "/verify-email" });
    } catch (err) {
      toast.error(
        err instanceof Error && err.message.includes("fetch")
          ? "Couldn't reach the server. Please try again in a moment."
          : err instanceof Error ? err.message : "Sign-up failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start safeguarding content authenticity in minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
        >
          <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
            <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.95l3.66-2.84Z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.46 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
          </svg>
          {googleLoading ? "Connecting to Google..." : "Continue with Google"}
        </Button>

        <div className="relative">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs uppercase text-muted-foreground">
            or email
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>First name</Label>
              <Input
                placeholder="Aarav"
                required
                value={form.firstName}
                onChange={onChange("firstName")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Last name</Label>
              <Input
                placeholder="Patel"
                required
                value={form.lastName}
                onChange={onChange("lastName")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="you@university.edu"
              required
              value={form.email}
              onChange={onChange("email")}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input
              type="password"
              placeholder="At least 8 characters"
              required
              minLength={8}
              value={form.password}
              onChange={onChange("password")}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </div>

      {/* OAuth Setup Guidance Dialog */}
      <Dialog open={oauthHelpOpen} onOpenChange={setOauthHelpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <DialogTitle className="text-center text-lg">Google OAuth Setup in Supabase</DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground">
              Google provider is not yet activated on this Supabase project (<code className="text-primary font-mono">efqiekytujylkcnlxnod</code>).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs text-muted-foreground">
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
              <p className="font-semibold text-foreground text-xs">To enable Google OAuth:</p>
              <ol className="list-decimal list-inside space-y-1.5">
                <li>
                  Open your <strong className="text-foreground">Supabase Dashboard</strong> → <strong>Authentication</strong> → <strong>Providers</strong>.
                </li>
                <li>Find <strong className="text-foreground">Google</strong> and toggle it <span className="text-emerald-400 font-semibold">Enabled</span>.</li>
                <li>Paste your Google Cloud <strong className="text-foreground">Client ID</strong> and <strong className="text-foreground">Client Secret</strong>.</li>
                <li>
                  Add redirect callback URL:
                  <div className="mt-1 rounded bg-background p-1.5 font-mono text-[11px] text-foreground select-all break-all">
                    https://efqiekytujylkcnlxnod.supabase.co/auth/v1/callback
                  </div>
                </li>
              </ol>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="default"
                className="w-full text-xs"
                onClick={() => {
                  setOauthHelpOpen(false);
                  handleDemoLogin();
                }}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Sign in with 1-Click Demo Account Instead
              </Button>

              <Button
                variant="outline"
                className="w-full text-xs"
                onClick={() => setOauthHelpOpen(false)}
              >
                Close & Use Email Registration
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AuthShell>
  );
}
