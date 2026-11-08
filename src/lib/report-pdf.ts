/* eslint-disable no-control-regex */
import { jsPDF } from "jspdf";
import { buildSegments, type Highlight } from "@/components/analysis/analysis-shared";

/* ------------------------------------------------------------------ types */

export type PdfHighlight = {
  start?: number;
  end?: number;
  text?: string;
  category?: string;
  score?: number;
  source?: string;
  url?: string;
  note?: string;
};

export type PdfCompositionSlice = { category: string; percent: number; words: number };

export type PdfIssue = {
  category?: string;
  severity?: string;
  title?: string;
  detail?: string;
  excerpt?: string;
};

export type ReportResults = {
  text_excerpt?: string;
  meta?: { engine_version?: string; extraction?: string; words?: number; sentences?: number; characters?: number; sources_queried?: number; checked_at?: string };
  plagiarism?: {
    matched_words?: number;
    matches?: Array<{ source?: string; url?: string; similarity?: number; snippet?: string; type?: string; matched_snippet?: string; provider?: string; matched_words?: number; match_count?: number; match_strength?: number; domain?: string }>;
    highlights?: PdfHighlight[];
    source_coverage?: { sources_retrieved?: number; providers?: string[]; matching_method?: string; limitation?: string; comparison_words?: number; excluded_quoted_words?: number; excluded_bibliography_words?: number };
  };
  ai_detection?: { score?: number | null; confidence?: string; reasoning?: string; highlights?: PdfHighlight[] };
  grammar?: { score?: number | null; provider?: string; issues?: Array<{ type?: string; severity?: string; text?: string; suggestion?: string }>; highlights?: PdfHighlight[] };
  citations?: { score?: number | null; total?: number; verified?: number; issues?: string[] };
  composition?: PdfCompositionSlice[];
  issues?: PdfIssue[];
};

export type ReportInput = {
  documentName: string;
  fileType: string;
  version: number | string;
  analysisId: string;
  generatedAt: string;
  docType?: string | null;
  authorName?: string | null;
  paperTitle?: string | null;
  similarity: number;
  ai: number | null;
  grammar: number | null;
  citation: number | null;
  results: ReportResults;
};

export type ReportKind = "similarity" | "ai" | "grammar" | "citation" | "full";

/* ------------------------------------------------------------- primitives */

const NAVY: [number, number, number] = [16, 36, 71];
const ACCENT: [number, number, number] = [37, 99, 235];
const MUTED: [number, number, number] = [110, 122, 140];
const LINE: [number, number, number] = [222, 228, 236];
const OK: [number, number, number] = [22, 138, 92];
const WARN: [number, number, number] = [201, 138, 4];
const BAD: [number, number, number] = [200, 55, 55];

const M = 15; // page margin
const W = 210;
const H = 297;

type Ctx = { doc: jsPDF; y: number; title: string; input: ReportInput; page: number };

