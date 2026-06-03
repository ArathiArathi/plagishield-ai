import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Create account — PlagiShield AI" }, { name: "description", content: "Create your PlagiShield AI account." }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", password: "", role: "student",
  });

  const onChange = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          first_name: form.firstName,
          last_name: form.lastName,
          role: form.role,
        },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Account created. Please verify your email.");
    navigate({ to: "/verify-email" });
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start safeguarding content authenticity in minutes."
      footer={<>Already have an account? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>First name</Label><Input placeholder="Aarav" required value={form.firstName} onChange={onChange("firstName")} /></div>
          <div className="space-y-1.5"><Label>Last name</Label><Input placeholder="Patel" required value={form.lastName} onChange={onChange("lastName")} /></div>
        </div>
        <div className="space-y-1.5"><Label>Email</Label><Input type="email" placeholder="you@university.edu" required value={form.email} onChange={onChange("email")} /></div>
        <div className="space-y-1.5"><Label>Password</Label><Input type="password" placeholder="At least 8 characters" required minLength={8} value={form.password} onChange={onChange("password")} /></div>
        <div className="space-y-1.5">
          <Label>I am a…</Label>
          <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="faculty">Faculty</SelectItem>
              <SelectItem value="institution_admin">Institution Administrator</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating…" : "Create account"}</Button>
      </form>
    </AuthShell>
  );
}
