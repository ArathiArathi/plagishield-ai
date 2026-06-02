import { createFileRoute } from "@tanstack/react-router";
import { Download, FileBarChart, Share2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { recommendations, similarityDistribution } from "@/lib/mock-data";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports — PlagiShield AI" }, { name: "description", content: "Generate, export, and share analysis reports." }] }),
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Professional, exportable summaries of every analysis."
        actions={
          <>
            <Button variant="outline" size="sm"><Share2 className="mr-1.5 h-4 w-4" />Share</Button>
            <Button variant="outline" size="sm"><Download className="mr-1.5 h-4 w-4" />Export Excel</Button>
            <Button size="sm"><Download className="mr-1.5 h-4 w-4" />Export PDF</Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        <div className="border-b border-border bg-[image:var(--gradient-subtle)] p-6">
          <div className="flex items-center gap-2"><FileBarChart className="h-5 w-5 text-primary" /><Badge variant="secondary">Report #RPT-2026-00482</Badge></div>
          <h2 className="mt-3 text-2xl font-semibold text-foreground">Thesis Integrity Report</h2>
          <p className="text-sm text-muted-foreground">Generated June 2, 2026 · Aarav Patel · 24 pages</p>
        </div>

        <div className="space-y-8 p-6">
          <Section title="Executive Summary">
            <p className="text-sm leading-relaxed text-muted-foreground">
              The submitted document demonstrates strong originality with an overall similarity of 14%, well below the institutional
              threshold of 25%. AI-generated content is limited to 6%, and writing quality scores at 92/100. Three citation issues
              should be addressed before final submission.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KPI label="Similarity" value="14%" />
              <KPI label="AI Detection" value="6%" />
              <KPI label="Grammar" value="92" />
              <KPI label="Citation" value="88" />
            </div>
          </Section>

          <Separator />

          <Section title="Similarity Analysis">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={similarityDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="range" fontSize={12} stroke="var(--color-muted-foreground)" />
                  <YAxis fontSize={12} stroke="var(--color-muted-foreground)" />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Separator />

          <Section title="Recommendations">
            <ul className="space-y-2">
              {recommendations.map((r, i) => (
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