export function sanitizePdfText(str: unknown): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u2014]/g, " -- ")
    .replace(/[\u2013]/g, "-")
    .replace(/[\u2026]/g, "...")
    .replace(/[\u2022]/g, "* ")
    .replace(/[\u00B7]/g, "|")
    .replace(/[\u2212]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/\0/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

function toneFor(kind: ReportKind, value: number): [number, number, number] {
  // Similarity and AI-style indicators have no universal pass/fail threshold.
  // Keep their visual treatment neutral instead of assigning a misleading grade.
  if (kind === "similarity" || kind === "ai") return ACCENT;
  const good = value >= 80;
  const mid = value >= 60;
  return good ? OK : mid ? WARN : BAD;
}

function header(ctx: Ctx) {
  const { doc } = ctx;
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 22, "F");

  // Logo shield crest
  doc.setFillColor(...ACCENT);
  doc.roundedRect(M, 5.5, 9, 11, 2, 2, "F");
  doc.setFillColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(7.5);
  doc.text("P", M + 4.5, 13, { align: "center" });

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(13);
  doc.text("PlagiShield AI", M + 12.5, 12);
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.setTextColor(200, 214, 235);
  doc.text("Document Similarity & Writing Review", M + 12.5, 17.5);

  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(sanitizePdfText(ctx.title), W - M, 12, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.setTextColor(200, 214, 235);
  const refId = ctx.input.analysisId ? ctx.input.analysisId.slice(0, 8).toUpperCase() : "Not recorded";
  doc.text(`Ref ${refId}`, W - M, 17.5, { align: "right" });
  ctx.y = 30;
}

function footer(ctx: Ctx) {
  const { doc } = ctx;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(M, H - 16, W - M, H - 16);
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
  const docName = sanitizePdfText(ctx.input.documentName || "document");
  const genAt = sanitizePdfText(ctx.input.generatedAt || "Not recorded");
  doc.text(`${docName} · generated ${genAt}`, M, H - 11);
  doc.text(`Page ${ctx.page}`, W - M, H - 11, { align: "right" });
}

function newPage(ctx: Ctx) {
  footer(ctx);
  ctx.doc.addPage();
  ctx.page += 1;
  header(ctx);
}

function ensure(ctx: Ctx, needed: number) {
  if (ctx.y + needed > H - 22) newPage(ctx);
}

function sectionTitle(ctx: Ctx, text: string) {
  ensure(ctx, 30);
  const { doc } = ctx;
  doc.setFillColor(...ACCENT);
  doc.rect(M, ctx.y - 3.5, 2.5, 5.5, "F");
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...NAVY);
  doc.text(sanitizePdfText(text), M + 5, ctx.y);
  ctx.y += 5;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(M, ctx.y, W - M, ctx.y);
  ctx.y += 7;
}

function paragraph(ctx: Ctx, text: string, opts: { size?: number; color?: [number, number, number] } = {}) {
  const { doc } = ctx;
  const safeText = sanitizePdfText(text);
  doc.setFont("helvetica", "normal").setFontSize(opts.size ?? 9.5).setTextColor(...(opts.color ?? [60, 70, 85]));
  const lines = doc.splitTextToSize(safeText, W - 2 * M) as string[];
  for (const line of lines) {
    ensure(ctx, 6);
    doc.text(line, M, ctx.y);
    ctx.y += 4.8;
  }
  ctx.y += 3;
}

function metaTable(ctx: Ctx, rows: Array<[string, string]>) {
  const { doc } = ctx;
  const labelWidth = 58;
  const valueWidth = W - 2 * M - labelWidth - 8;
  for (const [key, value] of rows) {
    doc.setFont("helvetica", "normal").setFontSize(8);
    const lines = doc.splitTextToSize(sanitizePdfText(value || "Not provided"), valueWidth) as string[];
    const rowH = Math.max(7, lines.length * 3.8 + 3);
    ensure(ctx, rowH + 2);
    const y = ctx.y;
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...NAVY);
    doc.text(sanitizePdfText(key), M + 3, y);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(60, 70, 85);
    lines.forEach((line, index) => doc.text(line, M + labelWidth, y + index * 3.8));
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(M, y + rowH - 1, W - M, y + rowH - 1);
    ctx.y += rowH;
  }
  ctx.y += 5;
}

function scoreCards(ctx: Ctx, cards: Array<{ label: string; value: string; tone: [number, number, number] }>) {
  const { doc } = ctx;
  ensure(ctx, 28);
  const gap = 4;
  const cw = (W - 2 * M - gap * (cards.length - 1)) / cards.length;
  cards.forEach((c, i) => {
    const x = M + i * (cw + gap);
    doc.setFillColor(250, 251, 253);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.rect(x, ctx.y, cw, 22, "FD");
    doc.setFillColor(...c.tone);
    doc.rect(x, ctx.y, cw, 2.2, "F");
    doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...c.tone);
    doc.text(c.value, x + cw / 2, ctx.y + 12, { align: "center" });
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...MUTED);
    doc.text(c.label.toUpperCase(), x + cw / 2, ctx.y + 18, { align: "center" });
  });
  ctx.y += 28;
}

