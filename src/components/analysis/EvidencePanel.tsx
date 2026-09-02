import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CATEGORY_STYLE, type Highlight } from "./analysis-shared";

const CONF_TONE: Record<string, string> = {
  high: "border-destructive/30 bg-destructive/10 text-destructive",
  medium: "border-warning/30 bg-warning/15 text-warning",
  low: "border-border bg-muted text-muted-foreground",
};

function confidenceOf(h: Highlight): "high" | "medium" | "low" {
  if (h.confidence) return h.confidence;
  return h.score >= 70 ? "high" : h.score >= 45 ? "medium" : "low";
}

/**
 * Evidence panel — per highlighted segment it shows the submitted excerpt, the
 * exact matched source snippet, the retrieval provider and a confidence badge.
 */
export function EvidencePanel({
  highlights,
  className,
  limit = 30,
}: {
  highlights: Highlight[];
  className?: string;
  limit?: number;
}) {
  const items = [...highlights].sort((a, b) => b.score - a.score).slice(0, limit);

  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No evidence segments were recorded — nothing was matched or flagged in this submission.
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {items.map((h, i) => {
        const conf = confidenceOf(h);
        return (
          <div key={`${h.start}-${h.category}-${i}`} className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={CATEGORY_STYLE[h.category].chip}>
                {CATEGORY_STYLE[h.category].label}
              </Badge>
              <Badge variant="outline" className={cn("capitalize", CONF_TONE[conf])}>
                {conf} confidence · {Math.round(h.score)}%
              </Badge>
              {h.provider && (
                <span className="text-xs text-muted-foreground">Detected by {h.provider}</span>
              )}
            </div>

            <div className="mt-3 space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Submitted text
                </p>
                <p className="mt-1 rounded-md border border-border bg-card p-2.5 text-[13px] leading-relaxed text-foreground/90">
                  {h.text.slice(0, 600)}
                </p>
              </div>

              {h.matched_snippet && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Matched source snippet
                  </p>
                  <p className="mt-1 rounded-md border border-border bg-card p-2.5 text-[13px] leading-relaxed text-muted-foreground">
                    “{h.matched_snippet}”
                  </p>
                </div>
              )}

              {(h.source || h.url || h.note) && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {h.source && <span className="font-medium text-foreground">{h.source}</span>}
                  {h.note && <span>· {h.note}</span>}
                  {h.url && (
                    <a
                      href={h.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      View source <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
