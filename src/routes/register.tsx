import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Create account — PlagiShield AI" }, { name: "description", content: "Create your PlagiShield AI account." }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  return (
    <AuthShell
      title="Create your account"
      subtitle="Start safeguarding content authenticity in minutes."
      footer={<>Already have an account? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link></>}
    >
      <form
        onSubmit={(e) => { e.preventDefault(); setLoading(true); setTimeout(() => { toast.success("Account created. Check your email."); navigate({ to: "/verify-email" }); }, 500); }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>First name</Label><Input placeholder="Aarav" required /></div>
          <div className="space-y-1.5"><Label>Last name</Label><Input placeholder="Patel" required /></div>
        </div>
        <div className="space-y-1.5"><Label>Email</Label><Input type="email" placeholder="you@university.edu" required /></div>
        <div className="space-y-1.5"><Label>Password</Label><Input type="password" placeholder="At least 8 characters" required /></div>
        <div className="space-y-1.5">
          <Label>I am a…</Label>
          <Select defaultValue="student">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="faculty">Faculty</SelectItem>
              <SelectItem value="admin">Institution Administrator</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating…" : "Create account"}</Button>
      </form>
    </AuthShell>
  );
}
