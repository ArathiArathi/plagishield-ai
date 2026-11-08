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
  alternate_sources?: Array<{ source: string; url?: string; type: string }>;
};

export type CompositionSlice = { category: string; percent: number; words: number };

export type IssueItem = {
  category: "Plagiarism" | "AI content" | "Grammar" | "Citation";
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  excerpt?: string;
};

export const CATEGORY_STYLE: Record<
  HighlightCategory,
  { chip: string; mark: string; label: string; dot: string; color: string }
> = {
  plagiarism: {
    chip: "border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400",
    mark: "bg-red-500/20 text-foreground underline decoration-red-500 decoration-2",
    label: "Text similarity",
    dot: "bg-red-500",
    color: "#ef4444",
  },
  ai: {
    chip: "border-amber-500/30 bg-amber-500/20 text-amber-600 dark:text-amber-400",
    mark: "bg-amber-500/25 text-foreground underline decoration-amber-500 decoration-2",
    label: "Writing-pattern signal",
    dot: "bg-amber-500",
    color: "#f59e0b",
  },
  grammar: {
    chip: "border-sky-500/30 bg-sky-500/15 text-sky-600 dark:text-sky-400",
    mark: "bg-sky-500/20 text-foreground underline decoration-sky-500 decoration-dotted decoration-2",
    label: "Grammar",
    dot: "bg-sky-500",
    color: "#0284c7",
  },
  citation: {
    chip: "border-purple-500/30 bg-purple-500/15 text-purple-600 dark:text-purple-400",
    mark: "bg-purple-500/20 text-foreground underline decoration-purple-500 decoration-2",
    label: "Citation",
    dot: "bg-purple-500",
    color: "#8b5cf6",
  },
};

export const COMPOSITION_COLOR: Record<string, string> = {
  "Matched in retrieved sources": "#ef4444",
  "No match in retrieved sources": "#10b981",
  "Original text": "#10b981",
  "Writing-pattern signals": "#f59e0b",
  "Grammar issues": "#0284c7",
  "Citations & references": "#8b5cf6",
};

export type Segment = { text: string; highlight?: Highlight };

/** Split the original text at every annotation boundary without dropping overlaps. */
export function buildSegments(text: string, highlights: Highlight[]): Segment[] {
  const valid = highlights
    .filter(
      (h) =>
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
      .sort(
        (a, b) =>
          priority[b.category] - priority[a.category] ||
          a.end - a.start - (b.end - b.start) ||
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
