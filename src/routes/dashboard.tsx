import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Activity, AlertTriangle, CheckCircle2, FileBarChart, Upload,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/layout/StatCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { useAnalysisQueue } from "@/hooks/use-analysis-queue";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — PlagiShield AI" },
      { name: "description", content: "Overview of documents, observed text matches, and source coverage in your workspace." },
      { property: "og:title", content: "Dashboard — PlagiShield AI" },
      { property: "og:description", content: "Document activity and evidence-backed text comparison results." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { data, isPending } = useWorkspaceData();
  useAnalysisQueue();

  const firstName =
    profile?.first_name ||
    (user?.user_metadata?.first_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "there";

  const stats = data?.summaryStats;
  const hasAnalyses = (stats?.analyzed ?? 0) > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Here's what's happening across your workspace today."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/reports" search={{ doc: undefined }}><FileBarChart className="mr-1.5 h-4 w-4" />View reports</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/documents"><Upload className="mr-1.5 h-4 w-4" />Upload document</Link>
            </Button>
          </>
        }
      />

      {isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Documents" value={(stats?.totalDocuments ?? 0).toLocaleString()} icon={FileBarChart} tone="primary" />
          <StatCard label="Completed reviews" value={(stats?.analyzed ?? 0).toLocaleString()} icon={Activity} tone="primary" />
          <StatCard label="Average observed overlap" value={stats?.analyzed ? stats.similarity : "—"} suffix={stats?.analyzed ? "%" : undefined} icon={FileBarChart} tone="primary" />
          <StatCard label="Documents with matches" value={(stats?.matchedDocuments ?? 0).toLocaleString()} icon={AlertTriangle} tone="warning" />
        </div>
      )}

      {!isPending && (stats?.totalDocuments ?? 0) === 0 && (
        <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">No documents yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload your first document to compare its text with available public sources and review the evidence.
            </p>
          </div>
          <Button size="sm" asChild><Link to="/documents">Upload a document</Link></Button>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Document activity</h3>
              <p className="text-xs text-muted-foreground">Uploads and completed analyses by month</p>
            </div>
            <Badge variant="secondary" className="font-normal">Last 7 months</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.submissionTrend ?? []}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="submissions" stroke="var(--color-primary)" strokeWidth={2} fill="url(#g1)" />
                <Area type="monotone" dataKey="analyses" stroke="var(--color-success)" strokeWidth={2} fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground">What the numbers mean</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Similarity is the observed share of eligible words matched in retrieved public sources. It is not a plagiarism verdict.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4">
            <div>
              <p className="text-2xl font-semibold text-foreground">{Number(stats?.matchedWords ?? 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Matched words</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{Number(stats?.sourceRecordsRetrieved ?? 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Source records retrieved</p>
            </div>
          </div>
          <p className="mt-4 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
            AI authorship scoring is not assessed. Private student-paper repositories and licensed publisher full text are not connected.
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Observed similarity distribution</h3>
              <p className="text-xs text-muted-foreground">Completed reviews grouped by observed overlap</p>
            </div>
          </div>
          <div className="h-56">
            {hasAnalyses ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.similarityDistribution ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="range" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {(data?.similarityDistribution ?? []).map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="Similarity data appears after your first analysis" />
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Recent activity</h3>
            <Link to="/documents" className="text-xs font-medium text-primary hover:underline">View all</Link>
          </div>
          {(data?.recentActivity ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {(data?.recentActivity ?? []).map((a) => {
                const tone =
                  a.status === "success" ? "bg-success/15 text-success" :
                  a.status === "warning" ? "bg-warning/20 text-warning" :
                  a.status === "error" ? "bg-destructive/15 text-destructive" :
                  "bg-info/15 text-info";
                const Icon = a.status === "warning" || a.status === "error" ? AlertTriangle : a.status === "success" ? CheckCircle2 : Activity;
                return (
                  <li key={a.id} className="flex items-start gap-3">
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.action} · {a.time}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border">
      <p className="px-6 text-center text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
