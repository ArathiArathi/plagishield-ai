import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot password — PlagiShield AI" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Reset link sent. Check your inbox.");
  };
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send a reset link."
      footer={<Link to="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5"><Label>Email</Label><Input type="email" placeholder="you@university.edu" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <Button type="submit" className="w-full" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</Button>
      </form>
    </AuthShell>
  );
}