function gauge(ctx: Ctx, label: string, value: number, tone: [number, number, number], caption: string) {
  const { doc } = ctx;
  ensure(ctx, 25);
  doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...NAVY);
  doc.text(label, M, ctx.y);
  doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...tone);
  doc.text(`${value}%`, W - M, ctx.y, { align: "right" });
  ctx.y += 3.5;
  const barW = W - 2 * M;
  doc.setFillColor(235, 239, 245);
  doc.rect(M, ctx.y, barW, 4.5, "F");
  doc.setFillColor(...tone);
  doc.rect(M, ctx.y, Math.max(1, (barW * Math.min(100, Math.max(0, value))) / 100), 4.5, "F");
  ctx.y += 8.5;
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
  const lines = doc.splitTextToSize(caption, barW) as string[];
  for (const l of lines) {
    ensure(ctx, 5);
    doc.text(l, M, ctx.y);
    ctx.y += 4.2;
  }
  ctx.y += 3;
}

function table(
  ctx: Ctx,
  columns: Array<{ header: string; width: number; align?: "left" | "right" }>,
  rows: string[][],
) {
  const { doc } = ctx;
  const total = columns.reduce((s, c) => s + c.width, 0) || 1;
  const scale = (W - 2 * M) / total;
  const widths = columns.map((c) => Math.max(12, c.width * scale));

  const drawHead = () => {
    ensure(ctx, 12);
    doc.setFillColor(...NAVY);
    doc.rect(M, ctx.y, W - 2 * M, 7.5, "F");
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(255, 255, 255);
    let x = M;
    columns.forEach((c, i) => {
      const right = c.align === "right";
      const headerText = sanitizePdfText(c.header);
      doc.text(headerText, right ? x + widths[i]! - 3 : x + 3, ctx.y + 5, { align: right ? "right" : "left" });
      x += widths[i]!;
    });
    ctx.y += 7.5;
  };

  drawHead();

  rows.forEach((row, ri) => {
    doc.setFont("helvetica", "normal").setFontSize(8);
    const cellLines = row.map((cell, i) => {
      const colWidth = Math.max(10, (widths[i] ?? 20) - 6);
      const safeText = sanitizePdfText(cell ?? "");
      return doc.splitTextToSize(safeText, colWidth) as string[];
    });
    const maxLineCount = Math.max(1, ...cellLines.map((l) => l.length));
    const rowH = Math.max(7, maxLineCount * 3.8 + 3);
    if (ctx.y + rowH > H - 22) {
      newPage(ctx);
      drawHead();
      doc.setFont("helvetica", "normal").setFontSize(8);
    }
    if (ri % 2 === 0) {
      doc.setFillColor(247, 249, 252);
      doc.rect(M, ctx.y, W - 2 * M, rowH, "F");
    }
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(M, ctx.y + rowH, W - M, ctx.y + rowH);
    let x = M;
    cellLines.forEach((lines, i) => {
      const right = columns[i]?.align === "right";
      doc.setTextColor(50, 60, 75);
      lines.forEach((l, li) => {
        doc.text(l, right ? x + widths[i]! - 3 : x + 3, ctx.y + 4.8 + li * 3.8, { align: right ? "right" : "left" });
      });
      x += widths[i]!;
    });
    ctx.y += rowH;
  });
  ctx.y += 6;
}

function titleCase(v: string) {
  return v.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ------------------------------------------- academic paper header & block */

/** Formats the header and title block matching the academic paper layout
 *  (Title, Authors, Affiliation, Abstract Callout, Keywords, Institutional Seal). */
function academicPaperHeader(ctx: Ctx, input: ReportInput) {
  const { doc } = ctx;
  ensure(ctx, 38);
  const paperTitle = sanitizePdfText(input.paperTitle || input.documentName.replace(/\.[a-z0-9]+$/i, "") || "Untitled document");
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...ACCENT);
  doc.text("DOCUMENT SIMILARITY & WRITING REVIEW", W / 2, ctx.y, { align: "center" });
  ctx.y += 7;
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...NAVY);
  const titleLines = doc.splitTextToSize(paperTitle, W - 2 * M - 10) as string[];
  titleLines.forEach((line) => {
    ensure(ctx, 7);
    doc.text(line, W / 2, ctx.y, { align: "center" });
    ctx.y += 5.2;
  });
  if (input.authorName) {
    ctx.y += 2;
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(40, 50, 70);
    doc.text(sanitizePdfText(input.authorName), W / 2, ctx.y, { align: "center" });
    ctx.y += 5;
  }
  ctx.y += 4;
  paragraph(ctx, "The submitted text is reproduced in this report with evidence-linked highlights. Review each match against its source and surrounding context.", { size: 8, color: MUTED });
}

