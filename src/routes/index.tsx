import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Activity, AlertTriangle, CheckCircle2, FileBarChart, FileText, Gauge,
  PercentIcon, Sparkles, Upload,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/layout/StatCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  aiContentAnalysis, recentActivity, similarityDistribution, submissionTrend,
  summaryStats,
} from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — PlagiShield AI" },
      { name: "description", content: "Overview of plagiarism, AI detection, and writing quality across your workspace." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Welcome back, Aarav"
        description="Here's what's happening across your workspace today."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/reports"><FileBarChart className="mr-1.5 h-4 w-4" />View reports</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/documents"><Upload className="mr-1.5 h-4 w-4" />Upload document</Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Quality Score" value={summaryStats.qualityScore} suffix="/100" icon={Gauge} delta={4} tone="primary" />
        <StatCard label="Similarity" value={summaryStats.similarity} suffix="%" icon={PercentIcon} delta={-3} tone="success" />
        <StatCard label="AI Detection" value={summaryStats.aiDetection} suffix="%" icon={Sparkles} delta={-2} tone="info" />
        <StatCard label="Grammar" value={summaryStats.grammar} suffix="/100" icon={CheckCircle2} delta={2} tone="success" />
        <StatCard label="Citation" value={summaryStats.citation} suffix="/100" icon={FileText} delta={1} tone="warning" />
        <StatCard label="Total Documents" value={summaryStats.totalDocuments.toLocaleString()} icon={Activity} delta={8} tone="primary" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Submission Trends</h3>
              <p className="text-xs text-muted-foreground">Total submissions and flagged documents</p>
            </div>
            <Badge variant="secondary" className="font-normal">Last 7 months</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={submissionTrend}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-destructive)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--color-destructive)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="submissions" stroke="var(--color-primary)" strokeWidth={2} fill="url(#g1)" />
                <Area type="monotone" dataKey="flagged" stroke="var(--color-destructive)" strokeWidth={2} fill="url(#g2)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">AI Content Analysis</h3>
            <p className="text-xs text-muted-foreground">Distribution of detected content</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={aiContentAnalysis} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>
                  {aiContentAnalysis.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Similarity Distribution</h3>
              <p className="text-xs text-muted-foreground">Documents grouped by similarity range</p>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={similarityDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="range" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {similarityDistribution.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Recent activity</h3>
            <Link to="/documents" className="text-xs font-medium text-primary hover:underline">View all</Link>
          </div>
          <ul className="space-y-3">
            {recentActivity.map((a) => {
              const tone =
                a.status === "success" ? "bg-success/15 text-success" :
                a.status === "warning" ? "bg-warning/20 text-warning" :
                a.status === "error" ? "bg-destructive/15 text-destructive" :
                "bg-info/15 text-info";
              const Icon = a.status === "warning" ? AlertTriangle : a.status === "error" ? AlertTriangle : a.status === "success" ? CheckCircle2 : Activity;
              return (
                <li key={a.id} className="flex items-start gap-3">
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.action} · {a.time}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
