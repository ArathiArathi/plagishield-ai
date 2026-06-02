import { createFileRoute } from "@tanstack/react-router";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, PolarAngleAxis, PolarGrid,
  Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/layout/StatCard";
import { Activity, AlertTriangle, FileText, Sparkles } from "lucide-react";
import { grammarRadar, submissionTrend } from "@/lib/mock-data";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Analytics — PlagiShield AI" }, { name: "description", content: "Workspace-wide analytics and usage trends." }] }),
  component: AnalyticsPage,
});

const commonErrors = [
  { type: "Citation", count: 142 }, { type: "Comma splice", count: 118 },
  { type: "Passive voice", count: 96 }, { type: "Run-on", count: 71 },
  { type: "Spelling", count: 54 }, { type: "Tense", count: 33 },
];

function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Deep insights across your workspace." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Documents" value="1,284" icon={FileText} delta={8} tone="primary" />
        <StatCard label="Avg Similarity" value="17.4%" icon={Activity} delta={-2} tone="success" />
        <StatCard label="Avg AI Detection" value="9.8%" icon={Sparkles} delta={-1} tone="info" />
        <StatCard label="Flagged Documents" value="186" icon={AlertTriangle} delta={5} tone="warning" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Usage trends</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={submissionTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="submissions" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="flagged" stroke="var(--color-destructive)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Writing quality radar</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={grammarRadar}>
                <PolarGrid stroke="var(--color-border)" />
                <PolarAngleAxis dataKey="subject" fontSize={11} stroke="var(--color-muted-foreground)" />
                <Radar dataKey="score" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.25} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Most common errors</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={commonErrors} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" fontSize={12} stroke="var(--color-muted-foreground)" />
                <YAxis dataKey="type" type="category" fontSize={12} stroke="var(--color-muted-foreground)" width={110} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
