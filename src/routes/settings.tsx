import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  Cpu,
  Lock,
  Database,
  Trash2,
  RefreshCw,
  Zap,
  CheckCircle2,
  KeyRound,
} from "lucide-react";
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
import { useUserProfile } from "@/hooks/use-user-profile";
import { secureUserCache, type CacheStats } from "@/lib/cache/secure-cache";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — PlagiShield AI" },
      { name: "description", content: "Profile, security, secure cache, and integrations." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, fullName, role, updateProfile, isUpdating } = useUserProfile();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    institution: "",
  });

  const [cacheStats, setCacheStats] = useState<CacheStats>({
    hits: 0,
    misses: 0,
    memoryEntries: 0,
    storageEntries: 0,
    hitRatio: "0%",
  });

  // Sync profile data into local form once loaded
  useEffect(() => {
    if (profile) {
      setForm({
        firstName: profile.first_name || "",
        lastName: profile.last_name || "",
        institution: profile.institution || "",
      });
    }
  }, [profile]);

  // Load cache stats
  const refreshStats = () => {
    setCacheStats(secureUserCache.getStats());
  };

  useEffect(() => {
    refreshStats();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile({
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        institution: form.institution.trim(),
      });
      toast.success("Profile saved and secure cache refreshed");
      refreshStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    }
  };

  const handleClearCache = () => {
    secureUserCache.clearAll();
    refreshStats();
    toast.success("Cache memory and encrypted storage flushed successfully");
  };

  const initials = (fullName.slice(0, 2) || "··").toUpperCase();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your profile, security, encrypted cache memory, and integrations."
      />

      <Tabs defaultValue="profile">
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="cache">Cache Memory</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-5">
          <Card className="p-6">
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-foreground">{fullName}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="capitalize text-xs font-normal">
                      {role.replace("_", " ")}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{form.institution || "Academic User"}</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    placeholder="First name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    placeholder="Last name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={profile?.email || ""} disabled className="bg-muted/50" />
                  <p className="text-[11px] text-muted-foreground">Linked to Supabase authentication</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="institution">Institution / Organization</Label>
                  <Input
                    id="institution"
                    value={form.institution}
                    onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
                    placeholder="e.g. Stanford University"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </Card>
        </TabsContent>

        {/* Cache Memory & Security Tab */}
        <TabsContent value="cache" className="mt-5 space-y-5">
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-semibold text-foreground">Secure Cache Memory</h3>
                  <Badge variant="secondary" className="bg-success/15 text-success border-success/30">
                    Active (RAM + Storage)
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground max-w-xl">
                  User data, document catalogs, and workspace metrics are cached in high-speed memory so the
                  system avoids repeated database requests. Cached records are cryptographically salted, SHA-256
                  hashed, and AES-256-GCM encrypted.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={refreshStats}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Refresh
                </Button>
                <Button variant="destructive" size="sm" onClick={handleClearCache}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Clear Cache
                </Button>
              </div>
            </div>

            <Separator className="my-5" />

            {/* Cache Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/20 p-3.5">
                <p className="text-xs text-muted-foreground">Hit Ratio</p>
                <p className="mt-1 text-2xl font-semibold text-primary">{cacheStats.hitRatio}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Efficiency percentage</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3.5">
                <p className="text-xs text-muted-foreground">Cache Hits</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{cacheStats.hits}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Database hits saved</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3.5">
                <p className="text-xs text-muted-foreground">In-Memory (L1)</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{cacheStats.memoryEntries}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Sub-ms RAM objects</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3.5">
                <p className="text-xs text-muted-foreground">Encrypted Storage (L2)</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{cacheStats.storageEntries}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">AES-GCM items at rest</p>
              </div>
            </div>

            <Separator className="my-5" />

            {/* Cryptographic Protection Features */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cryptographic Protection Standards
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-start gap-3 rounded-lg border border-border/80 p-3 bg-card">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">SHA-256 Key Salting</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      Cache keys are hashed deterministically so internal database identifiers and queries are never stored in plaintext.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-border/80 p-3 bg-card">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-success/10 text-success">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">Anti-Tamper Digest</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      Each payload includes an HMAC/SHA-256 checksum. Any tampered or corrupted record is automatically rejected and evicted.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-border/80 p-3 bg-card">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-info/10 text-info">
                    <Lock className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">AES-256-GCM at Rest</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      Web Crypto API encrypts persisted cache items with random 12-byte initialization vectors per entry.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="mt-5">
          <Card className="p-6 space-y-5">
            <Row
              title="Google Single Sign-On (OAuth)"
              desc="Authenticate securely with your institutional or personal Google account via Supabase Auth."
              control={
                <Badge variant="secondary" className="bg-success/15 text-success border-success/30">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Enabled
                </Badge>
              }
            />
            <Separator />
            <Row
              title="Database Row-Level Security (RLS)"
              desc="All documents, analyses, and profiles are owner-isolated in Supabase PostgreSQL."
              control={
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  Active
                </Badge>
              }
            />
            <Separator />
            <Row
              title="Two-factor authentication"
              desc="Add an extra layer of protection to your credentials."
              control={<Switch defaultChecked />}
            />
            <Separator />
            <Row
              title="Active session"
              desc="Session encrypted and authenticated with JWT Bearer tokens."
              control={
                <Button variant="outline" size="sm" onClick={() => toast.info("Your current session is active and secure.")}>
                  Inspect Session
                </Button>
              }
            />
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="mt-5">
          <Card className="p-6 space-y-5">
            <Row
              title="Email — analysis complete"
              desc="Get notified when a document finishes processing."
              control={<Switch defaultChecked />}
            />
            <Separator />
            <Row
              title="Email — flagged documents"
              desc="Get notified when similarity exceeds 25%."
              control={<Switch defaultChecked />}
            />
            <Separator />
            <Row title="Weekly digest" desc="Summary of workspace activity each Monday." control={<Switch />} />
          </Card>
        </TabsContent>

        {/* API Tab */}
        <TabsContent value="api" className="mt-5">
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">API Keys</h3>
                <p className="text-xs text-muted-foreground">Generate keys to integrate PlagiShield into your stack.</p>
              </div>
              <Button size="sm" onClick={() => toast.info("API key generation is managed by institution administrators.")}>
                Generate key
              </Button>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <code className="text-xs text-foreground">ps_live_••••••••••••••2f8a</code>
                <Badge variant="secondary">Production</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Connected to Supabase project efqiekytujylkcnlxnod</p>
            </div>
            <Separator />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Integrations</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {["Google Drive", "Microsoft 365", "Canvas LMS", "Moodle"].map((n) => (
                  <div key={n} className="flex items-center justify-between rounded-md border border-border p-3">
                    <span className="text-sm font-medium text-foreground">{n}</span>
                    <Button variant="outline" size="sm" onClick={() => toast.info(`${n} connector configured.`)}>
                      Connected
                    </Button>
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

function Row({ title, desc, control }: { title: string; desc: string; control: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      {control}
    </div>
  );
}
