import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Bot, Download, FileBarChart, FileSearch, FileStack, Quote, SpellCheck } from "lucide-react";
import { toast } from "sonner";
import { downloadReport, type ReportInput, type ReportKind } from "@/lib/report-pdf";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { HighlightedDocument } from "@/components/analysis/HighlightedDocument";
import { IssueList } from "@/components/analysis/IssueList";
import type { CompositionSlice, Highlight, IssueItem } from "@/components/analysis/analysis-shared";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — PlagiShield AI" },
      { name: "description", content: "Generate and export integrity reports from real document analysis results." },
      { property: "og:title", content: "Reports — PlagiShield AI" },
      { property: "og:description", content: "Generate and export integrity reports from real document analysis results." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    doc: typeof search.doc === "string" ? search.doc : undefined,
  }),
  component: ReportsPage,
});

type Results = {
  text_excerpt?: string;
  document_text?: string;
  meta?: { engine_version?: string; extraction?: string; words?: number; sentences?: number; sources_queried?: number; checked_at?: string };
  plagiarism?: {
    score?: number;
    matched_words?: number;
    eligible_words?: number;
    excluded_words?: number;
    matches?: Array<{ source?: string; url?: string; similarity?: number; snippet?: string; matched_snippet?: string; type?: string; provider?: string; matched_words?: number; match_count?: number; domain?: string }>;
    highlights?: Highlight[];
    source_coverage?: { sources_retrieved?: number; providers?: string[]; matching_method?: string; limitation?: string };
  };
  ai_detection?: { confidence?: string; reasoning?: string; highlights?: Highlight[] };
  grammar?: { issues?: Array<{ type?: string; severity?: string; text?: string; suggestion?: string }>; highlights?: Highlight[] };
  citations?: { total?: number; verified?: number; issues?: string[] };
  composition?: CompositionSlice[];
  issues?: IssueItem[];
};