function documentBlock(ctx: Ctx, input: ReportInput) {
  const docName = sanitizePdfText(input.documentName || "document");
  const refId = input.analysisId ? input.analysisId.slice(0, 8).toUpperCase() : "Not recorded";
  const rows: Array<[string, string]> = [
    ["Document filename", docName],
    ["Paper title", input.paperTitle || docName.replace(/\.[a-z0-9]+$/i, "")],
    ["Author", input.authorName || "Author not provided"],
    ["Submission type", input.docType ? titleCase(input.docType) : "Not provided"],
    ["Format & version", `${String(input.fileType || "Not recorded").toUpperCase()} · v${input.version ?? "Not recorded"}`],
    ["Analysis reference ID", refId],
    ["Analysis engine", input.results.meta?.engine_version || "Not recorded"],
    ["Word count", input.results.meta?.words != null ? Number(input.results.meta.words).toLocaleString() : "Not recorded"],
    ["Extracted text", input.results.meta?.extraction || "Not recorded"],
    ["Analysis generated", input.generatedAt || new Date().toLocaleString()],
  ];
  metaTable(ctx, rows);
}

/* ------------------------------------------- visual graphs & charts in jsPDF */

/** Visual Graph 1: Multi-metric integrity benchmark bar graph
 *  Renders an authentic vector-rendered bar chart in jsPDF with axes, gridlines,
 *  colored bars, threshold tolerance lines, and bold score callouts. */
function matchedSourcesBarChart(ctx: Ctx, matches: Array<{ source?: string; similarity?: number }>) {
  const { doc } = ctx;
  if (!matches || matches.length === 0) return;

  const topMatches = matches.slice(0, 5);
  ensure(ctx, topMatches.length * 9 + 25);

  sectionTitle(ctx, "Matched Sources — Overlap Distribution Chart");

  const startY = ctx.y;
  const labelW = 60;
  const barMaxW = W - 2 * M - labelW - 20;

  topMatches.forEach((m, idx) => {
    const y = startY + idx * 8.5;
    const sim = Math.min(100, Math.max(1, Math.round(Number(m.similarity ?? 0))));
    const tone: [number, number, number] = sim >= 25 ? BAD : sim >= 12 ? WARN : ACCENT;

    // Source Name
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...NAVY);
    const sourceName = (m.source ?? "Scholarly Publication").length > 36
      ? (m.source ?? "Scholarly Publication").slice(0, 36) + "…"
      : (m.source ?? "Scholarly Publication");
    doc.text(sourceName, M, y + 4);

    // Background track
    const barX = M + labelW;
    doc.setFillColor(240, 243, 248);
    doc.roundedRect(barX, y, barMaxW, 5, 1, 1, "F");

    // Proportional filled bar
    const filledW = Math.max(3, (barMaxW * sim) / 100);
    doc.setFillColor(...tone);
    doc.roundedRect(barX, y, filledW, 5, 1, 1, "F");

    // Percentage value text
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...tone);
    doc.text(`${sim}%`, barX + barMaxW + 4, y + 4);
  });

  ctx.y = startY + topMatches.length * 8.5 + 4;
}

/** Visual Graph 3: AI Likelihood Spectrum Dial
 *  Visual gradient indicator showing where the text lies on the Synthetic spectrum. */
