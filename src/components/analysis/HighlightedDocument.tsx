import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  buildSegments,
  CATEGORY_STYLE,
  type Highlight,
  type HighlightCategory,
} from "./analysis-shared";

const ORDER: HighlightCategory[] = ["plagiarism", "ai", "grammar", "citation"];

export function HighlightedDocument({
  text,
  highlights,
  className,
}: {
  text: string;
  highlights: Highlight[];
  className?: string;
}) {
  const [active, setActive] = useState<HighlightCategory[]>(ORDER);

  const visible = useMemo(
    () => highlights.filter((h) => active.includes(h.category)),
    [highlights, active],
  );
  const segments = useMemo(() => buildSegments(text, visible), [text, visible]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const h of highlights) c[h.category] = (c[h.category] ?? 0) + 1;
    return c;
  }, [highlights]);

  const toggle = (cat: HighlightCategory) =>
    setActive((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));

  if (!text.trim()) {
    return (
      <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No extracted document text is stored for this analysis. Re-analyze the document to generate highlights.
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {ORDER.map((cat) => (
          <button key={cat} type="button" onClick={() => toggle(cat)}>
            <Badge
              variant="outline"
              className={cn(
                "cursor-pointer gap-1.5",
                CATEGORY_STYLE[cat].chip,
                !active.includes(cat) && "opacity-40",
              )}
            >
              {CATEGORY_STYLE[cat].label}
              <span className="font-semibold">{counts[cat] ?? 0}</span>
            </Badge>
          </button>
        ))}
        <span className="text-xs text-muted-foreground">Click a category to toggle its highlights</span>
      </div>

      <div className="max-h-[460px] overflow-y-auto rounded-md border border-border bg-card p-4">
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">
          {segments.map((s, i) =>
            s.highlight ? (
              <mark
                key={i}
                title={`${CATEGORY_STYLE[s.highlight.category].label} · ${s.highlight.score}%${s.highlight.source ? ` · ${s.highlight.source}` : ""}${s.highlight.note ? ` · ${s.highlight.note}` : ""}`}
                className={cn("rounded px-0.5", CATEGORY_STYLE[s.highlight.category].mark)}
              >
                {s.text}
              </mark>
            ) : (
              <span key={i}>{s.text}</span>
            ),
          )}
        </p>
      </div>
    </div>
  );
}
