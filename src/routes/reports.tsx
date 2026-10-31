import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, Download, FileBarChart, FileSearch, FileStack, Quote, SpellCheck } from "lucide-react";
import { toast } from "sonner";
import { downloadReport, type ReportInput, type ReportKind } from "@/lib/report-pdf";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { HighlightedDocument } from "@/components/analysis/HighlightedDocument";
import { CompositionChart } from "@/components/analysis/CompositionChart";
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
  plagiarism?: { matches?: Array<{ source?: string; similarity?: number; snippet?: string }>; highlights?: Highlight[] };
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

  const distribution = (data?.similarityDistribution ?? []);

  const composition = results.composition ?? [];
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
    generatedAt: new Date(analysis.created_at).toLocaleString(),
    docType: selected.doc_type,
    authorName: selected.author_name,
    paperTitle: selected.paper_title,
    similarity, ai, grammar, citation,
    results: results as ReportInput["results"],
  };


  const bundle: Array<{ kind: ReportKind; title: string; desc: string; icon: typeof FileSearch; metric: string }> = [
    { kind: "similarity", title: "Similarity Report", desc: `Matched sources, overlap index and per-source match table (${matches.length} source${matches.length === 1 ? "" : "s"}).`, icon: FileSearch, metric: `${similarity}% similarity` },
    { kind: "ai", title: "AI Content Report", desc: "AI likelihood, detector confidence, reasoning and flagged passages.", icon: Bot, metric: `${ai}% AI` },
    { kind: "grammar", title: "Grammar & Language Report", desc: `Readability score with categorised issue breakdown (${grammarIssues.length} issue${grammarIssues.length === 1 ? "" : "s"}).`, icon: SpellCheck, metric: `${grammar}/100` },
    { kind: "citation", title: "Citation Verification Report", desc: `Reference verification status and formatting issues (${citationIssues.length} issue${citationIssues.length === 1 ? "" : "s"}).`, icon: Quote, metric: `${citation}/100` },
    { kind: "full", title: "Comprehensive Report", desc: "All four modules combined into a single institutional integrity dossier.", icon: FileStack, metric: "All modules" },
  ];

  const download = (kind: ReportKind) => {
    try {
      downloadReport(kind, reportInput);
      toast.success(`${bundle.find((b) => b.kind === kind)?.title} downloaded`);
    } catch {
      toast.error("Could not generate the PDF. Please try again.");
    }
  };

  const downloadAll = () => {
    bundle.forEach((b, i) => window.setTimeout(() => {
      try {
        downloadReport(b.kind, reportInput);
      } catch (e: unknown) {
        console.error(`Could not generate ${b.title}:`, e);
        toast.error(`Could not generate ${b.title}. Please try again.`);
      }
    }, i * 350));
    toast.success("Generating all reports…");
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
              <Download className="mr-1.5 h-4 w-4" />Download all PDFs
            </Button>
          </>
        }
      />

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Report files</h3>
            <p className="text-sm text-muted-foreground">Each module is exported as its own signed-off PDF file.</p>
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
        <div className="border-b border-border bg-[image:var(--gradient-subtle)] p-6">
          <div className="flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-primary" />
            <Badge variant="secondary">Report · {analysis.id.slice(0, 8).toUpperCase()}</Badge>
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-foreground">{selected.name}</h2>
          <p className="text-sm text-muted-foreground">
            Generated {new Date(analysis.created_at).toLocaleString()} · version {selected.latest_version} · {selected.file_type}
          </p>
        </div>

        <div className="space-y-8 p-6">
          <Section title="Executive Summary">
            <p className="text-sm leading-relaxed text-muted-foreground">
              This document shows {similarity}% similarity against matched sources and {ai}% likelihood of
              AI-generated content{results.ai_detection?.confidence ? ` (${results.ai_detection.confidence} confidence)` : ""}.
              Writing quality scores {grammar}/100 and citation completeness {citation}/100.
              {grammarIssues.length > 0 ? ` ${grammarIssues.length} grammar issue(s)` : " No grammar issues"} and
              {citationIssues.length > 0 ? ` ${citationIssues.length} citation issue(s)` : " no citation issues"} were detected.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KPI label="Similarity" value={`${similarity}%`} />
              <KPI label="AI Detection" value={`${ai}%`} />
              <KPI label="Grammar" value={String(grammar)} />
              <KPI label="Citation" value={String(citation)} />
            </div>
          </Section>

          <Separator />

          <Section title="Content Composition">
            <CompositionChart data={composition} />
          </Section>

          <Separator />

          <Section title="Highlighted Submission Text">
            <HighlightedDocument text={results.text_excerpt ?? ""} highlights={allHighlights} />
          </Section>

          <Separator />

          <Section title="Issue Log">
            <IssueList issues={engineIssues} />
          </Section>

          <Separator />



          <Section title="Similarity Analysis">
            {matches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No source matches were recorded for this document.</p>
            ) : (
              <ul className="space-y-2">
                {matches.map((m, i) => (
                  <li key={i} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">{m.source ?? "Unknown source"}</p>
                      <Badge variant="secondary">{Math.round(Number(m.similarity ?? 0))}%</Badge>
                    </div>
                    {m.snippet && <p className="mt-1 text-xs text-muted-foreground">{m.snippet}</p>}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="range" fontSize={12} stroke="var(--color-muted-foreground)" />
                  <YAxis allowDecimals={false} fontSize={12} stroke="var(--color-muted-foreground)" />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Separator />

          <Section title="Recommendations">
            <ul className="space-y-2">
              {buildRecommendations({ similarity, ai, grammar, citation, grammarIssues, citationIssues }).map((r, i) => (
                <li key={i} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.action}</p>
                    <p className="text-xs text-muted-foreground">{r.group} · {r.priority} priority</p>
                  </div>
                  <Badge variant="secondary">{r.impact}</Badge>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </Card>
    </div>
  );
}

function buildRecommendations({
  similarity, ai, grammar, citation, grammarIssues, citationIssues,
}: {
  similarity: number; ai: number; grammar: number; citation: number;
  grammarIssues: Array<{ type?: string }>; citationIssues: string[];
}) {
  const recs: Array<{ group: string; action: string; priority: string; impact: string }> = [];
  if (similarity >= 25) recs.push({ group: "Originality", action: "Paraphrase or quote the matched passages and cite their sources.", priority: "high", impact: `−${Math.min(similarity, 20)}% similarity` });
  if (ai >= 50) recs.push({ group: "AI detection", action: "Rewrite flagged sections in your own voice with concrete detail.", priority: "high", impact: `−${Math.min(ai, 30)}% AI likelihood` });
  if (grammarIssues.length > 0) recs.push({ group: "Grammar", action: `Resolve ${grammarIssues.length} flagged grammar issue(s).`, priority: grammar < 70 ? "high" : "medium", impact: "+ readability" });
  if (citationIssues.length > 0) recs.push({ group: "Citations", action: `Fix ${citationIssues.length} citation issue(s) and verify every reference.`, priority: citation < 70 ? "high" : "medium", impact: `+${Math.max(100 - citation, 5)} citation score` });
  if (recs.length === 0) recs.push({ group: "Overall", action: "No action required — this document meets integrity thresholds.", priority: "low", impact: "ready to submit" });
  return recs;
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