function grammarCategoryGraph(ctx: Ctx, issues: Array<{ type?: string; severity?: string }>) {
  const { doc } = ctx;
  if (!issues || issues.length === 0) return;

  const byType = issues.reduce<Record<string, number>>((acc, i) => {
    const k = titleCase(i.type ?? "syntax");
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  const entries = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 5);
  ensure(ctx, entries.length * 8 + 20);

  sectionTitle(ctx, "Grammar & Stylistic Issues by Category");

  const startY = ctx.y;
  const labelW = 45;
  const barMaxW = W - 2 * M - labelW - 20;
  const maxCount = Math.max(...entries.map((e) => e[1])) || 1;

  entries.forEach(([cat, count], idx) => {
    const y = startY + idx * 7.5;
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...NAVY);
    doc.text(cat, M, y + 4);

    const barX = M + labelW;
    doc.setFillColor(240, 243, 248);
    doc.roundedRect(barX, y, barMaxW, 4.5, 1, 1, "F");

    const filledW = Math.max(3, (barMaxW * count) / maxCount);
    doc.setFillColor(...ACCENT);
    doc.roundedRect(barX, y, filledW, 4.5, 1, 1, "F");

    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...ACCENT);
    doc.text(`${count} issue${count > 1 ? "s" : ""}`, barX + barMaxW + 3, y + 3.8);
  });

  ctx.y = startY + entries.length * 7.5 + 4;
}

/* ------------------------------------------- composition, highlights, issues */

const CATEGORY_FILL: Record<string, [number, number, number]> = {
  plagiarism: [255, 214, 214],
  ai: [255, 235, 186],
  grammar: [214, 231, 255],
  citation: [212, 236, 224],
};

const CATEGORY_LABEL: Record<string, string> = {
  plagiarism: "Text similarity match",
  ai: "AI-style indicator",
  grammar: "Language & grammar issue",
  citation: "Scholarly citation",
};

function legendRow(ctx: Ctx, categories: string[]) {
  const { doc } = ctx;
  ensure(ctx, 10);
  let x = M;
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
  categories.forEach((c) => {
    doc.setFillColor(...(CATEGORY_FILL[c] ?? [230, 230, 230]));
    doc.rect(x, ctx.y - 3, 4, 4, "F");
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.rect(x, ctx.y - 3, 4, 4);
    const label = CATEGORY_LABEL[c] ?? c;
    doc.text(label, x + 5.5, ctx.y);
    x += 6 + doc.getTextWidth(label) + 6;
  });
  ctx.y += 7;
}

const MAX_BODY_CHARS = 120000;

/** Highlights issues directly in the text as per report type.
 *  Color coded: Red (Plagiarism), Amber (AI), Blue (Grammar), Green (Citations). */
function highlightedBody(ctx: Ctx, input: ReportInput, categories: string[]) {
  const raw = input.results.text_excerpt ?? "";
  const highlights = ([] as PdfHighlight[])
    .concat(input.results.plagiarism?.highlights ?? [])
    .concat(input.results.ai_detection?.highlights ?? [])
    .concat(input.results.grammar?.highlights ?? [])
    .filter((h) => categories.includes(String(h.category)));

  sectionTitle(ctx, "Submission Text — Highlighted Issue Annotations");
  if (!raw.trim()) {
    paragraph(ctx, "The extracted submission text is not stored for this analysis, so in-text highlighting is unavailable. Re-analyze the document to generate full annotations.");
    return;
  }

  legendRow(ctx, categories);

  const text = raw.slice(0, MAX_BODY_CHARS);
  const segments = buildSegments(text, highlights as unknown as Highlight[]);

  const { doc } = ctx;
  const lineH = 4.4;
  const setBody = () => doc.setFont("helvetica", "normal").setFontSize(8);
  setBody();
  let x = M;
  ensure(ctx, 12);

  for (const seg of segments) {
    const safeSegmentText = sanitizePdfText(seg.text);
    const tokens = safeSegmentText.split(/(\s+)/).filter((t) => t !== "");
    for (const tk of tokens) {
      if (/\n/.test(tk)) {
        x = M;
        ctx.y += lineH;
        if (ctx.y > H - 24) { newPage(ctx); setBody(); }
        continue;
      }
      const w = doc.getTextWidth(tk);
      if (x + w > W - M) {
        x = M;
        ctx.y += lineH;
        if (ctx.y > H - 24) { newPage(ctx); setBody(); }
      }
      if (/^\s+$/.test(tk)) {
        if (x > M) x += w;
        continue;
      }
      if (seg.highlight) {
        doc.setFillColor(...(CATEGORY_FILL[String(seg.highlight.category)] ?? [235, 235, 235]));
        doc.rect(x - 0.4, ctx.y - 3, w + 0.8, 4.2, "F");
      }
      doc.setTextColor(35, 45, 60);
      doc.text(tk, x, ctx.y);
      x += w;
    }
  }
  ctx.y += lineH + 4;
  if (raw.length > MAX_BODY_CHARS) {
    paragraph(ctx, "The extracted text exceeded the analysis engine 120,000-character ingestion limit. The original uploaded file remains the authoritative copy.", { size: 7.5, color: MUTED });
  }
}

