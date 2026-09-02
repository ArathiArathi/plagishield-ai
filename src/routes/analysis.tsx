import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, BookOpen, Check, FileText, GraduationCap, Highlighter, Lightbulb, ListChecks, Loader2, Quote, Sparkles,
} from "lucide-react";


import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
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
  const { data, isPending } = useWorkspaceData();
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

  const handleRerun = async () => {
    if (!selectedDoc || !analysis) return;
    setRerunning(true);
    try {
      const { data: version, error } = await supabase
        .from("document_versions")
        .select("storage_path")
        .eq("id", analysis.version_id)
        .maybeSingle();
      if (error) throw error;
      if (!version?.storage_path) throw new Error("Stored file not found for this version");

      const res = await runAnalysis({
        data: {
          analysisId: analysis.id,
          documentId: analysis.document_id,
          versionId: analysis.version_id,
          storagePath: version.storage_path,
        },
      });
      if (!res.ok) throw new Error(res.error ?? "Analysis failed");
      toast.success("Analysis refreshed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not re-run analysis");
    } finally {
      setRerunning(false);
      await queryClient.invalidateQueries({ queryKey: ["workspace-data"] });
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
  const status = analysis?.status ?? "pending";

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
            <Button size="sm" onClick={handleRerun} disabled={rerunning || !analysis}>
              {rerunning ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Re-analyzing…</> : "Re-analyze"}
            </Button>
          </>
        }
      />

      {status !== "completed" && (
        <Card className="flex items-center gap-3 p-4">
          {status === "processing" ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <AlertTriangle className="h-4 w-4 text-warning" />}
          <p className="text-sm text-muted-foreground">
            {status === "processing"
              ? "Analysis is running — results will appear here once it completes."
              : status === "failed"
                ? `Analysis failed: ${analysis?.error ?? "unknown error"}`
                : "This document has not been analyzed yet."}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card className="p-5">
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


        <Card className="p-5">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid h-auto w-full grid-cols-4 sm:grid-cols-8">
              <TabsTrigger value="highlights" className="flex-col gap-1 py-2 text-[11px]"><Highlighter className="h-4 w-4" />Highlights</TabsTrigger>
              <TabsTrigger value="evidence" className="flex-col gap-1 py-2 text-[11px]"><Quote className="h-4 w-4" />Evidence</TabsTrigger>
              <TabsTrigger value="issues" className="flex-col gap-1 py-2 text-[11px]"><ListChecks className="h-4 w-4" />Issues</TabsTrigger>
              <TabsTrigger value="plagiarism" className="flex-col gap-1 py-2 text-[11px]"><FileText className="h-4 w-4" />Plagiarism</TabsTrigger>
              <TabsTrigger value="ai" className="flex-col gap-1 py-2 text-[11px]"><Sparkles className="h-4 w-4" />AI Detection</TabsTrigger>
              <TabsTrigger value="grammar" className="flex-col gap-1 py-2 text-[11px]"><Check className="h-4 w-4" />Grammar</TabsTrigger>
              <TabsTrigger value="citation" className="flex-col gap-1 py-2 text-[11px]"><BookOpen className="h-4 w-4" />Citation</TabsTrigger>
              <TabsTrigger value="recs" className="flex-col gap-1 py-2 text-[11px]"><Lightbulb className="h-4 w-4" />Recs</TabsTrigger>
            </TabsList>

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
                      {s.snippet && <p className="mt-2 border-l-2 border-warning bg-warning/10 px-3 py-2 text-xs text-foreground/90">{s.snippet}</p>}
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
                  <p className="text-sm text-foreground/90">{results.ai_detection.reasoning}</p>
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
                  {g.text && <p className="text-sm text-muted-foreground line-through">{g.text}</p>}
                  {g.suggestion && <p className="text-sm font-medium text-foreground">→ {g.suggestion}</p>}
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
                  <p className="min-w-0 flex-1 text-sm text-foreground">{c}</p>
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
                  <p className="text-sm text-foreground">{r.text}</p>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </Card>
      </div>
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
