import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, BookOpen, Check, FileText, GraduationCap, Lightbulb, Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  citationIssues, grammarIssues, recommendations, sampleParagraphs, sourceMatches,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analysis")({
  head: () => ({ meta: [{ title: "Analysis — PlagiShield AI" }, { name: "description", content: "Plagiarism, AI detection, grammar, and citation analysis workspace." }] }),
  component: AnalysisPage,
});

function AnalysisPage() {
  const [tab, setTab] = useState("plagiarism");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Thesis - Neural Architectures.pdf"
        description="Submitted May 28, 2026 · 12,438 words · Aarav Patel"
        actions={
          <>
            <Button variant="outline" size="sm">Download report</Button>
            <Button size="sm">Re-analyze</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Left: document viewer */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Document</h3>
            <Badge variant="outline">Page 1 of 24</Badge>
          </div>
          <div className="space-y-3 rounded-md border border-border bg-card p-5 text-sm leading-relaxed">
            {sampleParagraphs.map((p, i) => {
              const tone =
                p.risk === "high" ? "bg-destructive/15 text-destructive-foreground/90 border-l-2 border-destructive" :
                p.risk === "medium" ? "bg-warning/20 text-foreground border-l-2 border-warning" :
                "bg-success/10 text-foreground border-l-2 border-success";
              return <p key={i} className={cn("rounded-r-md px-3 py-2 text-foreground/90", tone)}>{p.text}</p>;
            })}
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <Legend color="success" label="Original" />
            <Legend color="warning" label="Partially similar" />
            <Legend color="destructive" label="Highly similar" />
          </div>
        </Card>

        {/* Right: analysis tabs */}
        <Card className="p-5">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid h-auto w-full grid-cols-5">
              <TabsTrigger value="plagiarism" className="flex-col gap-1 py-2 text-[11px]"><FileText className="h-4 w-4" />Plagiarism</TabsTrigger>
              <TabsTrigger value="ai" className="flex-col gap-1 py-2 text-[11px]"><Sparkles className="h-4 w-4" />AI Detection</TabsTrigger>
              <TabsTrigger value="grammar" className="flex-col gap-1 py-2 text-[11px]"><Check className="h-4 w-4" />Grammar</TabsTrigger>
              <TabsTrigger value="citation" className="flex-col gap-1 py-2 text-[11px]"><BookOpen className="h-4 w-4" />Citation</TabsTrigger>
              <TabsTrigger value="recs" className="flex-col gap-1 py-2 text-[11px]"><Lightbulb className="h-4 w-4" />Recs</TabsTrigger>
            </TabsList>

            <TabsContent value="plagiarism" className="mt-5 space-y-5">
              <ScoreBlock label="Overall similarity" value={14} tone="success" sub="Below 25% threshold" />
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Source matches</p>
                <div className="space-y-2">
                  {sourceMatches.map((s, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md border border-border p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{s.source}</p>
                        <p className="truncate text-xs text-muted-foreground">{s.url}</p>
                      </div>
                      <div className="ml-3 flex items-center gap-3 text-right">
                        <div><p className="text-xs text-muted-foreground">Match</p><p className="text-sm font-semibold text-foreground">{s.similarity}%</p></div>
                        <div><p className="text-xs text-muted-foreground">Conf</p><p className="text-sm font-semibold text-foreground">{s.confidence}%</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="ai" className="mt-5 space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <MiniStat label="Human" value="76%" tone="success" />
                <MiniStat label="AI Assisted" value="18%" tone="warning" />
                <MiniStat label="AI Generated" value="6%" tone="destructive" />
              </div>
              <Card className="bg-muted/30 p-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Paragraph AI risk</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { p: "P1", risk: 12 }, { p: "P2", risk: 34 }, { p: "P3", risk: 78 },
                      { p: "P4", risk: 22 }, { p: "P5", risk: 45 }, { p: "P6", risk: 18 }, { p: "P7", risk: 9 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="p" fontSize={11} stroke="var(--color-muted-foreground)" />
                      <YAxis fontSize={11} stroke="var(--color-muted-foreground)" />
                      <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="risk" radius={[4, 4, 0, 0]}>
                        {[12, 34, 78, 22, 45, 18, 9].map((v, i) => (
                          <Cell key={i} fill={v > 60 ? "var(--color-destructive)" : v > 30 ? "var(--color-warning)" : "var(--color-success)"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="grammar" className="mt-5 space-y-3">
              <ScoreBlock label="Writing quality" value={92} tone="success" sub="14 issues across the document" />
              {grammarIssues.map((g) => (
                <div key={g.id} className="rounded-md border border-border p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant="outline" className={cn(
                      g.severity === "high" ? "bg-destructive/15 text-destructive border-destructive/30" :
                      g.severity === "medium" ? "bg-warning/20 text-warning border-warning/30" :
                      "bg-info/15 text-info border-info/30",
                    )}>{g.type}</Badge>
                    <span className="text-xs text-muted-foreground">{g.reason}</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-through">{g.text}</p>
                  <p className="text-sm font-medium text-foreground">→ {g.fix}</p>
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
              <ScoreBlock label="Citation quality" value={88} tone="warning" sub="3 issues found in APA style" />
              {citationIssues.map((c) => (
                <div key={c.id} className="flex items-start gap-3 rounded-md border border-border p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{c.ref}</p>
                    <p className="text-xs text-muted-foreground">{c.issue} · {c.style}</p>
                  </div>
                  <Button variant="outline" size="sm">Fix</Button>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="recs" className="mt-5 space-y-3">
              {recommendations.map((r, i) => (
                <div key={i} className="rounded-md border border-border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={cn(
                        r.priority === "High" ? "bg-destructive text-destructive-foreground" :
                        r.priority === "Medium" ? "bg-warning text-warning-foreground" :
                        "bg-muted text-muted-foreground",
                      )}>{r.priority}</Badge>
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{r.group}</span>
                    </div>
                    <span className="text-xs font-medium text-success">{r.impact}</span>
                  </div>
                  <p className="text-sm text-foreground">{r.action}</p>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: "success" | "warning" | "destructive"; label: string }) {
  const cls = color === "success" ? "bg-success" : color === "warning" ? "bg-warning" : "bg-destructive";
  return <div className="flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-full", cls)} />{label}</div>;
}

function ScoreBlock({ label, value, sub, tone }: { label: string; value: number; sub: string; tone: "success" | "warning" | "destructive" }) {
  const cls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-destructive";
  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={cn("mt-1 text-3xl font-semibold tracking-tight", cls)}>{value}{label.toLowerCase().includes("quality") ? "" : "%"}</p>
        </div>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <Progress value={value} className="mt-3" />
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "destructive" }) {
  const cls = tone === "success" ? "bg-success/10 text-success" : tone === "warning" ? "bg-warning/15 text-warning" : "bg-destructive/10 text-destructive";
  return (
    <div className={cn("rounded-md p-3 text-center", cls)}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
