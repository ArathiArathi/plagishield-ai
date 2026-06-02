import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set a new password — PlagiShield AI" }] }),
  component: () => {
    const navigate = useNavigate();
    return (
      <AuthShell title="Set a new password" subtitle="Choose a strong password to secure your account."
        footer={<><Link to="/login" className="font-medium text-primary hover:underline">Back to sign in</Link></>}>
        <form onSubmit={(e) => { e.preventDefault(); toast.success("Password updated"); navigate({ to: "/login" }); }} className="space-y-4">
          <div className="space-y-1.5"><Label>New password</Label><Input type="password" required /></div>
          <div className="space-y-1.5"><Label>Confirm password</Label><Input type="password" required /></div>
          <Button type="submit" className="w-full">Update password</Button>
        </form>
      </AuthShell>
    );
  },
});
