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
    label: "Plagiarism",
  },
  ai: {
    chip: "border-warning/30 bg-warning/20 text-warning",
    mark: "bg-warning/25 text-foreground underline decoration-warning decoration-2",
    label: "AI content",
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
  "Plagiarised / matched": "var(--color-destructive)",
  "AI generated": "var(--color-warning)",
  "Quoted & attributed": "var(--color-info)",
  "Language issues": "var(--color-primary)",
  "Original human writing": "var(--color-success)",
};

export type Segment = { text: string; highlight?: Highlight };

/** Flatten possibly-overlapping highlights into non-overlapping text segments. */
export function buildSegments(text: string, highlights: Highlight[]): Segment[] {
  const valid = highlights
    .filter((h) => Number.isFinite(h.start) && Number.isFinite(h.end) && h.end > h.start && h.start < text.length)
    .map((h) => ({ ...h, end: Math.min(h.end, text.length) }))
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const h of valid) {
    if (h.start < cursor) continue; // skip overlap
    if (h.start > cursor) segments.push({ text: text.slice(cursor, h.start) });
    segments.push({ text: text.slice(h.start, h.end), highlight: h });
    cursor = h.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}
