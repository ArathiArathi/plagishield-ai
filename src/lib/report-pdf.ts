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
  document_text?: string;
  meta?: { engine_version?: string; extraction?: string; words?: number; sentences?: number; characters?: number; sources_queried?: number; checked_at?: string };
  plagiarism?: {
    matched_words?: number;
    eligible_words?: number;
    excluded_words?: number;
    matches?: Array<{ source?: string; url?: string; similarity?: number; snippet?: string; type?: string; matched_snippet?: string; provider?: string; matched_words?: number; match_count?: number; match_strength?: number; domain?: string }>;
    highlights?: PdfHighlight[];
    source_coverage?: { sources_retrieved?: number; providers?: string[]; matching_method?: string; limitation?: string };
  };
  ai_detection?: { confidence?: string; reasoning?: string; highlights?: PdfHighlight[] };
  grammar?: { issues?: Array<{ type?: string; severity?: string; text?: string; suggestion?: string }>; highlights?: PdfHighlight[] };
  citations?: { total?: number; verified?: number; issues?: string[] };
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
  ai: number;
  grammar: number;
  citation: number;
  results: ReportResults;
};

export type ReportKind = "similarity" | "ai" | "grammar" | "citation" | "full";

/* ------------------------------------------------------------- primitives */

const NAVY: [number, number, number] = [16, 36, 71];
const ACCENT: [number, number, number] = [37, 99, 235];
const MUTED: [number, number, number] = [110, 122, 140];
const LINE: [number, number, number] = [222, 228, 236];

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
  const refId = String(ctx.input.analysisId || "ANL-001").slice(0, 8).toUpperCase();
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
  const genAt = sanitizePdfText(ctx.input.generatedAt || new Date().toLocaleString());
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

/* ------------------------------------------- submission metadata */

/** Formats the header and title block matching the academic paper layout
 *  (Title, Authors, Affiliation, Abstract Callout, Keywords, Institutional Seal). */
function documentBlock(ctx: Ctx, input: ReportInput) {
  const docName = sanitizePdfText(input.documentName || "document");
  const refId = input.analysisId ? input.analysisId.slice(0, 8).toUpperCase() : "Not recorded";
  const rows: Array<[string, string]> = [
    ["Document filename", docName],
    ["Paper title", input.paperTitle || docName.replace(/\.[a-z0-9]+$/i, "")],
    ["Author", input.authorName || "Author not provided"],
    ["Submission type", input.docType ? titleCase(input.docType) : "Not provided"],
    ["Format & version", `${String(input.fileType || "Not recorded").toUpperCase()} · ${input.version ? `v${input.version}` : "version not recorded"}`],
    ["Analysis reference ID", refId],
    ["Analysis engine", input.results.meta?.engine_version || "Not recorded"],
    ["Word count", Number(input.results.meta?.words ?? 0).toLocaleString()],
    ["Extracted text", input.results.meta?.extraction || "Not recorded"],
    ["Analysis generated", input.generatedAt || "Not recorded"],
  ];
  metaTable(ctx, rows);
}

/* ------------------------------------------- report sections */

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

function compositionSection(ctx: Ctx, input: ReportInput) {
  const slices = (input.results.composition ?? []).filter((slice) => slice && slice.words >= 0);
  sectionTitle(ctx, "Compared Text Coverage");
  if (slices.length === 0) {
    paragraph(ctx, "No comparison coverage breakdown was recorded for this analysis.");
    return;
  }
  table(ctx, [
    { header: "Comparison result", width: 86 },
    { header: "Share of compared text", width: 48, align: "right" },
    { header: "Words", width: 28, align: "right" },
  ], slices.map((slice) => [slice.category, `${Number(slice.percent ?? 0).toFixed(1)}%`, Number(slice.words ?? 0).toLocaleString()]));
  const excluded = Number(input.results.plagiarism?.excluded_words ?? 0);
  const eligible = Number(input.results.plagiarism?.eligible_words ?? 0);
  paragraph(ctx, `${eligible.toLocaleString()} words were included in the comparison. ${excluded.toLocaleString()} words in clearly quoted passages or the detected reference section were excluded from the score.`, { size: 7.5, color: MUTED });
}

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

