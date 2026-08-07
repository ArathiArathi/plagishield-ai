import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Activity, AlertTriangle, CheckCircle2, FileBarChart, FileText, Gauge,
  PercentIcon, Sparkles, Upload,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/layout/StatCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspaceData } from "@/hooks/use-workspace-data";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — PlagiShield AI" },
      { name: "description", content: "Overview of plagiarism, AI detection, and writing quality across your workspace." },
      { property: "og:title", content: "Dashboard — PlagiShield AI" },
      { property: "og:description", content: "Live integrity metrics across every document in your workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();
  const { data, isPending } = useWorkspaceData();

  const firstName =
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
              <Link to="/reports"><FileBarChart className="mr-1.5 h-4 w-4" />View reports</Link>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Quality Score" value={stats?.qualityScore ?? 0} suffix="/100" icon={Gauge} tone="primary" />
          <StatCard label="Similarity" value={stats?.similarity ?? 0} suffix="%" icon={PercentIcon} tone="success" />
          <StatCard label="AI Detection" value={stats?.aiDetection ?? 0} suffix="%" icon={Sparkles} tone="info" />
          <StatCard label="Grammar" value={stats?.grammar ?? 0} suffix="/100" icon={CheckCircle2} tone="success" />
          <StatCard label="Citation" value={stats?.citation ?? 0} suffix="/100" icon={FileText} tone="warning" />
          <StatCard label="Total Documents" value={(stats?.totalDocuments ?? 0).toLocaleString()} icon={Activity} tone="primary" />
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
              Upload your first document to run plagiarism, AI, grammar, and citation analysis.
            </p>
          </div>
          <Button size="sm" asChild><Link to="/documents">Upload a document</Link></Button>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Submission Trends</h3>
              <p className="text-xs text-muted-foreground">Total submissions and flagged documents</p>
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
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-destructive)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--color-destructive)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="submissions" stroke="var(--color-primary)" strokeWidth={2} fill="url(#g1)" />
                <Area type="monotone" dataKey="flagged" stroke="var(--color-destructive)" strokeWidth={2} fill="url(#g2)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">AI Content Analysis</h3>
            <p className="text-xs text-muted-foreground">Distribution of detected content</p>
          </div>
          <div className="h-64">
            {hasAnalyses ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data?.aiContentAnalysis ?? []} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>
                    {(data?.aiContentAnalysis ?? []).map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="No completed analyses yet" />
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Similarity Distribution</h3>
              <p className="text-xs text-muted-foreground">Documents grouped by similarity range</p>
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
