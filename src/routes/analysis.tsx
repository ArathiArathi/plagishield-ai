import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, BookOpen, Check, Cpu, Download, FileDown, FileText, Highlighter, Lightbulb, ListChecks, Loader2, Quote, Sparkles,
} from "lucide-react";
import { downloadReport, type ReportInput } from "@/lib/report-pdf";


import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { useAnalysisQueue } from "@/hooks/use-analysis-queue";
import { secureUserCache } from "@/lib/cache/secure-cache";
import { runAnalysis } from "@/lib/analysis.functions";
import { HighlightedDocument } from "@/components/analysis/HighlightedDocument";
import { CompositionChart } from "@/components/analysis/CompositionChart";
import { IssueList } from "@/components/analysis/IssueList";
import { EvidencePanel } from "@/components/analysis/EvidencePanel";

import type { CompositionSlice, Highlight, IssueItem } from "@/components/analysis/analysis-shared";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/analysis")({
  head: () => ({
    meta: [
      { title: "Analysis — PlagiShield AI" },
      { name: "description", content: "Text similarity, experimental writing-pattern review, grammar and reference checks." },
      { property: "og:title", content: "Analysis workspace — PlagiShield AI" },
      { property: "og:description", content: "Review similarity, AI-generation, grammar, and citation results per document." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    doc: typeof search.doc === "string" ? search.doc : undefined,
  }),
  component: AnalysisPage,
});

type Results = {
  stage?: string;
  stage_pct?: number;
  text_excerpt?: string;
  document_text?: string;
  meta?: { engine_version?: string; extraction?: string; words?: number; checked_at?: string; truncated?: boolean; character_limit?: number };
  plagiarism?: {
    score?: number; matched_words?: number; eligible_words?: number; excluded_words?: number;
    matches?: Array<{ source?: string; url?: string; similarity?: number; snippet?: string; matched_snippet?: string; matched_words?: number; match_count?: number }>;
    highlights?: Highlight[];
    source_coverage?: { sources_retrieved?: number; providers?: string[]; matching_method?: string; limitation?: string };
  };
  ai_detection?: { score?: number; confidence?: string; reasoning?: string; highlights?: Highlight[] };
  grammar?: { score?: number; issues?: Array<{ type?: string; severity?: string; text?: string; suggestion?: string }>; highlights?: Highlight[] };
  citations?: { score?: number; total?: number; verified?: number; issues?: string[] };
  composition?: CompositionSlice[];
  issues?: IssueItem[];
};