function issuesSection(ctx: Ctx, input: ReportInput, categories?: string[]) {
  const all = input.results.issues ?? [];
  const issues = categories ? all.filter((i) => categories.some((c) => i.category?.toLowerCase().includes(c.toLowerCase()))) : all;
  sectionTitle(ctx, "Detailed Issue & Forensic Action Log");
  if (issues.length === 0) {
    paragraph(ctx, "No integrity or stylistic issues were flagged for this submission.");
    return;
  }
  const bySeverity = issues.reduce<Record<string, number>>((acc, i) => {
    const k = (i.severity ?? "low").toLowerCase();
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  scoreCards(ctx, [
    { label: "Total issues", value: String(issues.length), tone: ACCENT },
    { label: "High severity", value: String(bySeverity.high ?? 0), tone: (bySeverity.high ?? 0) > 0 ? BAD : OK },
    { label: "Medium", value: String(bySeverity.medium ?? 0), tone: (bySeverity.medium ?? 0) > 0 ? WARN : OK },
    { label: "Low", value: String(bySeverity.low ?? 0), tone: OK },
  ]);
  table(
    ctx,
    [
      { header: "#", width: 8 },
      { header: "Category", width: 26 },
      { header: "Sev.", width: 16 },
      { header: "Issue Title", width: 50 },
      { header: "Detail / Excerpt", width: 66 },
    ],
    issues.map((i, n) => [
      String(n + 1),
      i.category ?? "—",
      (i.severity ?? "low").toUpperCase(),
      i.title ?? "—",
      [i.detail, i.excerpt ? `“${i.excerpt}”` : ""].filter(Boolean).join(" "),
    ]),
  );
}

/* ------------------------------------------------------------- report body */

const KIND_TITLE: Record<ReportKind, string> = {
  similarity: "Similarity & Plagiarism Report",
  ai: "AI Authorship Assessment Status",
  grammar: "Grammar & Academic Language Report",
  citation: "Citation Verification Report",
  full: "Comprehensive Integrity Dossier",
};

function similaritySection(ctx: Ctx, input: ReportInput) {
  const plagiarism = input.results.plagiarism ?? {};
  const matches = plagiarism.matches ?? [];
  const coverage = plagiarism.source_coverage;
  const tone = toneFor("similarity", input.similarity);
  sectionTitle(ctx, "Similarity Overview & Source Coverage");
  gauge(
    ctx,
    "Observed text similarity in retrieved sources",
    input.similarity,
    tone,
    `${Number(plagiarism.highlights?.length ?? 0)} highlighted passage(s), ${Number(plagiarism.matched_words ?? 0).toLocaleString()} matched words, and ${matches.length} retrieved source(s). Similarity is a text-overlap measure, not a plagiarism verdict.`,
  );
  paragraph(ctx, "The percentage is the share of eligible document words covered by exact matches in the retrieved source set. Detected quotations and a detected reference-list section are excluded. A match is not, by itself, a plagiarism finding.", { size: 8, color: MUTED });

  matchedSourcesBarChart(ctx, matches);

  sectionTitle(ctx, "Matched Sources & Evidence");
  if (matches.length === 0) {
    paragraph(ctx, "No exact source passages meeting the minimum matching rule were found in the retrieved source set.");
  } else {
    table(
      ctx,
      [
        { header: "#", width: 7 },
        { header: "Source / Domain", width: 42 },
        { header: "Submission passage", width: 48 },
        { header: "Source passage", width: 48 },
        { header: "Words", width: 15, align: "right" },
        { header: "Doc %", width: 15, align: "right" },
      ],
      matches.map((m, i) => [
        String(i + 1),
        [m.source ?? "Unknown source", m.domain ?? ""].filter(Boolean).join(" · "),
        m.snippet ?? "—",
        m.matched_snippet ?? "—",
        Number(m.matched_words ?? 0).toLocaleString(),
        `${Number(m.similarity ?? 0).toFixed(1)}%`,
      ]),
    );
  }

  sectionTitle(ctx, "Comparison Scope, Filters & Limitations");
  const providers = coverage?.providers?.length ? coverage.providers.join(", ") : "No provider details recorded";
  const scopeRows: Array<[string, string]> = [
    ["Source records compared", String(coverage?.sources_retrieved ?? matches.length)],
    ["Retrieval providers", providers],
    ["Matching rule", coverage?.matching_method || "Not recorded"],
    ["Quoted passages", "Included — quote exclusion is not currently applied"],
    ["Bibliography / references", "Included — bibliography exclusion is not currently applied"],
    ["Private student-paper repository", "Not connected"],
    ["Licensed publisher full-text corpus", "Not connected"],
  ];
  table(
    ctx,
    [{ header: "Comparison setting", width: 58 }, { header: "Applied scope", width: 117 }],
    scopeRows,
  );
  paragraph(
    ctx,
    coverage?.limitation || "This report compares against the source records retrieved for this run only. It does not represent exhaustive web, journal, or private repository coverage.",
    { size: 7.5, color: MUTED },
  );
}

function aiSection(ctx: Ctx, input: ReportInput) {
  const det = input.results.ai_detection ?? {};
  sectionTitle(ctx, "AI Authorship Assessment");
  paragraph(ctx, "Not assessed. This deployment does not have an independently validated AI-authorship detector and representative benchmark dataset. PlagiShield therefore does not invent an AI probability or label passages as AI-written.", { size: 9 });
  if (det.reasoning?.trim()) {
    sectionTitle(ctx, "Assessment Status");
    paragraph(ctx, det.reasoning.trim());
  }
}

function grammarSection(ctx: Ctx, input: ReportInput) {
  const issues = input.results.grammar?.issues ?? [];
  sectionTitle(ctx, "Grammar & Language Review");
  paragraph(ctx, issues.length + " issue(s) were returned by " + (input.results.grammar?.provider ?? "the configured language checker") + ". No overall writing-quality score is calculated.");
  sectionTitle(ctx, "Detected Grammar & Language Corrections");
  if (issues.length === 0) {
    paragraph(ctx, "The configured checker returned no issues for the text it processed. This is not a guarantee that the document is error-free.");
  } else {
    table(ctx,
      [
        { header: "#", width: 8 },
        { header: "Type", width: 24 },
        { header: "Sev.", width: 18 },
        { header: "Original Passage", width: 57 },
        { header: "Suggested Change", width: 57 },
      ],
      issues.map((i, n) => [String(n + 1), i.type ?? "—", i.severity ?? "—", i.text ?? "—", i.suggestion ?? "—"]),
    );
  }
}

function citationSection(ctx: Ctx, input: ReportInput) {
  const c = input.results.citations ?? {};
  const total = Number(c.total ?? 0);
  const verified = Number(c.verified ?? 0);
  sectionTitle(ctx, "Reference Verification");
  if (total === 0) {
    paragraph(ctx, "Not assessed: no reference-list entries were detected. No citation-quality percentage is inferred.");
  } else {
    scoreCards(ctx, [
      { label: "References found", value: String(total), tone: ACCENT },
      { label: "Verified titles", value: String(verified), tone: OK },
      { label: "Not verified", value: String(Math.max(0, total - verified)), tone: total - verified > 0 ? WARN : OK },
      { label: "Review notes", value: String((c.issues ?? []).length), tone: (c.issues ?? []).length > 0 ? WARN : OK },
    ]);
  }
  sectionTitle(ctx, "Bibliographic Issues & Verification Notes");
  const issues = c.issues ?? [];
  if (issues.length === 0 && total > 0) {
    paragraph(ctx, "No additional verification notes were returned. Check each reference against its publisher record before relying on it.");
  } else if (issues.length === 0) {
    paragraph(ctx, "No citation verification data is available.");
  } else {
    table(ctx,
      [
        { header: "#", width: 8 },
        { header: "Bibliographic Issue / Warning", width: 132 },
      ],
      issues.map((i, n) => [String(n + 1), i]),
    );
  }
}

function recommendations(input: ReportInput): Array<[string, string, string]> {
  const out: Array<[string, string, string]> = [];
  const matches = input.results.plagiarism?.matches?.length ?? 0;
  const grammarIssues = input.results.grammar?.issues?.length ?? 0;
  const citationIssues = input.results.citations?.issues?.length ?? 0;
  if (matches > 0) out.push(["Similarity", "Review each highlighted passage beside its linked source and check quotation and citation context.", "Review"]);
  if (grammarIssues > 0) out.push(["Language", "Review the " + grammarIssues + " language issue(s) returned by the configured checker.", "Review"]);
  if (citationIssues > 0) out.push(["References", "Review the " + citationIssues + " reference verification note(s).", "Review"]);
  if (out.length === 0) out.push(["Review", "No findings were returned by the enabled checks. This does not certify originality or authorship.", "Review"]);
  return out;
}

/* ------------------------------------------------------------------ public */

export function buildReport(kind: ReportKind, input: ReportInput): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ctx: Ctx = { doc, y: 0, title: KIND_TITLE[kind], input, page: 1 };
  header(ctx);

  // Academic Paper Header format (Authors, Affiliation, Abstract Callout, Keywords)
  academicPaperHeader(ctx, input);

  // Document metadata block
  sectionTitle(ctx, "Submission & Audit Record");
  documentBlock(ctx, input);

  // Specialized sections and highlighted issues based on report type
  if (kind === "similarity") {
    similaritySection(ctx, input);
    highlightedBody(ctx, input, ["plagiarism"]);
    issuesSection(ctx, input, ["plagiarism"]);
  }

  if (kind === "ai") {
    aiSection(ctx, input);
  }

  if (kind === "grammar") {
    grammarSection(ctx, input);
    highlightedBody(ctx, input, ["grammar"]);
    issuesSection(ctx, input, ["grammar"]);
  }

  if (kind === "citation") {
    citationSection(ctx, input);
    issuesSection(ctx, input, ["citation"]);
  }

  if (kind === "full") {
    similaritySection(ctx, input);
    aiSection(ctx, input);
    grammarSection(ctx, input);
    citationSection(ctx, input);
    highlightedBody(ctx, input, ["plagiarism", "grammar"]);
    issuesSection(ctx, input);
  }

  // Recommendations table
  sectionTitle(ctx, "Audit Recommendations & Action Items");
  table(
    ctx,
    [
      { header: "Integrity Area", width: 32 },
      { header: "Action Item / Recommendation", width: 90 },
      { header: "Priority", width: 20, align: "right" },
    ],
    recommendations(input),
  );

  // A generated analysis report is not an institutional certification.
  ensure(ctx, 22);
  doc.setFillColor(246, 248, 252);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, ctx.y, W - 2 * M, 16, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...NAVY);
  doc.text("REVIEW NOTE", M + 5, ctx.y + 5.5);
  doc.setFont("helvetica", "normal").setFontSize(6.8).setTextColor(...MUTED);
  doc.text("Automated findings require human review and do not constitute an institutional decision.", M + 5, ctx.y + 10);
  ctx.y += 20;

  footer(ctx);
  return doc;
}

export function slugify(value: string) {
  return value.toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "document";
}

export function downloadReport(kind: ReportKind, input: ReportInput) {
  const doc = buildReport(kind, input);
  doc.save(`plagishield-${kind}-report-${slugify(input.documentName)}.pdf`);
}
