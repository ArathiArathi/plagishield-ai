import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { IssueItem } from "./analysis-shared";

const CATS: Array<IssueItem["category"] | "All"> = ["All", "Plagiarism", "AI content", "Grammar", "Citation"];

const SEVERITY: Record<IssueItem["severity"], string> = {
  high: "bg-destructive/15 text-destructive border-destructive/30",
  medium: "bg-warning/20 text-warning border-warning/30",
  low: "bg-info/15 text-info border-info/30",
};

export function IssueList({ issues }: { issues: IssueItem[] }) {
  const [cat, setCat] = useState<(typeof CATS)[number]>("All");

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: issues.length };
    for (const i of issues) c[i.category] = (c[i.category] ?? 0) + 1;
    return c;
  }, [issues]);

  const filtered = cat === "All" ? issues : issues.filter((i) => i.category === cat);

  if (issues.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No issues were recorded for this submission.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)}>
            <Badge
              variant={cat === c ? "default" : "outline"}
              className="cursor-pointer gap-1.5"
            >
              {c}
              <span className="font-semibold">{counts[c] ?? 0}</span>
            </Badge>
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {filtered.map((i, n) => (
          <div key={n} className="rounded-md border border-border p-3">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn(SEVERITY[i.severity] ?? SEVERITY.low)}>
                {i.severity} severity
              </Badge>
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{i.category}</span>
            </div>
            <p className="text-sm font-medium text-foreground">{i.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{i.detail}</p>
            {i.excerpt && (
              <p className="mt-2 border-l-2 border-warning bg-warning/10 px-3 py-2 text-xs italic text-foreground/90">
                “{i.excerpt}”
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
