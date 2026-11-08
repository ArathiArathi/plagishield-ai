import { createFileRoute } from "@tanstack/react-router";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/layout/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, AlertTriangle, FileSearch, FileText } from "lucide-react";
import { useWorkspaceData, type AnalysisRow } from "@/hooks/use-workspace-data";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — PlagiShield" },
      { name: "description", content: "Document activity, observed text matches and source coverage." },
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
        <PageHeader title="Analytics" description="Counts and trends from completed document reviews." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 w-full" />)}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const stats = data?.summaryStats;
  const analyses = (data?.analyses ?? []).filter((analysis) => analysis.status === "completed" && (analysis.results as { meta?: { engine_version?: string } } | null)?.meta?.engine_version === "3.0.0");
  const errorCounts = new Map<string, number>();
  for (const analysis of analyses as AnalysisRow[]) {
    const issues = ((analysis.results ?? {}) as Results).grammar?.issues ?? [];
    for (const issue of issues) {
      const key = (issue.type ?? "Other").trim() || "Other";
      errorCounts.set(key, (errorCounts.get(key) ?? 0) + 1);
    }
  }
  const commonErrors = [...errorCounts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const hasData = (stats?.analyzed ?? 0) > 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Counts and trends from the current analysis engine." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Documents" value={String(stats?.totalDocuments ?? 0)} icon={FileText} tone="primary" />
        <StatCard label="Current-engine reviews" value={String(stats?.analyzed ?? 0)} icon={Activity} tone="primary" />
        <StatCard label="Average observed overlap" value={`${stats?.similarity ?? 0}%`} icon={FileSearch} tone="primary" />
        <StatCard label="Documents with matches" value={String(stats?.matchedDocuments ?? 0)} icon={AlertTriangle} tone="warning" />
      </div>

      {!hasData ? (
        <Card className="p-8">
          <h3 className="text-sm font-semibold text-foreground">No current-engine analytics yet</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Re-run older analyses or upload a document. Only analyses created with the current evidence and reporting engine are included in these averages.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-1 text-sm font-semibold text-foreground">Document activity</h3>
            <p className="mb-4 text-xs text-muted-foreground">Uploads and completed analyses by month</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.submissionTrend ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }} />
                  <Line type="monotone" dataKey="submissions" name="Uploads" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="analyses" name="Completed analyses" stroke="var(--color-success)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-1 text-sm font-semibold text-foreground">Observed similarity distribution</h3>
            <p className="mb-4 text-xs text-muted-foreground">Current-engine reviews grouped by matched-word percentage</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.similarityDistribution ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="range" stroke="var(--color-muted-foreground)" fontSize={11} />
                  <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }} />
                  <Bar dataKey="count" name="Documents" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5 lg:col-span-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">Language checker findings</h3>
              <span className="text-xs text-muted-foreground">{Number(stats?.grammarIssues ?? 0).toLocaleString()} findings across current-engine reviews</span>
            </div>
            {commonErrors.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">The configured language checker returned no issues.</p>
            ) : (
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={commonErrors} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis type="number" allowDecimals={false} fontSize={12} stroke="var(--color-muted-foreground)" />
                    <YAxis dataKey="type" type="category" fontSize={12} stroke="var(--color-muted-foreground)" width={130} />
                    <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }} />
                    <Bar dataKey="count" name="Findings" fill="var(--color-primary)" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>
      )}

      <p className="text-xs leading-5 text-muted-foreground">
        Similarity is observed overlap in the public source records retrieved for each paper. These charts are descriptive; they are not risk ratings or plagiarism decisions. AI authorship scoring is not assessed.
      </p>
    </div>
  );
}
