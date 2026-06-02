import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot password — PlagiShield AI" }] }),
  component: () => (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send a reset link."
      footer={<><Link to="/login" className="font-medium text-primary hover:underline">Back to sign in</Link></>}
    >
      <form onSubmit={(e) => { e.preventDefault(); toast.success("Reset link sent"); }} className="space-y-4">
        <div className="space-y-1.5"><Label>Email</Label><Input type="email" placeholder="you@university.edu" required /></div>
        <Button type="submit" className="w-full">Send reset link</Button>
      </form>
    </AuthShell>
  ),
});