function AnalysisPage() {
  const { doc } = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const runAnalysisFn = useServerFn(runAnalysis);
  const { data, isPending } = useWorkspaceData();
  const { drain: drainQueue } = useAnalysisQueue({ autoStart: true });
  const [tab, setTab] = useState("highlights");
  const [rerunning, setRerunning] = useState(false);

  const documents = data?.documents ?? [];
  const selectedDoc = useMemo(
    () => documents.find((d) => d.id === doc) ?? documents[0],
    [documents, doc],
  );
  const analysis = useMemo(
    () => (data?.analyses ?? []).find((a) => a.document_id === selectedDoc?.id),
    [data?.analyses, selectedDoc?.id],
  );
  const results = (analysis?.results ?? {}) as Results;

  const handleDownloadPdf = () => {
    if (!selectedDoc || !analysis) return;
    try {
      const reportInput: ReportInput = {
        documentName: selectedDoc.name,
        fileType: selectedDoc.file_type,
        version: selectedDoc.latest_version,
        analysisId: analysis.id,
        generatedAt: results.meta?.checked_at ? new Date(results.meta.checked_at).toLocaleString() : new Date(analysis.updated_at ?? analysis.created_at).toLocaleString(),
        docType: selectedDoc.doc_type,
        authorName: selectedDoc.author_name,
        paperTitle: selectedDoc.paper_title,
        similarity: Math.round(Number(analysis.similarity_score ?? 0)),
        ai: Math.round(Number(analysis.ai_score ?? 0)),
        grammar: Math.round(Number(analysis.grammar_score ?? 0)),
        citation: Math.round(Number(analysis.citation_score ?? 0)),
        results: results as ReportInput["results"],
      };
      downloadReport("full", reportInput);
      toast.success(`Comprehensive PDF report for "${selectedDoc.name}" downloaded`);
    } catch (e: unknown) {
      console.error("PDF download error:", e);
      toast.error("Could not generate PDF report. Please try again.");
    }
  };

  const handleRerun = async () => {
    if (!selectedDoc) return;
    setRerunning(true);
    try {
      // Find the latest version of this document
      const { data: version, error: vErr } = await supabase
        .from("document_versions")
        .select("id, storage_path")
        .eq("document_id", selectedDoc.id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (vErr) throw vErr;
      if (!version?.storage_path) throw new Error("Stored file not found for this document");

      let targetAnalysisId = analysis?.id;
      if (!targetAnalysisId) {
        // Create an analysis record if one doesn't exist yet
        const { data: newAnalysis, error: aErr } = await supabase
          .from("analyses")
          .insert({
            document_id: selectedDoc.id,
            version_id: version.id,
            status: "pending",
          })
          .select("id")
          .single();
        if (aErr) throw aErr;
        targetAnalysisId = newAnalysis.id;
      }

      // Immediately mark as processing in DB & invalidate cache so UI updates to Processing instantly!
      await supabase
        .from("analyses")
        .update({
          status: "processing",
          results: { stage: "extracting", stage_pct: 15 },
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetAnalysisId);

      await secureUserCache.invalidateByTag("analyses");
      await secureUserCache.invalidateByTag("workspace");
      queryClient.invalidateQueries({ queryKey: ["workspace-data"] });

      const res = (await runAnalysisFn({
        data: {
          analysisId: targetAnalysisId,
          documentId: selectedDoc.id,
          versionId: version.id,
        },
      })) as { ok: boolean; error?: string; retryAfter?: number };
      if (!res.ok) throw new Error(res.error ?? "Analysis failed");
      toast.success("Analysis complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not run analysis");
    } finally {
      setRerunning(false);
      await secureUserCache.invalidateByTag("analyses");
      await secureUserCache.invalidateByTag("workspace");
      await secureUserCache.invalidateByTag("documents");
      await queryClient.invalidateQueries({ queryKey: ["workspace-data"] });
      await queryClient.invalidateQueries({ queryKey: ["analyses-latest"] });
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
    }
  };

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!selectedDoc) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analysis workspace" description="Detailed integrity results per document." />
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Nothing to analyze yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Upload a document to review source overlap, experimental writing-pattern signals, language notes and references.</p>
          </div>
          <Button size="sm" asChild><Link to="/documents">Go to documents</Link></Button>
        </Card>
      </div>
    );
  }

  const similarity = Math.round(Number(analysis?.similarity_score ?? 0));
  const status = rerunning ? "processing" : (analysis?.status ?? "pending");
  const isProcessing = rerunning || status === "processing";

  const matches = results.plagiarism?.matches ?? [];
  const grammarIssues = results.grammar?.issues ?? [];
  const citationIssues = results.citations?.issues ?? [];
  const excerpt = results.document_text || results.text_excerpt || "";
  const composition = results.composition ?? [];
  const engineIssues = results.issues ?? [];
  const allHighlights: Highlight[] = [
    ...(results.plagiarism?.highlights ?? []),
    ...(results.ai_detection?.highlights ?? []),
    ...(results.grammar?.highlights ?? []),
  ];

  const currentStage = results.stage ?? "extracting";
  const stageOrder = ["extracting", "retrieving", "scoring", "rendering", "completed"];
  const stageIdx = stageOrder.indexOf(currentStage);

  return (
    <div className="space-y-6">
      <PageHeader
        title={selectedDoc.name}
        description={`${selectedDoc.file_type.toUpperCase()} · v${selectedDoc.latest_version} · uploaded ${new Date(selectedDoc.created_at).toLocaleDateString()}`}
        actions={
          <>
            <Select
              value={selectedDoc.id}
              onValueChange={(v) => navigate({ search: { doc: v } })}
            >
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {documents.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleRerun} disabled={isProcessing}>
              {isProcessing ? (
                <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Analyzing…</>
              ) : analysis ? (
                "Re-analyze"
              ) : (
                "Run Analysis"
              )}
            </Button>
            {status === "completed" && !rerunning && (
              <>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={handleDownloadPdf}>
                  <Download className="h-4 w-4 text-primary" />
                  Download PDF
                </Button>
                <Button asChild size="sm" variant="ghost" className="gap-1.5">
                  <Link to="/reports" search={{ doc: selectedDoc.id }}>
                    <FileDown className="h-4 w-4" />
                    All Reports
                  </Link>
                </Button>
              </>
            )}
          </>
        }
      />

      {(status !== "completed" || rerunning) && (
        <Card className="p-5 border-primary/30 bg-primary/[0.02] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              {status === "processing" ? (
                <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : status === "pending" ? (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
                  <Loader2 className="h-5 w-5 animate-pulse text-warning" />
                </div>
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {status === "processing"
                      ? currentStage === "extracting"
                        ? "Stage 1/4: Ingesting text & tokenizing sentence structures"
                        : currentStage === "retrieving"
                          ? "Stage 2/4: Public source retrieval (Crossref, OpenAlex, Semantic Scholar, Europe PMC, Wikipedia)"
                          : currentStage === "scoring"
                            ? "Stage 3/4: Experimental writing-pattern checks and language review"
                            : currentStage === "rendering"
                              ? "Stage 4/4: Bibliographic cross-matching & evidence compilation"
                              : "Checking document text and retrieved source records…"
                      : status === "pending"
                        ? "Document queued for analysis"
                        : status === "failed"
                          ? "Analysis encountered an error"
                          : "Ready to analyze"}
                  </p>
                  {status === "processing" && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[10px] animate-pulse">
                      Live Real-Time
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {status === "processing"
                    ? "Searching connected public indexes. Results depend on the records returned."
                    : status === "pending"
                      ? "Waiting for the queue worker to begin execution."
                      : status === "failed"
                        ? (analysis?.error ?? "An unexpected error occurred during processing.")
                        : "Click 'Run Analysis' to process this document."}
                </p>
              </div>
            </div>
            {status === "pending" && (
              <Button size="sm" variant="outline" onClick={() => void drainQueue()}>
                Process queue now
              </Button>
            )}
            {status === "failed" && (
              <Button size="sm" onClick={handleRerun}>
                Retry Analysis
              </Button>
            )}
          </div>
          {status === "processing" && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span className="capitalize">{currentStage} stage</span>
                <span className="font-semibold text-foreground">{results.stage_pct ?? (rerunning ? 25 : 45)}%</span>
              </div>
              <Progress value={results.stage_pct ?? (rerunning ? 25 : 45)} className="h-2" />
            </div>
          )}
        </Card>
      )}

      {status === "completed" && !rerunning ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] min-w-0">
        <Card className="p-5 min-w-0 overflow-hidden">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Similarity summary</h3>
          <div className="rounded-md border border-border bg-muted/20 p-4">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-semibold tracking-tight text-foreground">{similarity}%</span>
              <span className="text-sm text-muted-foreground">observed similarity</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {Number(results.plagiarism?.matched_words ?? 0).toLocaleString()} of {Number(results.plagiarism?.eligible_words ?? results.meta?.words ?? 0).toLocaleString()} compared words matched retrieved source text. This is not a plagiarism verdict.
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border border-border p-3"><p className="text-xs text-muted-foreground">Matched sources</p><p className="mt-1 text-xl font-semibold">{matches.length}</p></div>
            <div className="rounded-md border border-border p-3"><p className="text-xs text-muted-foreground">Excluded words</p><p className="mt-1 text-xl font-semibold">{Number(results.plagiarism?.excluded_words ?? 0).toLocaleString()}</p></div>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            {results.plagiarism?.source_coverage?.limitation ?? "Only source records retrieved for this run were compared. Coverage is not exhaustive."}
          </p>
          <div className="mt-5 border-t border-border pt-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Compared text coverage</h3>
            <CompositionChart data={composition} />
          </div>
        </Card>


        <Card className="p-5 min-w-0 overflow-hidden">
          <Tabs value={tab} onValueChange={setTab} className="min-w-0">
            <div className="overflow-x-auto pb-1">
              <TabsList className="grid h-auto min-w-[560px] sm:min-w-0 w-full grid-cols-8">
                <TabsTrigger value="highlights" className="flex-col gap-1 py-2 text-[11px]"><Highlighter className="h-4 w-4" />Highlights</TabsTrigger>
                <TabsTrigger value="evidence" className="flex-col gap-1 py-2 text-[11px]"><Quote className="h-4 w-4" />Evidence</TabsTrigger>
                <TabsTrigger value="issues" className="flex-col gap-1 py-2 text-[11px]"><ListChecks className="h-4 w-4" />Issues</TabsTrigger>
                <TabsTrigger value="plagiarism" className="flex-col gap-1 py-2 text-[11px]"><FileText className="h-4 w-4" />Text similarity</TabsTrigger>
                <TabsTrigger value="ai" className="flex-col gap-1 py-2 text-[11px]"><Sparkles className="h-4 w-4" />Writing patterns</TabsTrigger>
                <TabsTrigger value="grammar" className="flex-col gap-1 py-2 text-[11px]"><Check className="h-4 w-4" />Grammar</TabsTrigger>
                <TabsTrigger value="citation" className="flex-col gap-1 py-2 text-[11px]"><BookOpen className="h-4 w-4" />Citation</TabsTrigger>
                <TabsTrigger value="recs" className="flex-col gap-1 py-2 text-[11px]"><Lightbulb className="h-4 w-4" />Review notes</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="highlights" className="mt-5 space-y-4">
              <p className="text-xs text-muted-foreground">
                Exact source matches and returned language annotations are highlighted in the extracted submission text. Experimental writing-style flags are separate and are not proof of authorship.
              </p>
              {!results.document_text && <p className="mb-3 rounded-md border border-warning/30 bg-warning/5 p-3 text-xs leading-5 text-muted-foreground">This saved analysis predates full-paper storage. Re-run the analysis to include the complete extracted document and align every highlight in the report.</p>}
          {results.meta?.truncated && <p className="mb-3 rounded-md border border-warning/30 bg-warning/5 p-3 text-xs leading-5 text-muted-foreground">The analysis was limited to the first {Number(results.meta.character_limit ?? 120000).toLocaleString()} characters. Text beyond that limit was not compared or included in the report.</p>}
          <HighlightedDocument text={excerpt} highlights={allHighlights} />
            </TabsContent>

            <TabsContent value="evidence" className="mt-5 space-y-4">
              <p className="text-xs text-muted-foreground">
                Each similarity match includes the exact submission span and the source passage used to establish it.
              </p>
              <EvidencePanel highlights={allHighlights} />
            </TabsContent>

            <TabsContent value="issues" className="mt-5">
              <IssueList issues={engineIssues} />
            </TabsContent>



            <TabsContent value="plagiarism" className="mt-5 space-y-5">
              <p className="text-sm text-muted-foreground">
                {Number(results.plagiarism?.matched_words ?? 0).toLocaleString()} matched words out of {Number(results.plagiarism?.eligible_words ?? results.meta?.words ?? 0).toLocaleString()} compared words. At least eight consecutive normalized words are required for a match.
              </p>
              {matches.length === 0 ? (
                <Empty label="No qualifying exact phrase matches were found in the retrieved source set." />
              ) : (
                <div className="space-y-3">
                  {matches.map((source, index) => (
                    <div key={`${source.url ?? source.source ?? "source"}-${index}`} className="rounded-md border border-border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {source.url ? <a href={source.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">{source.source ?? "Source record"}</a> : <p className="text-sm font-medium text-foreground">{source.source ?? "Source record"}</p>}
                          <p className="mt-1 text-xs text-muted-foreground">{source.match_count ?? 0} passage(s) · {Number(source.matched_words ?? 0).toLocaleString()} matched words</p>
                        </div>
                        <Badge variant="secondary">{Number(source.similarity ?? 0).toFixed(1)}%</Badge>
                      </div>
                      {source.snippet && <div className="mt-3 rounded-md bg-warning/10 p-3"><p className="text-[10px] font-semibold uppercase text-muted-foreground">In your paper</p><p className="mt-1 text-xs leading-5">{source.snippet}</p></div>}
                      {source.matched_snippet && <div className="mt-2 rounded-md bg-muted/40 p-3"><p className="text-[10px] font-semibold uppercase text-muted-foreground">In the retrieved source</p><p className="mt-1 text-xs leading-5">{source.matched_snippet}</p></div>}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs leading-5 text-muted-foreground">{results.plagiarism?.source_coverage?.limitation}</p>
            </TabsContent>

            <TabsContent value="ai" className="mt-5 space-y-4">
              <Badge variant="outline">Experimental · not an authorship detector</Badge>
              <p className="text-sm leading-6 text-muted-foreground">
                Writing-style signals can occur in both human and AI-assisted writing. This check is unvalidated and should not be used to decide who wrote a document.
              </p>
              {results.ai_detection?.highlights?.length ? <EvidencePanel highlights={results.ai_detection.highlights} /> : <Empty label="No writing-pattern passages were returned." />}
            </TabsContent>

            <TabsContent value="grammar" className="mt-5 space-y-3">
              <p className="text-sm text-muted-foreground">{grammarIssues.length} issue(s) were returned by the enabled grammar checker. Review each suggestion in context.</p>
              {grammarIssues.length === 0 ? <Empty label="No grammar issues were returned. This does not guarantee error-free writing." /> : grammarIssues.map((issue, index) => (
                <div key={index} className="rounded-md border border-border p-3">
                  <div className="mb-1 flex items-center gap-2"><Badge variant="outline">{issue.type ?? "Issue"}</Badge><span className="text-xs text-muted-foreground">{issue.severity ?? "unspecified"} severity</span></div>
                  {issue.text && <p className="text-sm text-muted-foreground">{issue.text}</p>}
                  {issue.suggestion && <p className="mt-1 text-sm font-medium text-foreground">Suggested: {issue.suggestion}</p>}
                </div>
              ))}
            </TabsContent>

            <TabsContent value="citation" className="mt-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                {results.citations?.verified ?? 0} of {results.citations?.total ?? 0} parsed reference title(s) matched records in connected scholarly indexes. A title match is not a full bibliographic audit.
              </p>
              {citationIssues.length === 0 ? <Empty label="No reference warnings were returned by the enabled checks." /> : citationIssues.map((warning, index) => (
                <div key={index} className="flex items-start gap-3 rounded-md border border-border p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <p className="min-w-0 flex-1 text-sm text-foreground break-words [overflow-wrap:anywhere]">{warning}</p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="recs" className="mt-5 space-y-3">
              {buildRecommendations({ matchCount: matches.length, aiPassages: results.ai_detection?.highlights?.length ?? 0, grammarCount: grammarIssues.length, citationCount: citationIssues.length }).map((recommendation, index) => (
                <div key={index} className="rounded-md border border-border p-4">
                  <Badge variant="outline">{recommendation.group}</Badge>
                  <p className="mt-2 text-sm text-foreground break-words [overflow-wrap:anywhere]">{recommendation.text}</p>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </Card>
      </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 p-6 space-y-6 border-primary/20 bg-card">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary animate-pulse" />
                  Real-Time Pipeline Execution
                </h3>
                <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-xs">
                  {status === "processing" ? "Live Analysis Running" : status === "pending" ? "Queued" : "Processing"}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Searching public scholarly indexes, checking exact passage overlap, and running separate language and reference checks.
              </p>
            </div>

            <div className="space-y-4">
              {/* Step 1 */}
              <div className={cn(
                "flex items-start gap-3.5 rounded-lg border p-4 transition-all",
                stageIdx >= 0 ? "border-primary/30 bg-primary/[0.03]" : "border-border/60 bg-muted/20 text-muted-foreground",
              )}>
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  stageIdx > 0 ? "bg-success text-success-foreground" : stageIdx === 0 ? "bg-primary text-primary-foreground animate-pulse" : "bg-muted text-muted-foreground",
                )}>
                  {stageIdx > 0 ? <Check className="h-4 w-4" /> : "1"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Document Text Ingestion & Sentence Segmentation</p>
                    <span className="text-[11px] text-muted-foreground">{stageIdx > 0 ? "Complete" : stageIdx === 0 ? "Active" : "Pending"}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Extracting text and preserving its character offsets so matched passages can be highlighted in the report.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className={cn(
                "flex items-start gap-3.5 rounded-lg border p-4 transition-all",
                stageIdx >= 1 ? "border-primary/30 bg-primary/[0.03]" : "border-border/60 bg-muted/20 text-muted-foreground",
              )}>
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  stageIdx > 1 ? "bg-success text-success-foreground" : stageIdx === 1 ? "bg-primary text-primary-foreground animate-pulse" : "bg-muted text-muted-foreground",
                )}>
                  {stageIdx > 1 ? <Check className="h-4 w-4" /> : "2"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Scholarly Literature Retrieval</p>
                    <span className="text-[11px] text-muted-foreground">{stageIdx > 1 ? "Complete" : stageIdx === 1 ? "Active" : "Pending"}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Searching public records from Crossref, OpenAlex, Semantic Scholar, Europe PMC, and Wikipedia. Results depend on which source records are returned.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className={cn(
                "flex items-start gap-3.5 rounded-lg border p-4 transition-all",
                stageIdx >= 2 ? "border-primary/30 bg-primary/[0.03]" : "border-border/60 bg-muted/20 text-muted-foreground",
              )}>
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  stageIdx > 2 ? "bg-success text-success-foreground" : stageIdx === 2 ? "bg-primary text-primary-foreground animate-pulse" : "bg-muted text-muted-foreground",
                )}>
                  {stageIdx > 2 ? <Check className="h-4 w-4" /> : "3"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Experimental writing-pattern review</p>
                    <span className="text-[11px] text-muted-foreground">{stageIdx > 2 ? "Complete" : stageIdx === 2 ? "Active" : "Pending"}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Checking a small set of stylistic signals. These signals are not a validated way to identify an author.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className={cn(
                "flex items-start gap-3.5 rounded-lg border p-4 transition-all",
                stageIdx >= 3 ? "border-primary/30 bg-primary/[0.03]" : "border-border/60 bg-muted/20 text-muted-foreground",
              )}>
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  stageIdx > 3 ? "bg-success text-success-foreground" : stageIdx === 3 ? "bg-primary text-primary-foreground animate-pulse" : "bg-muted text-muted-foreground",
                )}>
                  {stageIdx > 3 ? <Check className="h-4 w-4" /> : "4"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Grammar Diagnostics & Citation Verification</p>
                    <span className="text-[11px] text-muted-foreground">{stageIdx > 3 ? "Complete" : stageIdx === 3 ? "Active" : "Pending"}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Validating grammar/syntax via LanguageTool, matching bibliographic citations against Crossref/OpenAlex, and compiling evidence passages.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-5 border-border bg-card">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              Engine Configuration
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Extraction Mode</span>
                <span className="font-medium text-foreground capitalize">{selectedDoc.file_type} Parser</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Document Type</span>
                <span className="font-medium text-foreground capitalize">{selectedDoc.doc_type ?? "Research paper"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Connected Repositories</span>
                <span className="font-medium text-foreground text-right">Crossref, OpenAlex, Semantic Scholar, Europe PMC, Wikipedia</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Language Service</span>
                <span className="font-medium text-foreground">LanguageTool en-US</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Audit Trail</span>
                <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">
                  Recorded
                </Badge>
              </div>
            </div>

            <div className="rounded-lg bg-muted/40 p-3.5 text-[11px] text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">⚡ Live Execution Notice</p>
              <p>
                Only the source records retrieved for this run are compared. Private student-paper collections and licensed journal full text are not connected.
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function buildRecommendations({ matchCount, aiPassages, grammarCount, citationCount }: {
  matchCount: number; aiPassages: number; grammarCount: number; citationCount: number;
}) {
  const recommendations: Array<{ group: string; text: string }> = [];
  if (matchCount > 0) recommendations.push({ group: "Text similarity", text: `Review the ${matchCount} matched source record(s) and compare each highlighted passage with its source.` });
  if (aiPassages > 0) recommendations.push({ group: "Writing patterns", text: "Review experimental writing-style flags manually; they are not evidence of authorship." });
  if (grammarCount > 0) recommendations.push({ group: "Grammar", text: `Review the ${grammarCount} language issue(s) returned by the checker.` });
  if (citationCount > 0) recommendations.push({ group: "References", text: `Check the ${citationCount} reference warning(s) against the original publications.` });
  if (recommendations.length === 0) recommendations.push({ group: "Review", text: "No actionable findings were returned. This is not certification of originality." });
  return recommendations;
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">{label}</div>
  );
}
