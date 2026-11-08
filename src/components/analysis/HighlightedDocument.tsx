import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  buildSegments,
  CATEGORY_STYLE,
  type Highlight,
  type HighlightCategory,
} from "./analysis-shared";

const ORDER: HighlightCategory[] = ["plagiarism", "grammar", "citation"];

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

  const sourceColors = ["#FDE68A", "#BFDBFE", "#BBF7D0", "#FBCFE8", "#DDD6FE", "#FED7AA"];
  const sourceNumbers = useMemo(() => {
    const map = new Map<string, number>();
    for (const highlight of highlights) {
      if (highlight.category !== "plagiarism" || !highlight.source) continue;
      const key = highlight.source + (highlight.url ?? "");
      if (!map.has(key)) map.set(key, map.size + 1);
    }
    return map;
  }, [highlights]);

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

      <div className="max-h-[460px] overflow-y-auto overflow-x-hidden rounded-md border border-border bg-card p-4 min-w-0">
        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[13px] leading-relaxed text-foreground/90">
          {segments.map((s, i) =>
            s.highlight ? (
              <mark
                key={i}
                title={`${CATEGORY_STYLE[s.highlight.category].label}${s.highlight.category === "plagiarism" ? " · exact phrase match" : ""}${s.highlight.source ? ` · ${s.highlight.source}` : ""}${s.highlight.note ? ` · ${s.highlight.note}` : ""}`}
                className={cn("rounded px-0.5", CATEGORY_STYLE[s.highlight.category].mark)}
                style={s.highlight.category === "plagiarism" && s.highlight.source ? {
                  backgroundColor: sourceColors[((sourceNumbers.get(s.highlight.source + (s.highlight.url ?? "")) ?? 1) - 1) % sourceColors.length],
                  borderBottom: "2px solid #64748b",
                  color: "#1f2937",
                } : undefined}
              >
                {s.text}
                {s.highlight.category === "plagiarism" && s.highlight.source ? (
                  <sup className="ml-0.5 text-[9px] font-semibold text-slate-700">{sourceNumbers.get(s.highlight.source + (s.highlight.url ?? ""))}</sup>
                ) : null}
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