function highlightedBody(ctx: Ctx, input: ReportInput, categories: string[]) {
  const raw = input.results.document_text || input.results.text_excerpt || "";
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

  if (!input.results.document_text) paragraph(ctx, "This older saved analysis contains only a text excerpt. Re-run the analysis to export the complete extracted submission. The text below is reconstructed from extraction and does not retain the source file's page layout or images.", { size: 7.5, color: MUTED });
  else paragraph(ctx, "The complete extracted submission is reproduced below in reading order. Original page layout, embedded images and typography are not retained by the text extractor.", { size: 7.5, color: MUTED });
  legendRow(ctx, categories);

  const text = raw;
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
      if (/^\s+$/.test(tk)) {
        const lineBreaks = (tk.match(/\n/g) ?? []).length;
        if (lineBreaks > 0) {
          for (let line = 0; line < lineBreaks; line++) {
            x = M;
            ctx.y += lineH;
            if (ctx.y > H - 24) { newPage(ctx); setBody(); }
          }
        } else if (x > M) {
          x += doc.getTextWidth(tk);
        }
        continue;
      }
      const w = doc.getTextWidth(tk);
      if (x + w > W - M) {
        x = M;
        ctx.y += lineH;
        if (ctx.y > H - 24) { newPage(ctx); setBody(); }
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
}

function issuesSection(ctx: Ctx, input: ReportInput, categories?: string[]) {
  const all = input.results.issues ?? [];
  const issues = categories ? all.filter((i) => categories.some((c) => i.category?.toLowerCase().includes(c.toLowerCase()))) : all;
  sectionTitle(ctx, "Review Notes & Action Log");
  if (issues.length === 0) {
    paragraph(ctx, "No issues were returned by the enabled checks. This does not establish originality or error-free writing.");
    return;
  }
  const bySeverity = issues.reduce<Record<string, number>>((acc, issue) => {
    const severity = (issue.severity ?? "low").toLowerCase();
    acc[severity] = (acc[severity] ?? 0) + 1;
    return acc;
  }, {});
  paragraph(ctx, `${issues.length} issue(s) were returned: ${bySeverity.high ?? 0} high, ${bySeverity.medium ?? 0} medium, and ${bySeverity.low ?? 0} low severity.`, { size: 8, color: MUTED });
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
  similarity: "Document Similarity Report",
  ai: "Experimental Writing-pattern Review",
  grammar: "Grammar & Academic Language Report",
  citation: "Citation Verification Report",
  full: "Document Review Report",
};

function similaritySection(ctx: Ctx, input: ReportInput) {
  const plagiarism = input.results.plagiarism ?? {};
  const matches = plagiarism.matches ?? [];
  const coverage = plagiarism.source_coverage;
  sectionTitle(ctx, "Similarity Overview & Source Coverage");
  const eligible = Number(plagiarism.eligible_words ?? input.results.meta?.words ?? 0);
  const matched = Number(plagiarism.matched_words ?? 0);
  paragraph(ctx, `Observed similarity: ${Number(input.similarity ?? 0)}% of the compared text (${matched.toLocaleString()} of ${eligible.toLocaleString()} words). This is a text-overlap measure, not a plagiarism verdict.`);
  paragraph(ctx, `${matches.length} source record(s) contained at least one exact passage match. Source percentages can overlap when multiple records contain the same passage.`, { size: 8, color: MUTED });
  sectionTitle(ctx, "Matched Sources & Verbatim Evidence");
  if (matches.length === 0) paragraph(ctx, "No exact source passages meeting the minimum eight-consecutive-word rule were found in the retrieved source set. This does not establish that the paper is original.");
  else table(ctx, [
    { header: "#", width: 7 }, { header: "Source / Domain", width: 42 }, { header: "Submission passage", width: 48 },
    { header: "Source passage", width: 48 }, { header: "Words", width: 15, align: "right" }, { header: "Doc %", width: 15, align: "right" },
  ], matches.map((match, index) => [String(index + 1), [match.source ?? "Source not identified", match.domain ?? ""].filter(Boolean).join(" · "), match.snippet ?? "—", match.matched_snippet ?? "—", Number(match.matched_words ?? 0).toLocaleString(), `${Number(match.similarity ?? 0).toFixed(1)}%` ]));
  sectionTitle(ctx, "Comparison Scope & Limitations");
  const providers = coverage?.providers?.length ? coverage.providers.join(", ") : "No provider details recorded";
  table(ctx, [{ header: "Setting", width: 58 }, { header: "Applied scope", width: 117 }], [
    ["Source records compared", String(coverage?.sources_retrieved ?? matches.length)], ["Retrieval providers", providers],
    ["Matching rule", coverage?.matching_method || "Not recorded"], ["Private student-paper repository", "Not connected"],
    ["Licensed publisher full-text corpus", "Not connected"],
  ]);
  paragraph(ctx, coverage?.limitation || "Only source records retrieved for this run were compared. Coverage is not exhaustive.", { size: 7.5, color: MUTED });
}

function aiSection(ctx: Ctx, input: ReportInput) {
  const detection = input.results.ai_detection ?? {};
  sectionTitle(ctx, "Writing-pattern review (experimental)");
  paragraph(ctx, `Detector confidence recorded for this run: ${detection.confidence ?? "not recorded"}. This feature is not a validated authorship detector and does not provide a reliable probability that text was written by AI.`);
  if (detection.reasoning?.trim()) paragraph(ctx, detection.reasoning.trim());
  else paragraph(ctx, "No writing-pattern explanation was returned for this analysis.");
  const passages = detection.highlights ?? [];
  if (passages.length > 0) {
    sectionTitle(ctx, "Passages for human review");
    table(ctx, [{ header: "#", width: 8 }, { header: "Passage", width: 142 }, { header: "Signal", width: 24, align: "right" }], passages.map((passage, index) => [String(index + 1), passage.text ?? "", "Flagged"]));
  }
}

function grammarSection(ctx: Ctx, input: ReportInput) {
  const issues = input.results.grammar?.issues ?? [];
  sectionTitle(ctx, "Grammar & Language Review");
  paragraph(ctx, `${issues.length} language issue(s) were returned by the enabled grammar service. This is an issue count, not a calibrated writing-quality score.`);
  sectionTitle(ctx, "Detected Language Issues");
  if (issues.length === 0) paragraph(ctx, "No grammar issues were returned by the enabled checker. This does not guarantee error-free writing.");
  else table(ctx, [
    { header: "#", width: 8 }, { header: "Type", width: 24 }, { header: "Severity", width: 18 },
    { header: "Original passage", width: 57 }, { header: "Suggested correction", width: 57 },
  ], issues.map((issue, index) => [String(index + 1), issue.type ?? "—", issue.severity ?? "—", issue.text ?? "—", issue.suggestion ?? "—"]));
}

function citationSection(ctx: Ctx, input: ReportInput) {
  const citations = input.results.citations ?? {};
  const total = Number(citations.total ?? 0);
  const verified = Number(citations.verified ?? 0);
  const issues = citations.issues ?? [];
  sectionTitle(ctx, "Reference Lookup");
  paragraph(ctx, total > 0 ? `${verified} of ${total} reference title(s) matched records in the connected scholarly indexes. A title match is not a full bibliographic audit.` : "No reference entries could be parsed from the extracted document text.");
  sectionTitle(ctx, "Reference Warnings");
  if (issues.length === 0) paragraph(ctx, "No reference warnings were returned by the enabled checks.");
  else table(ctx, [{ header: "#", width: 8 }, { header: "Warning", width: 142 }], issues.map((issue, index) => [String(index + 1), issue]));
}

function recommendations(input: ReportInput): Array<[string, string, string]> {
  const actions: Array<[string, string, string]> = [];
  const matches = input.results.plagiarism?.matches ?? [];
  const grammarCount = input.results.grammar?.issues?.length ?? 0;
  const citationWarnings = input.results.citations?.issues?.length ?? 0;
  if (matches.length > 0) actions.push(["Text similarity", `Review ${matches.length} matched source record(s), compare each highlighted passage with its source, and confirm quotation and citation context.`, "Review"]);
  if ((input.results.ai_detection?.highlights?.length ?? 0) > 0) actions.push(["Writing patterns", "Review the flagged passages manually. Automated writing-style signals cannot establish authorship.", "Review"]);
  if (grammarCount > 0) actions.push(["Grammar & language", `Review ${grammarCount} returned language issue(s) and accept only corrections that preserve the intended meaning.`, "Review"]);
  if (citationWarnings > 0) actions.push(["References", `Check ${citationWarnings} reference warning(s) against the original publication records.`, "Review"]);
  if (actions.length === 0) actions.push(["Review", "No actionable findings were returned by the enabled checks. This is not certification of originality or error-free writing.", "Manual review"]);
  return actions;
}

/* ------------------------------------------------------------------ public */

export function buildReport(kind: ReportKind, input: ReportInput): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ctx: Ctx = { doc, y: 0, title: KIND_TITLE[kind], input, page: 1 };
  header(ctx);

  // Document metadata block
  sectionTitle(ctx, "Submission & Audit Record");
  documentBlock(ctx, input);

  // Specialized sections and highlighted issues based on report type
  if (kind === "similarity") {
    similaritySection(ctx, input);
    compositionSection(ctx, input);
    highlightedBody(ctx, input, ["plagiarism"]);
    issuesSection(ctx, input, ["plagiarism"]);
  }

  if (kind === "ai") {
    aiSection(ctx, input);
    compositionSection(ctx, input);
    highlightedBody(ctx, input, ["ai"]);
    issuesSection(ctx, input, ["ai"]);
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
    compositionSection(ctx, input);
    similaritySection(ctx, input);
    aiSection(ctx, input);
    grammarSection(ctx, input);
    citationSection(ctx, input);
    highlightedBody(ctx, input, ["plagiarism", "ai", "grammar"]);
    issuesSection(ctx, input);
  }

  // Recommendations table
  sectionTitle(ctx, "Review Notes & Action Items");
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
