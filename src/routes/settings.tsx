import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — PlagiShield AI" }, { name: "description", content: "Profile, security, notifications, and integrations." }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your profile, security, and integrations." />

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="api">API & Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-5">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16"><AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">AP</AvatarFallback></Avatar>
              <div><h3 className="font-semibold text-foreground">Aarav Patel</h3><p className="text-sm text-muted-foreground">Faculty · MIT</p></div>
              <Button variant="outline" size="sm" className="ml-auto">Change avatar</Button>
            </div>
            <Separator className="my-6" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Full name" defaultValue="Aarav Patel" />
              <Field label="Email" defaultValue="aarav@mit.edu" type="email" />
              <Field label="Department" defaultValue="Computer Science" />
              <Field label="Title" defaultValue="Associate Professor" />
            </div>
            <div className="mt-6 flex justify-end gap-2"><Button variant="outline">Cancel</Button><Button>Save changes</Button></div>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-5">
          <Card className="p-6 space-y-5">
            <Row title="Two-factor authentication" desc="Add an extra layer of security." control={<Switch defaultChecked />} />
            <Separator />
            <Row title="Single sign-on (SSO)" desc="Sign in with your institutional Google account." control={<Switch defaultChecked />} />
            <Separator />
            <Row title="Active sessions" desc="2 devices currently signed in." control={<Button variant="outline" size="sm">Manage</Button>} />
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-5">
          <Card className="p-6 space-y-5">
            <Row title="Email — analysis complete" desc="Get notified when a document finishes processing." control={<Switch defaultChecked />} />
            <Separator />
            <Row title="Email — flagged documents" desc="Get notified when similarity exceeds 25%." control={<Switch defaultChecked />} />
            <Separator />
            <Row title="Weekly digest" desc="Summary of activity each Monday." control={<Switch />} />
          </Card>
        </TabsContent>

        <TabsContent value="api" className="mt-5">
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div><h3 className="text-sm font-semibold text-foreground">API Keys</h3><p className="text-xs text-muted-foreground">Generate keys to integrate PlagiShield into your stack.</p></div>
              <Button size="sm">Generate new key</Button>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between"><code className="text-xs text-foreground">ps_live_••••••••••••••2f8a</code><Badge variant="secondary">Production</Badge></div>
              <p className="mt-1 text-xs text-muted-foreground">Created May 12, 2026 · Last used 2 hours ago</p>
            </div>
            <Separator />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Integrations</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {["Google Drive", "Microsoft 365", "Canvas LMS", "Moodle"].map(n => (
                  <div key={n} className="flex items-center justify-between rounded-md border border-border p-3">
                    <span className="text-sm font-medium text-foreground">{n}</span>
                    <Button variant="outline" size="sm">Connect</Button>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof Input>) {
  return <div className="space-y-1.5"><Label>{label}</Label><Input {...props} /></div>;
}
function Row({ title, desc, control }: { title: string; desc: string; control: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4">
    <div><p className="text-sm font-medium text-foreground">{title}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
    {control}
  </div>;
}
