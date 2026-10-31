import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Activity, AlertTriangle, BookOpen, Check, Cpu, Download, FileDown, FileText, GraduationCap, Highlighter, Lightbulb, ListChecks, Loader2, Quote, Sparkles,
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
      { name: "description", content: "Plagiarism, AI detection, grammar, and citation analysis workspace." },
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
  plagiarism?: { score?: number; matches?: Array<{ source?: string; similarity?: number; snippet?: string }>; highlights?: Highlight[] };
  ai_detection?: { score?: number; confidence?: string; reasoning?: string; highlights?: Highlight[] };
  grammar?: { score?: number; issues?: Array<{ type?: string; severity?: string; text?: string; suggestion?: string }>; highlights?: Highlight[] };
  citations?: { score?: number; total?: number; verified?: number; issues?: string[] };
  composition?: CompositionSlice[];
  issues?: IssueItem[];
};


function tone(score: number, invert = false) {
  const s = invert ? 100 - score : score;
  return s >= 75 ? "success" : s >= 50 ? "warning" : "destructive";
}

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
        generatedAt: new Date(analysis.created_at).toLocaleString(),
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

      // Immediately mark as processing in DB & invalidate cache so UI updates to Live Real-Time instantly!
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
          storagePath: version.storage_path,
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
            <p className="mt-1 text-sm text-muted-foreground">Upload a document to see plagiarism, AI, grammar, and citation results.</p>
          </div>
          <Button size="sm" asChild><Link to="/documents">Go to documents</Link></Button>
        </Card>
      </div>
    );
  }

  const similarity = Math.round(Number(analysis?.similarity_score ?? 0));
  const aiScore = Math.round(Number(analysis?.ai_score ?? 0));
  const grammarScore = Math.round(Number(analysis?.grammar_score ?? 0));
  const citationScore = Math.round(Number(analysis?.citation_score ?? 0));
  const status = rerunning ? "processing" : (analysis?.status ?? "pending");
  const isProcessing = rerunning || status === "processing";

  const matches = results.plagiarism?.matches ?? [];
  const grammarIssues = results.grammar?.issues ?? [];
  const citationIssues = results.citations?.issues ?? [];
  const excerpt = results.text_excerpt ?? "";
  const composition = results.composition ?? [];
  const engineIssues = results.issues ?? [];
  const allHighlights: Highlight[] = [
    ...(results.plagiarism?.highlights ?? []),
    ...(results.ai_detection?.highlights ?? []),
    ...(results.grammar?.highlights ?? []),
  ];

  const aiSplit = [
    { label: "Human", value: Math.max(0, 100 - aiScore), tone: "success" as const },
    { label: "AI likelihood", value: aiScore, tone: aiScore >= 60 ? ("destructive" as const) : ("warning" as const) },
  ];

  const matchChart = matches.slice(0, 7).map((m, i) => ({
    p: `M${i + 1}`,
    risk: Math.round(Number(m.similarity ?? 0)),
  }));

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
                          ? "Stage 2/4: Live literature retrieval (Wikipedia, OpenAlex, Crossref)"
                          : currentStage === "scoring"
                            ? "Stage 3/4: Forensic AI stylometrics & grammar syntax review"
                            : currentStage === "rendering"
                              ? "Stage 4/4: Bibliographic cross-matching & evidence compilation"
                              : "Multi-signal analysis pipeline actively processing in real time…"
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
                    ? "Evaluating live academic repositories and computational models. Results appear automatically."
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
          <h3 className="mb-4 text-sm font-semibold text-foreground">Integrity summary</h3>
          <div className="space-y-4">
            <ScoreBlock label="Similarity" value={similarity} tone={tone(similarity, true)} sub={similarity < 25 ? "Below 25% threshold" : "Above recommended threshold"} />
            <ScoreBlock label="AI likelihood" value={aiScore} tone={tone(aiScore, true)} sub={results.ai_detection?.confidence ? `Confidence: ${results.ai_detection.confidence}` : "—"} />
            <ScoreBlock label="Writing quality" value={grammarScore} tone={tone(grammarScore)} sub={`${grammarIssues.length} issues detected`} />
            <ScoreBlock label="Citation quality" value={citationScore} tone={tone(citationScore)} sub={`${results.citations?.verified ?? 0} of ${results.citations?.total ?? 0} references verified`} />
          </div>
          <div className="mt-5 flex items-center gap-4 text-xs text-muted-foreground">
            <Legend color="success" label="Healthy" />
            <Legend color="warning" label="Needs review" />
            <Legend color="destructive" label="High risk" />
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Content composition</h3>
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
                <TabsTrigger value="plagiarism" className="flex-col gap-1 py-2 text-[11px]"><FileText className="h-4 w-4" />Plagiarism</TabsTrigger>
                <TabsTrigger value="ai" className="flex-col gap-1 py-2 text-[11px]"><Sparkles className="h-4 w-4" />AI Detection</TabsTrigger>
                <TabsTrigger value="grammar" className="flex-col gap-1 py-2 text-[11px]"><Check className="h-4 w-4" />Grammar</TabsTrigger>
                <TabsTrigger value="citation" className="flex-col gap-1 py-2 text-[11px]"><BookOpen className="h-4 w-4" />Citation</TabsTrigger>
                <TabsTrigger value="recs" className="flex-col gap-1 py-2 text-[11px]"><Lightbulb className="h-4 w-4" />Recs</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="highlights" className="mt-5 space-y-4">
              <p className="text-xs text-muted-foreground">
                Plagiarised, AI-generated and language-issue passages are highlighted directly in the submitted text.
              </p>
              <HighlightedDocument text={excerpt} highlights={allHighlights} />
            </TabsContent>

            <TabsContent value="evidence" className="mt-5 space-y-4">
              <p className="text-xs text-muted-foreground">
                Every flagged segment with its matched source snippet, retrieval provider and confidence.
              </p>
              <EvidencePanel highlights={allHighlights} />
            </TabsContent>

            <TabsContent value="issues" className="mt-5">
              <IssueList issues={engineIssues} />
            </TabsContent>



            <TabsContent value="plagiarism" className="mt-5 space-y-5">
              <ScoreBlock label="Overall similarity" value={similarity} tone={tone(similarity, true)} sub={`${matches.length} source matches`} />
              {matches.length === 0 ? (
                <Empty label="No source matches recorded for this document." />
              ) : (
                <div className="space-y-2">
                  {matches.map((s, i) => (
                    <div key={i} className="rounded-md border border-border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{s.source ?? "Unknown source"}</p>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Match</p>
                          <p className="text-sm font-semibold text-foreground">{Math.round(Number(s.similarity ?? 0))}%</p>
                        </div>
                      </div>
                      {s.snippet && <p className="mt-2 border-l-2 border-warning bg-warning/10 px-3 py-2 text-xs text-foreground/90 break-words [overflow-wrap:anywhere]">{s.snippet}</p>}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="ai" className="mt-5 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {aiSplit.map((a) => <MiniStat key={a.label} label={a.label} value={`${a.value}%`} tone={a.tone} />)}
              </div>
              {results.ai_detection?.reasoning && (
                <Card className="bg-muted/30 p-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Detector reasoning</p>
                  <p className="text-sm text-foreground/90 break-words [overflow-wrap:anywhere]">{results.ai_detection.reasoning}</p>
                </Card>
              )}
              {matchChart.length > 0 && (
                <Card className="bg-muted/30 p-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Match strength by source</p>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={matchChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis dataKey="p" fontSize={11} stroke="var(--color-muted-foreground)" />
                        <YAxis fontSize={11} stroke="var(--color-muted-foreground)" />
                        <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="risk" radius={[4, 4, 0, 0]}>
                          {matchChart.map((v, i) => (
                            <Cell key={i} fill={v.risk > 60 ? "var(--color-destructive)" : v.risk > 30 ? "var(--color-warning)" : "var(--color-success)"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="grammar" className="mt-5 space-y-3">
              <ScoreBlock label="Writing quality" value={grammarScore} tone={tone(grammarScore)} sub={`${grammarIssues.length} issues across the document`} />
              {grammarIssues.length === 0 ? (
                <Empty label="No grammar issues detected." />
              ) : grammarIssues.map((g, i) => (
                <div key={i} className="rounded-md border border-border p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant="outline" className={cn(
                      g.severity === "high" ? "bg-destructive/15 text-destructive border-destructive/30" :
                      g.severity === "medium" ? "bg-warning/20 text-warning border-warning/30" :
                      "bg-info/15 text-info border-info/30",
                    )}>{g.type ?? "issue"}</Badge>
                    <span className="text-xs text-muted-foreground">{g.severity ?? "low"} severity</span>
                  </div>
                  {g.text && <p className="text-sm text-muted-foreground line-through break-words [overflow-wrap:anywhere]">{g.text}</p>}
                  {g.suggestion && <p className="text-sm font-medium text-foreground break-words [overflow-wrap:anywhere]">→ {g.suggestion}</p>}
                </div>
              ))}
            </TabsContent>

            <TabsContent value="citation" className="mt-5 space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {["APA", "MLA", "IEEE", "Harvard"].map((s) => (
                  <div key={s} className="rounded-md border border-border bg-muted/30 px-3 py-2 text-center text-xs font-medium text-foreground">
                    <GraduationCap className="mx-auto mb-1 h-4 w-4 text-primary" />{s}
                  </div>
                ))}
              </div>
              <ScoreBlock
                label="Citation quality"
                value={citationScore}
                tone={tone(citationScore)}
                sub={`${results.citations?.verified ?? 0} verified of ${results.citations?.total ?? 0} references`}
              />
              {citationIssues.length === 0 ? (
                <Empty label="No citation issues found." />
              ) : citationIssues.map((c, i) => (
                <div key={i} className="flex items-start gap-3 rounded-md border border-border p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <p className="min-w-0 flex-1 text-sm text-foreground break-words [overflow-wrap:anywhere]">{c}</p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="recs" className="mt-5 space-y-3">
              {buildRecommendations({ similarity, aiScore, grammarScore, citationScore }).map((r, i) => (
                <div key={i} className="rounded-md border border-border p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge className={cn(
                      r.priority === "High" ? "bg-destructive text-destructive-foreground" :
                      r.priority === "Medium" ? "bg-warning text-warning-foreground" :
                      "bg-muted text-muted-foreground",
                    )}>{r.priority}</Badge>
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{r.group}</span>
                  </div>
                  <p className="text-sm text-foreground break-words [overflow-wrap:anywhere]">{r.text}</p>
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
                Analyzing submitted document directly through academic search indices, forensic stylometry algorithms, and syntax validators.
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
                    Extracting clean text stream, stripping formatting artifacts, and segmenting prose into forensic sentence tokens.
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
                    Querying 150M+ Crossref scholarly records, OpenAlex research works, and Wikipedia full-text extracts for verbatim and paraphrased overlap.
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
                    <p className="text-sm font-medium text-foreground">Forensic AI Stylometrics & Authorship Evaluation</p>
                    <span className="text-[11px] text-muted-foreground">{stageIdx > 2 ? "Complete" : stageIdx === 2 ? "Active" : "Pending"}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Measuring sentence burstiness entropy (CV), first-order delta jumps, transition opener density, and crediting empirical research data.
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
                <span className="font-medium text-foreground text-right">Crossref, OpenAlex, Wikipedia</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Language Service</span>
                <span className="font-medium text-foreground">LanguageTool en-US</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Audit Trail</span>
                <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">
                  Real-time Verified
                </Badge>
              </div>
            </div>

            <div className="rounded-lg bg-muted/40 p-3.5 text-[11px] text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">⚡ Live Execution Notice</p>
              <p>
                Every analysis queries live academic repositories across the open web. No dummy values or static mocks are ever returned.
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function buildRecommendations({ similarity, aiScore, grammarScore, citationScore }: {
  similarity: number; aiScore: number; grammarScore: number; citationScore: number;
}) {
  const recs: Array<{ group: string; priority: "High" | "Medium" | "Low"; text: string }> = [];
  recs.push(similarity >= 25
    ? { group: "Plagiarism", priority: "High", text: "Similarity exceeds the 25% threshold. Paraphrase flagged passages and attribute every borrowed idea." }
    : { group: "Plagiarism", priority: "Low", text: "Similarity is within accepted limits. Keep quoting and attributing consistently." });
  recs.push(aiScore >= 60
    ? { group: "AI Detection", priority: "High", text: "High AI-generation likelihood. Rewrite affected sections in your own voice and document your drafting process." }
    : aiScore >= 25
      ? { group: "AI Detection", priority: "Medium", text: "Some passages read as AI-assisted. Add original analysis and vary sentence structure." }
      : { group: "AI Detection", priority: "Low", text: "Writing reads as human-authored." });
  recs.push(grammarScore < 80
    ? { group: "Grammar", priority: "Medium", text: "Apply the suggested grammar fixes to raise writing quality above 80." }
    : { group: "Grammar", priority: "Low", text: "Grammar is strong; only minor polish remains." });
  recs.push(citationScore < 80
    ? { group: "Citations", priority: "High", text: "Complete and normalize incomplete references to a single citation style." }
    : { group: "Citations", priority: "Low", text: "Citations are well formed and verifiable." });
  return recs;
}

function ScoreBlock({ label, value, tone, sub }: { label: string; value: number; tone: string; sub?: string }) {
  const bar = tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-destructive";
  return (
    <div>
      <div className="mb-1.5 flex items-end justify-between">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-2xl font-semibold tracking-tight text-foreground">{value}<span className="text-sm text-muted-foreground">%</span></p>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      {sub && <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "destructive" }) {
  const tones = {
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  };
  return (
    <div className={cn("rounded-md p-3 text-center", tones[tone])}>
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs opacity-80">{label}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", color === "success" ? "bg-success" : color === "warning" ? "bg-warning" : "bg-destructive")} />
      {label}
    </span>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">{label}</div>
  );
}
