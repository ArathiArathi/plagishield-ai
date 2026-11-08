/** Shared client-side types + helpers for rendering engine output (highlights,
 *  composition breakdown and the flat issue list) in the UI and in PDFs. */

export type HighlightCategory = "plagiarism" | "ai" | "grammar" | "citation";

export type Highlight = {
  start: number;
  end: number;
  text: string;
  category: HighlightCategory;
  score: number;
  source?: string;
  url?: string;
  note?: string;
  /** Verbatim passage from the retrieved source that matched this segment. */
  matched_snippet?: string;
  /** Retrieval provider / detector that produced this evidence. */
  provider?: string;
  confidence?: "high" | "medium" | "low";
};


export type CompositionSlice = { category: string; percent: number; words: number };

export type IssueItem = {
  category: "Plagiarism" | "AI content" | "Grammar" | "Citation";
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  excerpt?: string;
};

export const CATEGORY_STYLE: Record<HighlightCategory, { chip: string; mark: string; label: string }> = {
  plagiarism: {
    chip: "border-destructive/30 bg-destructive/15 text-destructive",
    mark: "bg-destructive/20 text-foreground underline decoration-destructive decoration-2",
    label: "Text similarity",
  },
  ai: {
    chip: "border-warning/30 bg-warning/20 text-warning",
    mark: "bg-warning/25 text-foreground underline decoration-warning decoration-2",
    label: "Writing-pattern signal",
  },
  grammar: {
    chip: "border-info/30 bg-info/15 text-info",
    mark: "bg-info/20 text-foreground underline decoration-info decoration-dotted decoration-2",
    label: "Grammar",
  },
  citation: {
    chip: "border-primary/30 bg-primary/15 text-primary",
    mark: "bg-primary/20 text-foreground underline decoration-primary decoration-2",
    label: "Citation",
  },
};

export const COMPOSITION_COLOR: Record<string, string> = {
  "Matched in retrieved sources": "var(--color-destructive)",
  "No match in retrieved sources": "var(--color-muted)",
};

export type Segment = { text: string; highlight?: Highlight };

/** Split the original text at every annotation boundary without dropping overlaps. */
export function buildSegments(text: string, highlights: Highlight[]): Segment[] {
  const valid = highlights
    .filter((h) =>
      Number.isFinite(h.start) &&
      Number.isFinite(h.end) &&
      h.start >= 0 &&
      h.end > h.start &&
      h.start < text.length,
    )
    .map((h) => ({ ...h, end: Math.min(h.end, text.length) }));

  const boundaries = new Set<number>([0, text.length]);
  for (const highlight of valid) {
    boundaries.add(highlight.start);
    boundaries.add(highlight.end);
  }

  const points = [...boundaries].sort((a, b) => a - b);
  const priority: Record<HighlightCategory, number> = {
    plagiarism: 4,
    grammar: 3,
    citation: 2,
    ai: 1,
  };
  const segments: Segment[] = [];

  for (let index = 0; index < points.length - 1; index++) {
    const start = points[index]!;
    const end = points[index + 1]!;
    if (end <= start) continue;

    const active = valid
      .filter((h) => h.start <= start && h.end >= end)
      .sort((a, b) =>
        priority[b.category] - priority[a.category] ||
        (a.end - a.start) - (b.end - b.start) ||
        b.score - a.score,
      );
    const highlight = active[0];
    const previous = segments[segments.length - 1];

    if (previous && previous.highlight === highlight) {
      previous.text += text.slice(start, end);
    } else {
      segments.push({
        text: text.slice(start, end),
        ...(highlight ? { highlight } : {}),
      });
    }
  }

  return segments;
}
