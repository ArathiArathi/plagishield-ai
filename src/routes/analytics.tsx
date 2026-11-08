import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  FileText,
  CheckCircle2,
  FileSearch,
  Layers,
  Search,
  ExternalLink,
  BarChart3,
  PieChart as PieChartIcon,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceData, type AnalysisRow } from "@/hooks/use-workspace-data";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Review History & Analytics — PlagiShield AI" },
      {
        name: "description",
        content:
          "Interactive charts, similarity distribution, and evidence metrics for your workspace.",
      },
    ],
  }),
  component: AnalyticsPage,
});

type SavedResults = {
  plagiarism?: {
    score?: number;
    matched_words?: number;
    eligible_words?: number;
    excluded_words?: number;
    matches?: Array<{ source?: string; url?: string }>;
    source_coverage?: { sources_retrieved?: number };
  };
  ai_detection?: {
    score?: number;
    confidence?: string;
    highlights?: Array<unknown>;
  };
  grammar?: { issues?: Array<{ type?: string; message?: string }> };
  citations?: { issues?: string[] };
};

const SIMILARITY_COLORS = {
  low: "#10b981", // Emerald green (< 15%)
  moderate: "#f59e0b", // Amber gold (15% - 30%)
  high: "#ef4444", // Crimson red (> 30%)
};

function getSimilarityColor(score: number): string {
  if (score < 15) return SIMILARITY_COLORS.low;
  if (score <= 30) return SIMILARITY_COLORS.moderate;
  return SIMILARITY_COLORS.high;
}

function getSimilarityBadgeClass(score: number): string {
  if (score < 15) {
    return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
  }
  if (score <= 30) {
    return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
  }
  return "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30";
}

