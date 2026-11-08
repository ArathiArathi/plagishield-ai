import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceData, type AnalysisRow } from "@/hooks/use-workspace-data";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Review history — PlagiShield" },
      { name: "description", content: "Document review totals and source evidence returned in your workspace." },
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
  grammar?: { issues?: Array<{ type?: string }> };
  citations?: { issues?: string[] };
};

function AnalyticsPage() {
  const { data, isLoading } = useWorkspaceData();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Review history" description="Totals from the analyses saved in your workspace." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 w-full" />)}</div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const documents = data?.documents ?? [];
  const analyses = (data?.analyses ?? []) as AnalysisRow[];
  const completed = analyses.filter((analysis) => analysis.status === "completed");
  const summary = data?.summaryStats;
  const issueCounts = new Map<string, number>();

  for (const analysis of completed) {
    const result = (analysis.results ?? {}) as SavedResults;
    for (const issue of result.grammar?.issues ?? []) {
      const kind = issue.type?.trim() || "Other";
      issueCounts.set(kind, (issueCounts.get(kind) ?? 0) + 1);
    }
  }

  const commonIssues = [...issueCounts.entries()].sort((a, b) => b[1] - a[1]);
  const rows = completed.map((analysis) => {
    const document = documents.find((item) => item.id === analysis.document_id);
    const result = (analysis.results ?? {}) as SavedResults;
    return {
      analysis,
      documentName: document?.name ?? "Document not found",
      similarity: Number(analysis.similarity_score ?? result.plagiarism?.score ?? 0),
      sourceMatches: result.plagiarism?.matches?.length ?? 0,
      matchedWords: Number(result.plagiarism?.matched_words ?? 0),
      comparedWords: Number(result.plagiarism?.eligible_words ?? 0),
    };
  });

  return (
    <div className="space-y-7">
      <PageHeader title="Review history" description="A factual summary of the analyses saved in your workspace." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Documents" value={summary?.totalDocuments ?? documents.length} />
        <Summary label="Completed analyses" value={summary?.analyzed ?? completed.length} />
        <Summary label="Source records matched" value={summary?.matchedSourceRecords ?? 0} />
        <Summary label="Matched words" value={Number(summary?.matchedWords ?? 0).toLocaleString()} />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">Completed document reviews</h2>
          <p className="mt-1 text-xs text-muted-foreground">Similarity is calculated from the retrieved source records for each analysis.</p>
        </div>
        {rows.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No completed analyses to summarise yet.</p>
            <Link to="/documents" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">Upload a document</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Document</th>
                  <th className="px-3 py-3 text-right font-medium">Observed similarity</th>
                  <th className="px-3 py-3 text-right font-medium">Source records</th>
                  <th className="px-3 py-3 text-right font-medium">Matched words</th>
                  <th className="px-5 py-3 text-right font-medium">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.analysis.id} className="hover:bg-muted/20">
                    <td className="px-5 py-4">
                      <p className="max-w-[280px] truncate font-medium text-foreground">{row.documentName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{new Date(row.analysis.created_at).toLocaleDateString()}</p>
                    </td>
                    <td className="px-3 py-4 text-right tabular-nums">{row.similarity}%</td>
                    <td className="px-3 py-4 text-right tabular-nums">{row.sourceMatches}</td>
                    <td className="px-3 py-4 text-right tabular-nums">{row.matchedWords.toLocaleString()}</td>
                    <td className="px-5 py-4 text-right"><Link to="/analysis" search={{ doc: row.analysis.document_id }} className="text-xs font-medium text-primary hover:underline">Open review</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-foreground">Comparison totals</h2>
          <dl className="mt-4 space-y-3">
            <Row label="Words included in comparison" value={Number(summary?.comparedWords ?? 0).toLocaleString()} />
            <Row label="Words excluded by quote/reference rules" value={Number(summary?.excludedWords ?? 0).toLocaleString()} />
            <Row label="Source records retrieved" value={Number(summary?.sourcesRetrieved ?? 0).toLocaleString()} />
          </dl>
          <p className="mt-4 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
            Source records can overlap. Matched-word totals are deduplicated within each document, not across separate documents.
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-foreground">Grammar issue categories</h2>
          <p className="mt-1 text-xs text-muted-foreground">Counts returned by the enabled grammar checker across completed reviews.</p>
          {commonIssues.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">No grammar issue records were returned.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {commonIssues.map(([kind, count]) => (
                <li key={kind} className="flex items-center justify-between gap-3 py-3">
                  <span className="text-sm text-foreground">{kind}</span>
                  <Badge variant="secondary">{count}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="max-w-3xl text-xs leading-5 text-muted-foreground">
        These figures describe saved analysis results only. They are not institution-wide benchmarks. A low or zero similarity result does not establish originality, because sources outside the connected indexes may not have been retrieved.
      </p>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-b border-border px-1 py-4 sm:border-b-0 sm:border-l sm:pl-4 first:border-l-0 first:pl-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 font-serif text-3xl tabular-nums tracking-tight text-foreground">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-sm font-medium tabular-nums text-foreground">{value}</dd></div>;
}