function ReportsPage() {
  const { doc } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data, isLoading } = useWorkspaceData();

  const analyses = (data?.analyses ?? []).filter((a) => a.status === "completed");
  const reportable = (data?.documents ?? []).filter((d) => analyses.some((a) => a.document_id === d.id));
  const selected = reportable.find((d) => d.id === doc) ?? reportable[0];
  const analysis = analyses.find((a) => a.document_id === selected?.id);
  const results = (analysis?.results ?? {}) as Results;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reports" description="Professional, exportable summaries of every analysis." />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!selected || !analysis) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reports" description="Professional, exportable summaries of every analysis." />
        <Card className="p-10 text-center">
          <FileBarChart className="mx-auto h-6 w-6 text-muted-foreground" />
          <h3 className="mt-3 text-base font-semibold text-foreground">No reports yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Reports are generated automatically once a document has been analyzed.
          </p>
          <Button asChild size="sm" className="mt-4"><Link to="/documents">Upload a document</Link></Button>
        </Card>
      </div>
    );
  }

  const similarity = Math.round(Number(analysis.similarity_score ?? 0));
  const ai = Math.round(Number(analysis.ai_score ?? 0));
  const grammar = Math.round(Number(analysis.grammar_score ?? 0));
  const citation = Math.round(Number(analysis.citation_score ?? 0));
  const matches = results.plagiarism?.matches ?? [];
  const grammarIssues = results.grammar?.issues ?? [];
  const citationIssues = results.citations?.issues ?? [];

  const engineIssues = results.issues ?? [];
  const allHighlights: Highlight[] = [
    ...(results.plagiarism?.highlights ?? []),
    ...(results.ai_detection?.highlights ?? []),
    ...(results.grammar?.highlights ?? []),
  ];

  const reportInput: ReportInput = {
    documentName: selected.name,
    fileType: selected.file_type,
    version: selected.latest_version,
    analysisId: analysis.id,
    generatedAt: results.meta?.checked_at ? new Date(results.meta.checked_at).toLocaleString() : new Date(analysis.updated_at ?? analysis.created_at).toLocaleString(),
    docType: selected.doc_type,
    authorName: selected.author_name,
    paperTitle: selected.paper_title,
    similarity, ai, grammar, citation,
    results: results as ReportInput["results"],
  };


  const bundle: Array<{ kind: ReportKind; title: string; desc: string; icon: typeof FileSearch; metric: string }> = [
    { kind: "similarity", title: "Similarity Report", desc: `Matched sources, overlap index and per-source match table (${matches.length} source${matches.length === 1 ? "" : "s"}).`, icon: FileSearch, metric: `${similarity}% similarity` },
    { kind: "ai", title: "Writing-pattern Review", desc: "Experimental style signals for cautious human review; not an authorship verdict.", icon: Bot, metric: `${results.ai_detection?.highlights?.length ?? 0} passages` },
    { kind: "grammar", title: "Grammar & Language Report", desc: `Corrections returned by the enabled grammar checker (${grammarIssues.length} issues).`, icon: SpellCheck, metric: `${grammarIssues.length} issues` },
    { kind: "citation", title: "Reference Lookup Report", desc: `Reference-title lookups and warnings from connected scholarly indexes (${citationIssues.length}).`, icon: Quote, metric: `${citationIssues.length} warnings` },
    { kind: "full", title: "Comprehensive Report", desc: "All four modules combined into a single institutional integrity dossier.", icon: FileStack, metric: "All modules" },
  ];

  const download = (kind: ReportKind) => {
    try {
      downloadReport(kind, reportInput);
      toast.success(`${bundle.find((b) => b.kind === kind)?.title} downloaded`);
    } catch (e: unknown) {
      console.error(`Could not generate ${kind} report:`, e);
      toast.error("Could not generate the PDF. Please try again.");
    }
  };

  const downloadAll = () => {
    try {
      downloadReport("full", reportInput);
      toast.success("Comprehensive Integrity Dossier (All Modules) downloaded");
    } catch (e: unknown) {
      console.error("Could not generate Comprehensive Dossier:", e);
      toast.error("Could not generate the dossier PDF. Please try downloading individual module reports.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Professional summaries generated from real analysis results."
        actions={
          <>
            <Select value={selected.id} onValueChange={(v) => navigate({ search: { doc: v } })}>
              <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {reportable.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={downloadAll}>
              <Download className="mr-1.5 h-4 w-4" />Download Full Dossier (PDF)
            </Button>
          </>
        }
      />

      <Card className="border-warning/30 bg-warning/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Interpret automated findings with care</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Similarity scores depend on the sources retrieved for this document and do not guarantee complete repository coverage.
              AI-style indicators cannot prove who wrote a passage. Open the matched-source evidence and review context before drawing conclusions.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Report files</h3>
            <p className="text-sm text-muted-foreground">Each module is exported from the saved analysis evidence. No sample metrics are added.</p>
          </div>
          <Badge variant="secondary">{bundle.length} files available</Badge>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {bundle.map((b) => (
            <div key={b.kind} className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-4">
              <div className="rounded-md bg-primary/10 p-2 text-primary"><b.icon className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{b.title}</p>
                  <Badge variant="outline" className="shrink-0 text-[10px]">{b.metric}</Badge>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{b.desc}</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => download(b.kind)}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />Download PDF
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>


      <Card className="overflow-hidden">
        <div className="border-b border-border bg-[image:var(--gradient-subtle)] p-6 min-w-0">
          <div className="flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-primary shrink-0" />
            <Badge variant="secondary">Report · {analysis.id.slice(0, 8).toUpperCase()}</Badge>
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-foreground break-words [overflow-wrap:anywhere]">{selected.name}</h2>
          <p className="text-sm text-muted-foreground break-words [overflow-wrap:anywhere]">
            Generated {new Date(results.meta?.checked_at ?? analysis.updated_at ?? analysis.created_at).toLocaleString()} · version {selected.latest_version} · {selected.file_type}
          </p>
        </div>

        <div className="space-y-8 p-6">
          <Section title="Analysis Summary">
            <p className="text-sm leading-relaxed text-muted-foreground">
              The analysis found {matches.length} source record(s) with exact phrase matches, covering {Number(results.plagiarism?.matched_words ?? 0).toLocaleString()} words in the compared text. The score reflects only the sources retrieved for this run; it is not a plagiarism verdict.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KPI label="Observed similarity" value={`${similarity}%`} />
              <KPI label="Matched words" value={Number(results.plagiarism?.matched_words ?? 0).toLocaleString()} />
              <KPI label="Compared words" value={Number(results.plagiarism?.eligible_words ?? results.meta?.words ?? 0).toLocaleString()} />
              <KPI label="Matched sources" value={String(matches.length)} />
            </div>
          </Section>

          <Separator />

          <Section title="Highlighted Submission Text">
            <HighlightedDocument text={results.document_text || results.text_excerpt || ""} highlights={allHighlights} />
          </Section>

          <Separator />

          <Section title="Issue Log">
            <IssueList issues={engineIssues} />
          </Section>

          <Separator />



          <Section title="Source Search Coverage">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Retrieved source records</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{results.plagiarism?.source_coverage?.sources_retrieved ?? matches.length}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Matched words</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{Number(results.plagiarism?.matched_words ?? 0).toLocaleString()}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Matching method</p>
                <p className="mt-1 text-sm font-medium text-foreground">Exact phrase evidence</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              {results.plagiarism?.source_coverage?.limitation ?? "Only the source records retrieved for this analysis were compared. This is not an exhaustive web, journal, or student-paper repository search."}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Providers: {(results.plagiarism?.source_coverage?.providers ?? []).join(", ") || "Not recorded"}.
              Excluded words: {Number(results.plagiarism?.excluded_words ?? 0).toLocaleString()} (clearly quoted passages and detected reference section).
            </p>
          </Section>

          <Separator />

          <Section title="Similarity Analysis">
            {matches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No source matches were recorded for this document.</p>
            ) : (
              <ul className="space-y-2">
                {matches.map((m, i) => (
                  <li key={i} className="rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        {m.url ? (
                          <a href={m.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">
                            {m.source ?? "Unknown source"}
                          </a>
                        ) : (
                          <p className="text-sm font-medium text-foreground">{m.source ?? "Unknown source"}</p>
                        )}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {[m.domain, m.type, m.provider].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{Number(m.similarity ?? 0).toFixed(1)}% of compared text</Badge>
                        <span className="text-xs text-muted-foreground">{Number(m.matched_words ?? 0)} words</span>
                      </div>
                    </div>
                    {m.snippet && (
                      <div className="mt-3 rounded-md bg-muted/40 p-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Submission passage</p>
                        <p className="mt-1 text-xs leading-5 text-foreground">{m.snippet}</p>
                      </div>
                    )}
                    {m.matched_snippet && (
                      <div className="mt-2 rounded-md bg-primary/5 p-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Matched source evidence</p>
                        <p className="mt-1 text-xs leading-5 text-foreground">{m.matched_snippet}</p>
                      </div>
                    )}
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {Number(m.match_count ?? 0)} exact passage match(es) · source overlap may overlap with other sources
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Separator />

          <Section title="Recommendations">
            <ul className="space-y-2">
              {buildRecommendations({ matchCount: matches.length, grammarCount: grammarIssues.length, citationCount: citationIssues.length, aiPassages: results.ai_detection?.highlights?.length ?? 0 }).map((r, i) => (
                <li key={i} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                  <div><p className="text-sm font-medium text-foreground">{r.action}</p><p className="text-xs text-muted-foreground">{r.group}</p></div>
                  <Badge variant="secondary">Review</Badge>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </Card>
    </div>
  );
}

function buildRecommendations({ matchCount, grammarCount, citationCount, aiPassages }: {
  matchCount: number; grammarCount: number; citationCount: number; aiPassages: number;
}) {
  const recommendations: Array<{ group: string; action: string }> = [];
  if (matchCount > 0) recommendations.push({ group: "Text similarity", action: `Review all ${matchCount} matched source record(s) and check each highlighted passage against its source.` });
  if (aiPassages > 0) recommendations.push({ group: "Writing patterns", action: "Review experimental writing-style flags manually; they are not evidence of authorship." });
  if (grammarCount > 0) recommendations.push({ group: "Grammar", action: `Review the ${grammarCount} language issue(s) returned by the checker.` });
  if (citationCount > 0) recommendations.push({ group: "References", action: `Check the ${citationCount} reference warning(s) against the original publications.` });
  if (recommendations.length === 0) recommendations.push({ group: "Review", action: "No actionable findings were returned. This is not certification of originality." });
  return recommendations;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-base font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}
function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
