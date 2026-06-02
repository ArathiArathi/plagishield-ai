import { createFileRoute, Link } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/verify-email")({
  head: () => ({ meta: [{ title: "Verify your email — PlagiShield AI" }] }),
  component: () => (
    <AuthShell title="Verify your email" subtitle="We sent a verification link to your inbox."
      footer={<>Didn't get an email? <button className="font-medium text-primary hover:underline">Resend</button></>}>
      <div className="rounded-lg border border-border bg-muted/30 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheck className="h-6 w-6" />
        </div>
        <p className="mt-3 text-sm text-foreground">Click the link in your email to activate your account.</p>
        <Button asChild className="mt-5 w-full"><Link to="/login">Continue to sign in</Link></Button>
      </div>
    </AuthShell>
  ),
});
