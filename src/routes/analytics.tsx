import { createFileRoute } from "@tanstack/react-router";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, PolarAngleAxis, PolarGrid,
  Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/layout/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, AlertTriangle, FileText, Sparkles } from "lucide-react";
import { useWorkspaceData, type AnalysisRow } from "@/hooks/use-workspace-data";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — PlagiShield AI" },
      { name: "description", content: "Workspace-wide integrity analytics, usage trends, and writing quality insights." },
      { property: "og:title", content: "Analytics — PlagiShield AI" },
      { property: "og:description", content: "Workspace-wide integrity analytics, usage trends, and writing quality insights." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

type GrammarIssue = { type?: string };
type Results = { grammar?: { issues?: GrammarIssue[] } };

function AnalyticsPage() {
  const { data, isLoading } = useWorkspaceData();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" description="Deep insights across your workspace." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const stats = data?.summaryStats;
  const analyses = (data?.analyses ?? []).filter((a) => a.status === "completed");
  const flagged = analyses.filter(
    (a) => Number(a.similarity_score ?? 0) >= 25 || Number(a.ai_score ?? 0) >= 50,
  ).length;

  const errorCounts = new Map<string, number>();
  for (const a of analyses as AnalysisRow[]) {
    const issues = ((a.results ?? {}) as Results).grammar?.issues ?? [];
    for (const issue of issues) {
      const key = (issue.type ?? "Other").trim() || "Other";
      errorCounts.set(key, (errorCounts.get(key) ?? 0) + 1);
    }
  }
  const commonErrors = [...errorCounts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const grammarRadar = [
    { subject: "Originality", score: 100 - (stats?.similarity ?? 0) },
    { subject: "Human voice", score: 100 - (stats?.aiDetection ?? 0) },
    { subject: "Grammar", score: stats?.grammar ?? 0 },
    { subject: "Citations", score: stats?.citation ?? 0 },
    { subject: "Overall", score: stats?.qualityScore ?? 0 },
  ];

  const hasData = (stats?.analyzed ?? 0) > 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Deep insights across your workspace." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Documents" value={String(stats?.totalDocuments ?? 0)} icon={FileText} tone="primary" />
        <StatCard label="Avg Similarity" value={`${stats?.similarity ?? 0}%`} icon={Activity} tone="success" />
        <StatCard label="Avg AI Detection" value={`${stats?.aiDetection ?? 0}%`} icon={Sparkles} tone="info" />
        <StatCard label="Flagged Documents" value={String(flagged)} icon={AlertTriangle} tone="warning" />
      </div>

      {!hasData ? (
        <Card className="p-10 text-center">
          <h3 className="text-base font-semibold text-foreground">No analytics yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload and analyze documents to populate workspace analytics.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Usage trends</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.submissionTrend ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="submissions" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="flagged" stroke="var(--color-destructive)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Writing quality radar</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={grammarRadar}>
                  <PolarGrid stroke="var(--color-border)" />
                  <PolarAngleAxis dataKey="subject" fontSize={11} stroke="var(--color-muted-foreground)" />
                  <Radar dataKey="score" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.25} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5 lg:col-span-2">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Most common errors</h3>
            {commonErrors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No grammar issues detected across analyzed documents.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={commonErrors} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis type="number" allowDecimals={false} fontSize={12} stroke="var(--color-muted-foreground)" />
                    <YAxis dataKey="type" type="category" fontSize={12} stroke="var(--color-muted-foreground)" width={130} />
                    <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