function AnalyticsPage() {
  const { data, isLoading } = useWorkspaceData();
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | "low" | "moderate" | "high">("all");

  const documents = useMemo(() => data?.documents ?? [], [data?.documents]);
  const analyses = useMemo(() => (data?.analyses ?? []) as AnalysisRow[], [data?.analyses]);
  const completed = useMemo(
    () => analyses.filter((analysis) => analysis.status === "completed"),
    [analyses],
  );
  const summary = data?.summaryStats;

  const rows = useMemo(() => {
    return completed.map((analysis) => {
      const document = documents.find((item) => item.id === analysis.document_id);
      const result = (analysis.results ?? {}) as SavedResults;
      const sim = Math.round(Number(analysis.similarity_score ?? result.plagiarism?.score ?? 0));
      return {
        analysis,
        documentName: document?.name ?? "Untitled Document",
        documentId: analysis.document_id,
        similarity: isNaN(sim) ? 0 : sim,
        sourceMatches: result.plagiarism?.matches?.length ?? 0,
        matchedWords: Math.max(0, Math.round(Number(result.plagiarism?.matched_words ?? 0))),
        comparedWords: Math.max(0, Math.round(Number(result.plagiarism?.eligible_words ?? 0))),
        excludedWords: Math.max(0, Math.round(Number(result.plagiarism?.excluded_words ?? 0))),
        grammarIssues: result.grammar?.issues?.length ?? 0,
        createdAt: analysis.created_at,
      };
    });
  }, [completed, documents]);

  // Aggregated Grammar Issues
  const issueCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const analysis of completed) {
      const result = (analysis.results ?? {}) as SavedResults;
      for (const issue of result.grammar?.issues ?? []) {
        const kind = issue.type?.trim() || "Spelling & Typography";
        counts.set(kind, (counts.get(kind) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [completed]);

  // Chart Data: Similarity Bar Chart
  const similarityChartData = useMemo(() => {
    return rows.slice(-10).map((r) => ({
      name: r.documentName.length > 18 ? `${r.documentName.slice(0, 16)}…` : r.documentName,
      fullName: r.documentName,
      similarity: r.similarity,
      matchedWords: r.matchedWords,
      fill: getSimilarityColor(r.similarity),
    }));
  }, [rows]);

  // Chart Data: Content Composition Pie Chart
  const compositionData = useMemo(() => {
    const totalMatched = rows.reduce((acc, r) => acc + r.matchedWords, 0);
    const totalCompared = rows.reduce((acc, r) => acc + r.comparedWords, 0);
    const totalExcluded = rows.reduce((acc, r) => acc + r.excludedWords, 0);
    const totalOriginal = Math.max(0, totalCompared - totalMatched);

    if (totalCompared === 0 && totalExcluded === 0) {
      return [
        { name: "Original text", value: 100, color: "#10b981" },
        { name: "Matched passages", value: 0, color: "#ef4444" },
      ];
    }

    return [
      { name: "Original text", value: totalOriginal, color: "#10b981" },
      { name: "Matched passages", value: totalMatched, color: "#ef4444" },
      { name: "Citations & quotes", value: totalExcluded, color: "#8b5cf6" },
    ].filter((d) => d.value > 0);
  }, [rows]);

  // Filtered rows for the table
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesSearch = row.documentName.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (riskFilter === "low") return row.similarity < 15;
      if (riskFilter === "moderate") return row.similarity >= 15 && row.similarity <= 30;
      if (riskFilter === "high") return row.similarity > 30;
      return true;
    });
  }, [rows, searchQuery, riskFilter]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Review History & Analytics"
          description="Totals from the analyses saved in your workspace."
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Review History & Analytics"
        description="Comprehensive similarity metrics, content composition, and source evidence."
      />

      {/* Colorful Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative overflow-hidden rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Total Documents</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-foreground">
            {summary?.totalDocuments ?? documents.length}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Uploaded to workspace</p>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Completed Analyses
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-foreground">
            {summary?.analyzed ?? completed.length}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Scored with verified evidence</p>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              Source Records Matched
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <FileSearch className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-foreground">
            {summary?.matchedSourceRecords ?? 0}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Indexed academic repositories</p>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-rose-500/20 bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">Matched Words</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-foreground">
            {Number(summary?.matchedWords ?? 0).toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Deduplicated across findings</p>
        </div>
      </div>

      {/* Colorful Interactive Graphs Section */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Graph 1: Document Similarity Distribution */}
        <Card className="p-6 lg:col-span-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h3 className="text-base font-semibold text-foreground">Similarity Distribution</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Observed overlap % across recently reviewed documents
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> &lt;15%
              </span>
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> 15-30%
              </span>
              <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> &gt;30%
              </span>
            </div>
          </div>

          <div className="mt-4 h-64 w-full">
            {similarityChartData.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <Sparkles className="h-8 w-8 text-muted-foreground/40" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No document analyses recorded yet.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={similarityChartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    angle={-20}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-border bg-popover p-3 shadow-lg text-xs space-y-1">
                          <p className="font-semibold text-foreground">{item.fullName}</p>
                          <p className="text-primary font-medium">Similarity: {item.similarity}%</p>
                          <p className="text-muted-foreground">
                            Matched Words: {item.matchedWords.toLocaleString()}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="similarity" radius={[4, 4, 0, 0]}>
                    {similarityChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Graph 2: Content Composition Breakdown */}
        <Card className="p-6 lg:col-span-5">
          <div className="border-b border-border/60 pb-4">
            <div className="flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-emerald-500" />
              <h3 className="text-base font-semibold text-foreground">Content Composition</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cumulative ratio of original, matched, and cited words
            </p>
          </div>

          <div className="mt-4 flex flex-col items-center">
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={compositionData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {compositionData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number, name: string) => [
                      `${val.toLocaleString()} words`,
                      name,
                    ]}
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="w-full mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center text-xs">
              <div>
                <p className="text-[11px] text-muted-foreground">Original</p>
                <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {compositionData
                    .find((d) => d.name === "Original text")
                    ?.value.toLocaleString() ?? 0}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Matched</p>
                <p className="font-semibold text-rose-600 dark:text-rose-400">
                  {compositionData
                    .find((d) => d.name === "Matched passages")
                    ?.value.toLocaleString() ?? 0}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Citations</p>
                <p className="font-semibold text-purple-600 dark:text-purple-400">
                  {compositionData
                    .find((d) => d.name === "Citations & quotes")
                    ?.value.toLocaleString() ?? 0}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Review History Table with Search & Filter */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Completed Document Reviews</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Detailed findings from all completed analyses with direct report links.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search documents…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setRiskFilter("all")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  riskFilter === "all"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setRiskFilter("low")}
                className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  riskFilter === "low"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-emerald-600 dark:text-emerald-400 hover:text-emerald-500"
                }`}
              >
                &lt;15%
              </button>
              <button
                type="button"
                onClick={() => setRiskFilter("moderate")}
                className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  riskFilter === "moderate"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-amber-600 dark:text-amber-400 hover:text-amber-500"
                }`}
              >
                15-30%
              </button>
              <button
                type="button"
                onClick={() => setRiskFilter("high")}
                className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  riskFilter === "high"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "text-rose-600 dark:text-rose-400 hover:text-rose-500"
                }`}
              >
                &gt;30%
              </button>
            </div>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="p-10 text-center">
            <ShieldAlert className="mx-auto h-7 w-7 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-medium text-foreground">
              {rows.length === 0
                ? "No completed analyses to summarise yet."
                : "No reviews match your search filter."}
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link to="/documents">Upload a document</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Document</th>
                  <th className="px-3 py-3 text-right font-medium">Similarity</th>
                  <th className="px-3 py-3 text-right font-medium">Sources</th>
                  <th className="px-3 py-3 text-right font-medium">Matched Words</th>
                  <th className="px-3 py-3 text-right font-medium">Compared Words</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRows.map((row) => (
                  <tr key={row.analysis.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="max-w-[280px] truncate font-medium text-foreground">
                        {row.documentName}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {new Date(row.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <Badge
                        variant="secondary"
                        className={`font-semibold border text-xs px-2 py-0.5 ${getSimilarityBadgeClass(row.similarity)}`}
                      >
                        {row.similarity}%
                      </Badge>
                    </td>
                    <td className="px-3 py-3.5 text-right tabular-nums text-foreground">
                      {row.sourceMatches}
                    </td>
                    <td className="px-3 py-3.5 text-right tabular-nums text-foreground">
                      {row.matchedWords.toLocaleString()}
                    </td>
                    <td className="px-3 py-3.5 text-right tabular-nums text-muted-foreground">
                      {row.comparedWords.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to="/analysis"
                          search={{ doc: row.documentId }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          Review <ExternalLink className="h-3 w-3" />
                        </Link>
                        <span className="text-muted-foreground/40">·</span>
                        <Link
                          to="/reports"
                          search={{ doc: row.documentId }}
                          className="text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          Report
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Grammar and Exclusions Insights */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground">
            Comparison & Exclusions Breakdown
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Words evaluated vs excluded under verified academic citation rules.
          </p>
          <dl className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <dt className="text-muted-foreground">Words included in comparison</dt>
              <dd className="font-semibold text-foreground tabular-nums">
                {Number(summary?.comparedWords ?? 0).toLocaleString()}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <dt className="text-muted-foreground">Words excluded by quote/reference rules</dt>
              <dd className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {Number(summary?.excludedWords ?? 0).toLocaleString()}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <dt className="text-muted-foreground">Source records retrieved</dt>
              <dd className="font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
                {Number(summary?.sourcesRetrieved ?? 0).toLocaleString()}
              </dd>
            </div>
          </dl>
          <p className="mt-4 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
            Academic quotes in quotation marks and bibliography sections are automatically detected
            and excluded from similarity score counts to avoid false positives.
          </p>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground">Grammar & Language Issues</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Categories identified across completed reviews.
          </p>
          {issueCounts.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">
              No language issues flagged across analyzed documents.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border/60">
              {issueCounts.slice(0, 5).map(([kind, count]) => (
                <li key={kind} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                  <span className="font-medium text-foreground">{kind}</span>
                  <Badge
                    variant="secondary"
                    className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
                  >
                    {count}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
