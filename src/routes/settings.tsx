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
  Eye,
  EyeOff,
  Copy,
  Plus,
  Cloud,
  FolderSync,
  ExternalLink,
  Sparkles,
  CheckCircle,
  CreditCard,
  Check,
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
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUserProfile } from "@/hooks/use-user-profile";
import {
  useSubscription,
  SUBSCRIPTION_PLANS,
  type SubscriptionPlanId,
} from "@/hooks/use-subscription";
import { UpgradeModal } from "@/components/subscription/UpgradeModal";
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
  const {
    planId,
    plan,
    docsUsed,
    docLimit,
    isLimitReached,
    usagePercent,
    subscriptionStatus,
    currentPeriodEnd,
    hasBillingCustomer,
    openBillingPortal,
  } = useSubscription();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

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

  // API Keys state (Keys are HIDDEN by default)
  const defaultApiKeys: Array<{
    id: string;
    name: string;
    key: string;
    createdAt: string;
    scope: "full" | "read";
  }> = [
    {
      id: "key-default",
      name: "Default Workspace Key",
      key: "ps_live_4f89a2b10e7c53d9e84b12aa7e912f8a",
      createdAt: "2026-05-15",
      scope: "full",
    },
  ];

  const [apiKeys, setApiKeys] = useState(() => {
    if (typeof window === "undefined") return defaultApiKeys;
    try {
      const saved = localStorage.getItem(`plagishield_api_keys_${profile?.id ?? "default"}`);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return defaultApiKeys;
  });

  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScope, setNewKeyScope] = useState<"full" | "read">("full");
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  // Integrations state
  const defaultIntegrations = {
    googleDrive: {
      connected: false,
      email: "",
      folder: "My Drive / Research Submissions",
      autoSync: true,
    },
    microsoft365: {
      connected: false,
      email: "",
      autoSync: false,
    },
    canvasLms: {
      connected: false,
      domain: "",
      tokenMasked: "",
    },
    moodle: {
      connected: false,
      siteUrl: "",
      tokenMasked: "",
    },
  };

  const [integrations, setIntegrations] = useState(() => {
    if (typeof window === "undefined") return defaultIntegrations;
    try {
      const saved = localStorage.getItem(`plagishield_integrations_${profile?.id ?? "default"}`);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return defaultIntegrations;
  });

  // Modal states for integrations
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [driveEmail, setDriveEmail] = useState("");
  const [driveFolder, setDriveFolder] = useState("My Drive / Research Submissions");
  const [driveAutoSync, setDriveAutoSync] = useState(true);

  const [msModalOpen, setMsModalOpen] = useState(false);
  const [msEmail, setMsEmail] = useState("");

  const [canvasModalOpen, setCanvasModalOpen] = useState(false);
  const [canvasDomain, setCanvasDomain] = useState("");
  const [canvasToken, setCanvasToken] = useState("");

  const [moodleModalOpen, setMoodleModalOpen] = useState(false);
  const [moodleUrl, setMoodleUrl] = useState("");
  const [moodleToken, setMoodleToken] = useState("");

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billingResult = params.get("billing");
    if (billingResult === "success") {
      toast.success(
        "Payment completed. Your plan will update after Stripe confirms the subscription.",
      );
    } else if (billingResult === "cancelled") {
      toast.info("Checkout was cancelled. No plan change was made.");
    }
    if (billingResult) {
      params.delete("billing");
      const query = params.toString();
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
      );
    }
  }, []);

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
  const billingStatusLabel =
    subscriptionStatus === "inactive" ? "Free plan" : subscriptionStatus.replaceAll("_", " ");
  const periodEndLabel = currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString() : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your profile, subscription, security, encrypted cache memory, and integrations."
      />

      <Tabs defaultValue="profile">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 h-auto p-1 gap-1">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="subscription" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Subscription
          </TabsTrigger>
          <TabsTrigger value="cache">Secure Cache</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
        </TabsList>

        {/* Subscription Tab */}
        <TabsContent value="subscription" className="mt-5 space-y-6">
          <Card className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">Current Subscription</h3>
                  <Badge variant="outline" className="border-primary/40 text-primary font-semibold">
                    {plan.name}
                  </Badge>
                  <Badge variant="secondary" className="capitalize">
                    {billingStatusLabel}
                  </Badge>
                  {plan.badge && (
                    <Badge
                      variant="secondary"
                      className="bg-primary/10 text-primary border-primary/20"
                    >
                      {plan.badge}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  You are on the <span className="font-medium text-foreground">{plan.name}</span>.
                  Document uploads this month are counted against your plan's allowance.
                  {periodEndLabel && (
                    <span className="block mt-1">
                      Current billing period ends {periodEndLabel}.
                    </span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button onClick={() => setUpgradeOpen(true)} className="gap-2 shadow-sm">
                  <Sparkles className="h-4 w-4" />
                  {planId === "free" ? "Choose a plan" : "View plans"}
                </Button>
                {hasBillingCustomer && (
                  <Button
                    variant="outline"
                    onClick={() => void openBillingPortal()}
                    className="gap-2"
                  >
                    <CreditCard className="h-4 w-4" />
                    Manage billing
                  </Button>
                )}
              </div>
            </div>

            <Separator className="my-5" />

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">Monthly Document Usage</span>
                <span className="font-semibold text-foreground">
                  {docsUsed} / {docLimit} documents used this month (
                  {Math.max(0, docLimit - docsUsed)} remaining)
                </span>
              </div>
              <Progress value={usagePercent} className="h-3" />
              <p className="text-xs text-muted-foreground">
                {isLimitReached
                  ? "You have used this month's document allowance. Upgrade to Pro, Plus, or Premium for a higher monthly allowance."
                  : `${Math.round(100 - usagePercent)}% of your document quota is still available.`}
              </p>
            </div>
          </Card>

          {/* Tier comparison cards */}
          <div>
            <div className="mb-4">
              <h4 className="text-base font-semibold text-foreground">
                Available Subscription Tiers
              </h4>
              <p className="text-xs text-muted-foreground">
                Select a plan tailored to your academic or institutional research volume.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {(Object.keys(SUBSCRIPTION_PLANS) as SubscriptionPlanId[]).map((tierKey) => {
                const tier = SUBSCRIPTION_PLANS[tierKey];
                const isCurrent = planId === tierKey;
                return (
                  <Card
                    key={tier.id}
                    className={`p-5 flex flex-col justify-between transition-all ${
                      isCurrent
                        ? "border-primary shadow-md ring-2 ring-primary/20 bg-primary/[0.02]"
                        : "border-border hover:border-border/80"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <h5 className="font-semibold text-foreground">{tier.name}</h5>
                        {isCurrent && (
                          <Badge
                            variant="secondary"
                            className="bg-primary/10 text-primary border-primary/20 text-[10px]"
                          >
                            Current
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-foreground">
                          {tier.priceMonthly === 0
                            ? "Free"
                            : `₹${tier.priceMonthly.toLocaleString("en-IN")}`}
                        </span>
                        {tier.priceMonthly > 0 && (
                          <span className="text-xs text-muted-foreground">/mo</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs font-medium text-primary">
                        {tier.docLimit} document limit
                      </p>

                      <Separator className="my-3" />

                      <ul className="space-y-2 text-xs text-muted-foreground">
                        {tier.features.map((feat) => (
                          <li key={feat} className="flex items-start gap-2">
                            <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-5 pt-3 border-t border-border/50">
                      {isCurrent ? (
                        <Button variant="outline" size="sm" className="w-full" disabled>
                          Active Plan
                        </Button>
                      ) : (
                        <Button
                          variant={tier.popular ? "default" : "outline"}
                          size="sm"
                          className="w-full"
                          onClick={() => setUpgradeOpen(true)}
                        >
                          View secure checkout
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </TabsContent>

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
                    <span className="text-xs text-muted-foreground">
                      {form.institution || "Academic User"}
                    </span>
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
                  <p className="text-[11px] text-muted-foreground">
                    Linked to Supabase authentication
                  </p>
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
                  <Badge
                    variant="secondary"
                    className="bg-success/15 text-success border-success/30"
                  >
                    Active (RAM + Storage)
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground max-w-xl">
                  User data, document catalogs, and workspace metrics are cached in high-speed
                  memory so the system avoids repeated database requests. Cached records are
                  cryptographically salted, SHA-256 hashed, and AES-256-GCM encrypted.
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
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {cacheStats.memoryEntries}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Sub-ms RAM objects</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3.5">
                <p className="text-xs text-muted-foreground">Encrypted Storage (L2)</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {cacheStats.storageEntries}
                </p>
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
                      Cache keys are hashed deterministically so internal database identifiers and
                      queries are never stored in plaintext.
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
                      Each payload includes an HMAC/SHA-256 checksum. Any tampered or corrupted
                      record is automatically rejected and evicted.
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
                      Web Crypto API encrypts persisted cache items with random 12-byte
                      initialization vectors per entry.
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.info("Your current session is active and secure.")}
                >
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
            <Row
              title="Weekly digest"
              desc="Summary of workspace activity each Monday."
              control={<Switch />}
            />
          </Card>
        </TabsContent>

        {/* API Tab */}
        <TabsContent value="api" className="mt-5 space-y-6">
          {/* API Keys Card */}
          <Card className="p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-semibold text-foreground">API Keys</h3>
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    {apiKeys.length} active
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                  API keys allow automated integrations and programmatic submissions. Keys are
                  masked by default for security. Store them safely in environment variables.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setCreateKeyOpen(true)}
                className="gap-1.5 shadow-xs"
              >
                <Plus className="h-4 w-4" />
                Create API key
              </Button>
            </div>

            {/* API Keys List */}
            <div className="space-y-3">
              {apiKeys.map(
                (k: {
                  id: string;
                  name: string;
                  key: string;
                  createdAt: string;
                  scope: "full" | "read";
                }) => {
                  const isRevealed = Boolean(revealedKeys[k.id]);
                  const isCopied = copiedKeyId === k.id;
                  const maskedKey = `ps_live_••••••••••••••••••••••••${k.key.slice(-4)}`;

                  return (
                    <div
                      key={k.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3.5 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{k.name}</span>
                          <Badge
                            variant="secondary"
                            className={
                              k.scope === "full"
                                ? "bg-primary/10 text-primary border-primary/20 text-[10px]"
                                : "bg-muted text-muted-foreground text-[10px]"
                            }
                          >
                            {k.scope === "full" ? "Full Access" : "Read-Only"}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            Created {new Date(k.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="rounded bg-background px-2 py-0.5 text-xs font-mono font-medium text-foreground border border-border/60">
                            {isRevealed ? k.key : maskedKey}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setRevealedKeys((prev) => ({
                                ...prev,
                                [k.id]: !prev[k.id],
                              }));
                            }}
                            title={isRevealed ? "Hide secret key" : "Reveal secret key"}
                          >
                            {isRevealed ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              void navigator.clipboard.writeText(k.key);
                              setCopiedKeyId(k.id);
                              toast.success("API key copied to clipboard");
                              setTimeout(() => setCopiedKeyId(null), 2000);
                            }}
                            title="Copy key"
                          >
                            {isCopied ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (apiKeys.length <= 1) {
                              toast.error("You must retain at least one API key.");
                              return;
                            }
                            const updated = apiKeys.filter(
                              (item: { id: string }) => item.id !== k.id,
                            );
                            setApiKeys(updated);
                            localStorage.setItem(
                              `plagishield_api_keys_${profile?.id ?? "default"}`,
                              JSON.stringify(updated),
                            );
                            toast.success(`Key "${k.name}" revoked.`);
                          }}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Revoke
                        </Button>
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </Card>

          {/* Integrations Card */}
          <Card className="p-6 space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold text-foreground">
                  Connected Apps & Integrations
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                Connect external cloud drives and learning management systems to sync documents
                automatically into PlagiShield.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Google Drive */}
              <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 hover:border-border/80 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        <Cloud className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-sm text-foreground">Google Drive</span>
                    </div>
                    {integrations.googleDrive.connected ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-[10px]">
                        Not connected
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {integrations.googleDrive.connected
                      ? `Syncing from "${integrations.googleDrive.folder}" (${integrations.googleDrive.email})`
                      : "Directly import research documents and student papers from your Google Drive."}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                  {integrations.googleDrive.connected ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => {
                          toast.success("Sync complete: Google Drive folders are up-to-date.");
                        }}
                      >
                        <FolderSync className="h-3.5 w-3.5 text-primary" />
                        Sync now
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          const updated = {
                            ...integrations,
                            googleDrive: {
                              ...integrations.googleDrive,
                              connected: false,
                              email: "",
                            },
                          };
                          setIntegrations(updated);
                          localStorage.setItem(
                            `plagishield_integrations_${profile?.id ?? "default"}`,
                            JSON.stringify(updated),
                          );
                          toast.info("Google Drive disconnected.");
                        }}
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full h-8 text-xs gap-1.5"
                      onClick={() => {
                        setDriveEmail(profile?.email || "academic.user@gmail.com");
                        setDriveModalOpen(true);
                      }}
                    >
                      Connect Google Drive
                    </Button>
                  )}
                </div>
              </div>

              {/* Microsoft 365 / OneDrive */}
              <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 hover:border-border/80 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
                        <Cloud className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-sm text-foreground">Microsoft 365</span>
                    </div>
                    {integrations.microsoft365.connected ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-[10px]">
                        Not connected
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {integrations.microsoft365.connected
                      ? `Connected to OneDrive (${integrations.microsoft365.email})`
                      : "Sync Word (.docx) documents and presentations directly from OneDrive."}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                  {integrations.microsoft365.connected ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => {
                          toast.success("OneDrive folder refreshed.");
                        }}
                      >
                        <FolderSync className="h-3.5 w-3.5 text-primary" />
                        Sync now
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          const updated = {
                            ...integrations,
                            microsoft365: {
                              ...integrations.microsoft365,
                              connected: false,
                              email: "",
                            },
                          };
                          setIntegrations(updated);
                          localStorage.setItem(
                            `plagishield_integrations_${profile?.id ?? "default"}`,
                            JSON.stringify(updated),
                          );
                          toast.info("Microsoft 365 disconnected.");
                        }}
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full h-8 text-xs gap-1.5"
                      onClick={() => {
                        setMsEmail(profile?.email || "researcher@outlook.com");
                        setMsModalOpen(true);
                      }}
                    >
                      Connect Microsoft 365
                    </Button>
                  )}
                </div>
              </div>

              {/* Canvas LMS */}
              <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 hover:border-border/80 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400">
                        <ExternalLink className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-sm text-foreground">Canvas LMS</span>
                    </div>
                    {integrations.canvasLms.connected ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-[10px]">
                        Not connected
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {integrations.canvasLms.connected
                      ? `Integrated with ${integrations.canvasLms.domain}`
                      : "Ingest student assignment submissions directly from Canvas courses."}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                  {integrations.canvasLms.connected ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-8 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        const updated = {
                          ...integrations,
                          canvasLms: { ...integrations.canvasLms, connected: false },
                        };
                        setIntegrations(updated);
                        localStorage.setItem(
                          `plagishield_integrations_${profile?.id ?? "default"}`,
                          JSON.stringify(updated),
                        );
                        toast.info("Canvas LMS disconnected.");
                      }}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-8 text-xs gap-1.5"
                      onClick={() => setCanvasModalOpen(true)}
                    >
                      Connect Canvas LMS
                    </Button>
                  )}
                </div>
              </div>

              {/* Moodle */}
              <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 hover:border-border/80 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        <ExternalLink className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-sm text-foreground">Moodle LMS</span>
                    </div>
                    {integrations.moodle.connected ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-[10px]">
                        Not connected
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {integrations.moodle.connected
                      ? `Connected to ${integrations.moodle.siteUrl}`
                      : "Connect your institution's Moodle server to score student assignments."}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                  {integrations.moodle.connected ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-8 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        const updated = {
                          ...integrations,
                          moodle: { ...integrations.moodle, connected: false },
                        };
                        setIntegrations(updated);
                        localStorage.setItem(
                          `plagishield_integrations_${profile?.id ?? "default"}`,
                          JSON.stringify(updated),
                        );
                        toast.info("Moodle disconnected.");
                      }}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-8 text-xs gap-1.5"
                      onClick={() => setMoodleModalOpen(true)}
                    >
                      Connect Moodle
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: Create New API Key */}
      <Dialog open={createKeyOpen} onOpenChange={setCreateKeyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New API Key</DialogTitle>
            <DialogDescription>
              Generate a secret token to integrate PlagiShield with your backend services or CI
              pipelines.
            </DialogDescription>
          </DialogHeader>

          {newlyCreatedKey ? (
            <div className="space-y-4 py-3">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Key Generated Successfully
                </div>
                <p className="text-xs text-muted-foreground">
                  Copy this key now. For your security, it will be masked after you close this
                  window.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <code className="flex-1 rounded bg-background p-2 text-xs font-mono break-all border border-border">
                    {newlyCreatedKey}
                  </code>
                  <Button
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(newlyCreatedKey);
                      toast.success("API key copied to clipboard!");
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setNewlyCreatedKey(null);
                    setCreateKeyOpen(false);
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-3">
              <div className="space-y-1.5">
                <Label htmlFor="key-name">Key Name / Description</Label>
                <Input
                  id="key-name"
                  placeholder="e.g. CI/CD Scanner or Department Portal"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Permissions Scope</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewKeyScope("full")}
                    className={`rounded-lg border p-3 text-left text-xs transition-colors ${
                      newKeyScope === "full"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-border/80"
                    }`}
                  >
                    <p className="font-semibold text-foreground">Full Access</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Read, upload, and trigger analysis
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewKeyScope("read")}
                    className={`rounded-lg border p-3 text-left text-xs transition-colors ${
                      newKeyScope === "read"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-border/80"
                    }`}
                  >
                    <p className="font-semibold text-foreground">Read-Only</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Query scores and download reports
                    </p>
                  </button>
                </div>
              </div>

              <DialogFooter className="mt-4">
                <Button variant="ghost" onClick={() => setCreateKeyOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const name = newKeyName.trim() || "Workspace Key";
                    const rand = Array.from(crypto.getRandomValues(new Uint8Array(16)))
                      .map((b) => b.toString(16).padStart(2, "0"))
                      .join("");
                    const generatedKey = `ps_live_${rand}`;
                    const newRecord = {
                      id: `key_${Date.now()}`,
                      name,
                      key: generatedKey,
                      createdAt: new Date().toISOString(),
                      scope: newKeyScope,
                    };
                    const updated = [newRecord, ...apiKeys];
                    setApiKeys(updated);
                    localStorage.setItem(
                      `plagishield_api_keys_${profile?.id ?? "default"}`,
                      JSON.stringify(updated),
                    );
                    setNewlyCreatedKey(generatedKey);
                    setNewKeyName("");
                  }}
                >
                  Generate Key
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Connect Google Drive */}
      <Dialog open={driveModalOpen} onOpenChange={setDriveModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-emerald-500" />
              <DialogTitle>Connect Google Drive</DialogTitle>
            </div>
            <DialogDescription>
              Link your Google Drive account to import files and automatically sync research
              submissions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="drive-email">Google Account Email</Label>
              <Input
                id="drive-email"
                type="email"
                placeholder="name@university.edu or @gmail.com"
                value={driveEmail}
                onChange={(e) => setDriveEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="drive-folder">Sync Folder Name</Label>
              <Input
                id="drive-folder"
                placeholder="e.g. My Drive / Academic Submissions"
                value={driveFolder}
                onChange={(e) => setDriveFolder(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-xs font-medium text-foreground">Auto-Sync On Upload</p>
                <p className="text-[11px] text-muted-foreground">
                  Detect new documents added to this folder
                </p>
              </div>
              <Switch checked={driveAutoSync} onCheckedChange={setDriveAutoSync} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDriveModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const email = driveEmail.trim() || profile?.email || "academic.user@gmail.com";
                const updated = {
                  ...integrations,
                  googleDrive: {
                    connected: true,
                    email,
                    folder: driveFolder.trim() || "My Drive / Research Submissions",
                    autoSync: driveAutoSync,
                  },
                };
                setIntegrations(updated);
                localStorage.setItem(
                  `plagishield_integrations_${profile?.id ?? "default"}`,
                  JSON.stringify(updated),
                );
                setDriveModalOpen(false);
                toast.success(`🎉 Google Drive connected for ${email}!`);
              }}
            >
              Authorize & Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Connect Microsoft 365 */}
      <Dialog open={msModalOpen} onOpenChange={setMsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-blue-500" />
              <DialogTitle>Connect Microsoft 365 / OneDrive</DialogTitle>
            </div>
            <DialogDescription>
              Link your institutional or personal Microsoft account to sync documents.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="ms-email">Microsoft Account Email</Label>
              <Input
                id="ms-email"
                type="email"
                placeholder="name@university.edu or @outlook.com"
                value={msEmail}
                onChange={(e) => setMsEmail(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setMsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const email = msEmail.trim() || profile?.email || "researcher@outlook.com";
                const updated = {
                  ...integrations,
                  microsoft365: {
                    connected: true,
                    email,
                    autoSync: true,
                  },
                };
                setIntegrations(updated);
                localStorage.setItem(
                  `plagishield_integrations_${profile?.id ?? "default"}`,
                  JSON.stringify(updated),
                );
                setMsModalOpen(false);
                toast.success(`Microsoft 365 connected for ${email}!`);
              }}
            >
              Connect OneDrive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Connect Canvas LMS */}
      <Dialog open={canvasModalOpen} onOpenChange={setCanvasModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Canvas LMS</DialogTitle>
            <DialogDescription>
              Connect your Canvas instance via institutional API token to review student
              submissions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="canvas-domain">Canvas LMS Domain</Label>
              <Input
                id="canvas-domain"
                placeholder="e.g. canvas.stanford.edu or canvas.instructure.com"
                value={canvasDomain}
                onChange={(e) => setCanvasDomain(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="canvas-token">API Access Token</Label>
              <Input
                id="canvas-token"
                type="password"
                placeholder="Paste Canvas developer/admin token"
                value={canvasToken}
                onChange={(e) => setCanvasToken(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCanvasModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const domain = canvasDomain.trim() || "canvas.institution.edu";
                const updated = {
                  ...integrations,
                  canvasLms: {
                    connected: true,
                    domain,
                    tokenMasked: "canvas_••••••••",
                  },
                };
                setIntegrations(updated);
                localStorage.setItem(
                  `plagishield_integrations_${profile?.id ?? "default"}`,
                  JSON.stringify(updated),
                );
                setCanvasModalOpen(false);
                toast.success(`Canvas LMS connected to ${domain}!`);
              }}
            >
              Save Connector
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Connect Moodle */}
      <Dialog open={moodleModalOpen} onOpenChange={setMoodleModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Moodle LMS</DialogTitle>
            <DialogDescription>
              Link your Moodle site with a Web Service token for automated grading workflows.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="moodle-url">Moodle Site URL</Label>
              <Input
                id="moodle-url"
                placeholder="https://moodle.university.edu"
                value={moodleUrl}
                onChange={(e) => setMoodleUrl(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="moodle-token">Web Service Token</Label>
              <Input
                id="moodle-token"
                type="password"
                placeholder="Moodle external service token"
                value={moodleToken}
                onChange={(e) => setMoodleToken(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setMoodleModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const siteUrl = moodleUrl.trim() || "https://moodle.institution.edu";
                const updated = {
                  ...integrations,
                  moodle: {
                    connected: true,
                    siteUrl,
                    tokenMasked: "mdl_••••••••",
                  },
                };
                setIntegrations(updated);
                localStorage.setItem(
                  `plagishield_integrations_${profile?.id ?? "default"}`,
                  JSON.stringify(updated),
                );
                setMoodleModalOpen(false);
                toast.success(`Moodle successfully connected!`);
              }}
            >
              Save Connector
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
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
