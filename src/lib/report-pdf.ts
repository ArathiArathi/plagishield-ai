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
  plagiarism?: { matches?: Array<{ source?: string; similarity?: number; snippet?: string }>; highlights?: PdfHighlight[] };
  ai_detection?: { confidence?: string; reasoning?: string; matches?: Array<{ text?: string; strength?: string }>; highlights?: PdfHighlight[] };
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
const OK: [number, number, number] = [22, 138, 92];
const WARN: [number, number, number] = [201, 138, 4];
const BAD: [number, number, number] = [200, 55, 55];

const M = 15; // page margin
const W = 210;
const H = 297;

type Ctx = { doc: jsPDF; y: number; title: string; input: ReportInput; page: number };

function toneFor(kind: ReportKind, value: number): [number, number, number] {
  const inverted = kind === "similarity" || kind === "ai";
  const good = inverted ? value <= 15 : value >= 80;
  const mid = inverted ? value <= 35 : value >= 60;
  return good ? OK : mid ? WARN : BAD;
}

function header(ctx: Ctx) {
  const { doc } = ctx;
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(13);
  doc.text("PlagiShield AI", M, 12);
  doc.setFont("helvetica", "normal").setFontSize(8.5);
  doc.setTextColor(200, 214, 235);
  doc.text("Academic Integrity Report", M, 17.5);
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(ctx.title, W - M, 12, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.setTextColor(200, 214, 235);
  doc.text(`Ref ${ctx.input.analysisId.slice(0, 8).toUpperCase()}`, W - M, 17.5, { align: "right" });
  ctx.y = 32;
}

function footer(ctx: Ctx) {
  const { doc } = ctx;
  doc.setDrawColor(...LINE);
  doc.line(M, H - 16, W - M, H - 16);
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
  doc.text(`${ctx.input.documentName} · generated ${ctx.input.generatedAt}`, M, H - 11);
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
  // reserve room for the heading plus the first rows of its content so a title
  // never sits orphaned at the very bottom of a page
  ensure(ctx, 34);
  const { doc } = ctx;
  doc.setFillColor(...ACCENT);
  doc.rect(M, ctx.y - 3.5, 2.4, 5.5, "F");
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...NAVY);
  doc.text(text, M + 5, ctx.y);
  ctx.y += 5;
  doc.setDrawColor(...LINE);
  doc.line(M, ctx.y, W - M, ctx.y);
  ctx.y += 7;
}

function paragraph(ctx: Ctx, text: string, opts: { size?: number; color?: [number, number, number] } = {}) {
  const { doc } = ctx;
  doc.setFont("helvetica", "normal").setFontSize(opts.size ?? 9.5).setTextColor(...(opts.color ?? [60, 70, 85]));
  const lines = doc.splitTextToSize(text, W - 2 * M) as string[];
  for (const line of lines) {
    ensure(ctx, 6);
    doc.text(line, M, ctx.y);
    ctx.y += 4.8;
  }
  ctx.y += 3;
}

function metaTable(ctx: Ctx, rows: Array<[string, string]>) {
  const { doc } = ctx;
  const rowH = 7.5;
  ensure(ctx, rows.length * rowH + 4);
  const startY = ctx.y;
  rows.forEach(([k, v], i) => {
    const y = startY + i * rowH;
    if (i % 2 === 0) {
      doc.setFillColor(246, 248, 251);
      doc.rect(M, y - 5, W - 2 * M, rowH, "F");
    }
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...NAVY);
    doc.text(k, M + 3, y);
    doc.setFont("helvetica", "normal").setTextColor(60, 70, 85);
    const val = doc.splitTextToSize(v, W - 2 * M - 68)[0] as string;
    doc.text(val, M + 65, y);
  });
  doc.setDrawColor(...LINE);
  doc.rect(M, startY - 5, W - 2 * M, rows.length * rowH);
  ctx.y = startY + rows.length * rowH + 6;
}

function scoreCards(ctx: Ctx, cards: Array<{ label: string; value: string; tone: [number, number, number] }>) {
  const { doc } = ctx;
  ensure(ctx, 30);
  const gap = 4;
  const cw = (W - 2 * M - gap * (cards.length - 1)) / cards.length;
  cards.forEach((c, i) => {
    const x = M + i * (cw + gap);
    doc.setFillColor(250, 251, 253);
    doc.setDrawColor(...LINE);
    doc.rect(x, ctx.y, cw, 24, "FD");
    doc.setFillColor(...c.tone);
    doc.rect(x, ctx.y, cw, 2.2, "F");
    doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...c.tone);
    doc.text(c.value, x + cw / 2, ctx.y + 13, { align: "center" });
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
    doc.text(c.label.toUpperCase(), x + cw / 2, ctx.y + 19.5, { align: "center" });
  });
  ctx.y += 31;
}

function gauge(ctx: Ctx, label: string, value: number, tone: [number, number, number], caption: string) {
  const { doc } = ctx;
  ensure(ctx, 26);
  doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...NAVY);
  doc.text(label, M, ctx.y);
  doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...tone);
  doc.text(`${value}%`, W - M, ctx.y, { align: "right" });
  ctx.y += 3.5;
  const barW = W - 2 * M;
  doc.setFillColor(235, 239, 245);
  doc.rect(M, ctx.y, barW, 5, "F");
  doc.setFillColor(...tone);
  doc.rect(M, ctx.y, Math.max(1, (barW * Math.min(100, Math.max(0, value))) / 100), 5, "F");
  ctx.y += 9;
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...MUTED);
  const lines = doc.splitTextToSize(caption, barW) as string[];
  for (const l of lines) {
    ensure(ctx, 5);
    doc.text(l, M, ctx.y);
    ctx.y += 4.4;
  }
  ctx.y += 4;
}

function table(
  ctx: Ctx,
  columns: Array<{ header: string; width: number; align?: "left" | "right" }>,
  rows: string[][],
) {
  const { doc } = ctx;
  const total = columns.reduce((s, c) => s + c.width, 0);
  const scale = (W - 2 * M) / total;
  const widths = columns.map((c) => c.width * scale);

  const drawHead = () => {
    ensure(ctx, 14);
    doc.setFillColor(...NAVY);
    doc.rect(M, ctx.y, W - 2 * M, 8, "F");
    doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(255, 255, 255);
    let x = M;
    columns.forEach((c, i) => {
      const right = c.align === "right";
      doc.text(c.header, right ? x + widths[i]! - 3 : x + 3, ctx.y + 5.4, { align: right ? "right" : "left" });
      x += widths[i]!;
    });
    ctx.y += 8;
  };

  drawHead();

  rows.forEach((row, ri) => {
    doc.setFont("helvetica", "normal").setFontSize(8.5);
    const cellLines = row.map((cell, i) => doc.splitTextToSize(cell, widths[i]! - 6) as string[]);
    const rowH = Math.max(8, Math.max(...cellLines.map((l) => l.length)) * 4.2 + 3.5);
    if (ctx.y + rowH > H - 22) {
      newPage(ctx);
      drawHead();
      doc.setFont("helvetica", "normal").setFontSize(8.5);
    }
    if (ri % 2 === 0) {
      doc.setFillColor(247, 249, 252);
      doc.rect(M, ctx.y, W - 2 * M, rowH, "F");
    }
    doc.setDrawColor(...LINE);
    doc.line(M, ctx.y + rowH, W - M, ctx.y + rowH);
    let x = M;
    cellLines.forEach((lines, i) => {
      const right = columns[i]!.align === "right";
      doc.setTextColor(50, 60, 75);
      lines.forEach((l, li) => {
        doc.text(l, right ? x + widths[i]! - 3 : x + 3, ctx.y + 5.4 + li * 4.2, { align: right ? "right" : "left" });
      });
      x += widths[i]!;
    });
    ctx.y += rowH;
  });
  ctx.y += 7;
}

function verdictBox(ctx: Ctx, verdict: string, tone: [number, number, number], detail: string) {
  const { doc } = ctx;
  ensure(ctx, 26);
  doc.setFillColor(250, 251, 253);
  doc.setDrawColor(...tone);
  doc.rect(M, ctx.y, W - 2 * M, 20, "FD");
  doc.setFillColor(...tone);
  doc.rect(M, ctx.y, 2.5, 20, "F");
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...tone);
  doc.text(verdict, M + 7, ctx.y + 8);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...MUTED);
  const lines = (doc.splitTextToSize(detail, W - 2 * M - 12) as string[]).slice(0, 2);
  lines.forEach((l, i) => doc.text(l, M + 7, ctx.y + 13.5 + i * 4.2));
  ctx.y += 27;
}

function documentBlock(ctx: Ctx, input: ReportInput) {
  const rows: Array<[string, string]> = [["Document", input.documentName]];
  if (input.paperTitle) rows.push(["Paper title", input.paperTitle]);
  if (input.authorName) rows.push(["Author", input.authorName]);
  if (input.docType) rows.push(["Submission type", titleCase(input.docType)]);
  rows.push(
    ["File type", String(input.fileType || "—").toUpperCase()],
    ["Version", `v${input.version}`],
    ["Analysis reference", input.analysisId.slice(0, 8).toUpperCase()],
    ["Report generated", input.generatedAt],
  );
  metaTable(ctx, rows);
}

function titleCase(v: string) {
  return v.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ------------------------------------------- composition, highlights, issues */

const CATEGORY_FILL: Record<string, [number, number, number]> = {
  plagiarism: [255, 214, 214],
  ai: [255, 235, 186],
  grammar: [214, 231, 255],
  citation: [212, 236, 224],
};

const CATEGORY_LABEL: Record<string, string> = {
  plagiarism: "Plagiarised / matched text",
  ai: "AI generated text",
  grammar: "Language issue",
  citation: "Citation",
};

const SLICE_COLOR: Record<string, [number, number, number]> = {
  "Plagiarised / matched": BAD,
  "AI generated": WARN,
  "Quoted & attributed": ACCENT,
  "Language issues": [120, 90, 200],
  "Original human writing": OK,
};

function compositionSection(ctx: Ctx, input: ReportInput) {
  const slices = (input.results.composition ?? []).filter((s) => s && s.percent > 0);
  sectionTitle(ctx, "Content Composition");
  if (slices.length === 0) {
    paragraph(ctx, "No content composition data is stored for this analysis.");
    return;
  }

  const { doc } = ctx;
  // Stacked 100% bar
  ensure(ctx, 30);
  const barW = W - 2 * M;
  const totalPct = slices.reduce((s, x) => s + x.percent, 0) || 100;
  let x = M;
  slices.forEach((s) => {
    const w = (barW * s.percent) / totalPct;
    doc.setFillColor(...(SLICE_COLOR[s.category] ?? MUTED));
    doc.rect(x, ctx.y, w, 9, "F");
    x += w;
  });
  doc.setDrawColor(...LINE);
  doc.rect(M, ctx.y, barW, 9);
  ctx.y += 15;

  table(
    ctx,
    [
      { header: "Category", width: 74 },
      { header: "Share of document", width: 40, align: "right" },
      { header: "Words", width: 26, align: "right" },
    ],
    slices.map((s) => [s.category, `${s.percent}%`, String(s.words)]),
  );
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
    doc.rect(x, ctx.y - 3, 4, 4);
    const label = CATEGORY_LABEL[c] ?? c;
    doc.text(label, x + 5.5, ctx.y);
    x += 6 + doc.getTextWidth(label) + 6;
  });
  ctx.y += 7;
}

const MAX_BODY_CHARS = 14000;

/** DrillBit-style annotated body: the submission text with flagged passages
 *  highlighted in place, colour coded by category. */
function highlightedBody(ctx: Ctx, input: ReportInput, categories: string[]) {
  const raw = input.results.text_excerpt ?? "";
  const highlights = ([] as PdfHighlight[])
    .concat(input.results.plagiarism?.highlights ?? [])
    .concat(input.results.ai_detection?.highlights ?? [])
    .concat(input.results.grammar?.highlights ?? [])
    .filter((h) => categories.includes(String(h.category)));

  sectionTitle(ctx, "Highlighted Submission Text");
  if (!raw.trim()) {
    paragraph(ctx, "The extracted submission text is not stored for this analysis, so in-text highlighting is unavailable. Re-analyze the document to include it.");
    return;
  }

  legendRow(ctx, categories);

  const text = raw.slice(0, MAX_BODY_CHARS);
  const segments = buildSegments(text, highlights as unknown as Highlight[]);

  const { doc } = ctx;
  const lineH = 4.5;
  const setBody = () => doc.setFont("helvetica", "normal").setFontSize(8.5);
  setBody();
  let x = M;
  ensure(ctx, 12);

  for (const seg of segments) {
    const tokens = seg.text.split(/(\s+)/).filter((t) => t !== "");
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
        doc.rect(x - 0.4, ctx.y - 3.1, w + 0.8, 4.3, "F");
      }
      doc.setTextColor(40, 50, 65);
      doc.text(tk, x, ctx.y);
      x += w;
    }
  }
  ctx.y += lineH + 4;
  if (raw.length > MAX_BODY_CHARS) {
    paragraph(ctx, `Body text truncated at ${MAX_BODY_CHARS.toLocaleString()} characters for this report.`, { size: 7.5, color: MUTED });
  }
}

function issuesSection(ctx: Ctx, input: ReportInput, categories?: string[]) {
  const all = input.results.issues ?? [];
  const issues = categories ? all.filter((i) => categories.includes(String(i.category))) : all;
  sectionTitle(ctx, "Issue Log");
  if (issues.length === 0) {
    paragraph(ctx, "No issues were recorded for this submission.");
    return;
  }
  const bySeverity = issues.reduce<Record<string, number>>((acc, i) => {
    const k = (i.severity ?? "low").toLowerCase();
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  scoreCards(ctx, [
    { label: "Total issues", value: String(issues.length), tone: ACCENT },
    { label: "High", value: String(bySeverity.high ?? 0), tone: (bySeverity.high ?? 0) > 0 ? BAD : OK },
    { label: "Medium", value: String(bySeverity.medium ?? 0), tone: (bySeverity.medium ?? 0) > 0 ? WARN : OK },
    { label: "Low", value: String(bySeverity.low ?? 0), tone: OK },
  ]);
  table(
    ctx,
    [
      { header: "#", width: 8 },
      { header: "Category", width: 26 },
      { header: "Sev.", width: 18 },
      { header: "Issue", width: 50 },
      { header: "Detail / excerpt", width: 64 },
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
  similarity: "Similarity Report",
  ai: "AI Content Report",
  grammar: "Grammar & Language Report",
  citation: "Citation Verification Report",
  full: "Comprehensive Report",
};

function similaritySection(ctx: Ctx, input: ReportInput) {
  const matches = input.results.plagiarism?.matches ?? [];
  const tone = toneFor("similarity", input.similarity);
  sectionTitle(ctx, "Similarity Index");
  gauge(
    ctx,
    "Overall similarity against matched sources",
    input.similarity,
    tone,
    `${matches.length} matched source(s) recorded. Excluding quoted material and references, ${input.similarity}% of the submission overlaps existing content.`,
  );
  verdictBox(
    ctx,
    input.similarity >= 35 ? "High similarity — revision required" : input.similarity >= 15 ? "Moderate similarity — review matches" : "Low similarity — within accepted limits",
    tone,
    input.similarity >= 15
      ? "Paraphrase or quote the flagged passages and attribute each matched source correctly."
      : "No significant overlap detected. The submission meets typical institutional thresholds.",
  );
  sectionTitle(ctx, "Matched Sources");
  if (matches.length === 0) {
    paragraph(ctx, "No source matches were recorded for this submission.");
  } else {
    table(
      ctx,
      [
        { header: "#", width: 8, align: "left" },
        { header: "Source", width: 52 },
        { header: "Matched text", width: 88 },
        { header: "Match %", width: 18, align: "right" },
      ],
      matches.map((m, i) => [
        String(i + 1),
        m.source ?? "Unknown source",
        m.snippet ?? "—",
        `${Math.round(Number(m.similarity ?? 0))}%`,
      ]),
    );
  }
}

function aiSection(ctx: Ctx, input: ReportInput) {
  const det = input.results.ai_detection ?? {};
  const tone = toneFor("ai", input.ai);
  sectionTitle(ctx, "AI Content Likelihood");
  gauge(
    ctx,
    "Probability that the text was machine generated",
    input.ai,
    tone,
    `Detector confidence: ${det.confidence ?? "not reported"}.`,
  );
  verdictBox(
    ctx,
    input.ai >= 60 ? "Likely AI generated" : input.ai >= 30 ? "Possible AI assistance" : "Likely human written",
    tone,
    input.ai >= 30
      ? "Rewrite the flagged passages in the author's own voice with specific, verifiable detail."
      : "Stylistic markers are consistent with original human authorship.",
  );
  sectionTitle(ctx, "Detector Reasoning");
  paragraph(ctx, det.reasoning?.trim() || "No detailed reasoning was returned for this submission.");
  const aiMatches = det.matches ?? [];
  if (aiMatches.length > 0) {
    sectionTitle(ctx, "Flagged Passages");
    table(
      ctx,
      [
        { header: "#", width: 8 },
        { header: "Passage", width: 130 },
        { header: "Strength", width: 28, align: "right" },
      ],
      aiMatches.map((m, i) => [String(i + 1), m.text ?? "—", m.strength ?? "—"]),
    );
  }
}

function grammarSection(ctx: Ctx, input: ReportInput) {
  const issues = input.results.grammar?.issues ?? [];
  const tone = toneFor("grammar", input.grammar);
  sectionTitle(ctx, "Language Quality");
  gauge(ctx, "Grammar & readability score", input.grammar, tone, `${issues.length} issue(s) detected across the submission.`);
  const byType = issues.reduce<Record<string, number>>((acc, i) => {
    const k = i.type ?? "other";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  if (Object.keys(byType).length > 0) {
    sectionTitle(ctx, "Issue Breakdown");
    table(
      ctx,
      [
        { header: "Category", width: 60 },
        { header: "Occurrences", width: 30, align: "right" },
      ],
      Object.entries(byType)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => [k, String(v)]),
    );
  }
  sectionTitle(ctx, "Detected Issues");
  if (issues.length === 0) {
    paragraph(ctx, "No grammar or language issues were detected.");
  } else {
    table(
      ctx,
      [
        { header: "#", width: 8 },
        { header: "Type", width: 26 },
        { header: "Severity", width: 20 },
        { header: "Text", width: 56 },
        { header: "Suggestion", width: 56 },
      ],
      issues.map((i, n) => [String(n + 1), i.type ?? "—", i.severity ?? "—", i.text ?? "—", i.suggestion ?? "—"]),
    );
  }
}

function citationSection(ctx: Ctx, input: ReportInput) {
  const c = input.results.citations ?? {};
  const tone = toneFor("citation", input.citation);
  const total = Number(c.total ?? 0);
  const verified = Number(c.verified ?? 0);
  sectionTitle(ctx, "Citation Integrity");
  gauge(ctx, "Citation completeness score", input.citation, tone, `${verified} of ${total} reference(s) verified.`);
  scoreCards(ctx, [
    { label: "References found", value: String(total), tone: ACCENT },
    { label: "Verified", value: String(verified), tone: OK },
    { label: "Unverified", value: String(Math.max(0, total - verified)), tone: total - verified > 0 ? WARN : OK },
    { label: "Issues", value: String((c.issues ?? []).length), tone: (c.issues ?? []).length > 0 ? BAD : OK },
  ]);
  sectionTitle(ctx, "Citation Issues");
  const issues = c.issues ?? [];
  if (issues.length === 0) {
    paragraph(ctx, "No citation issues were detected. All references appear complete and correctly formatted.");
  } else {
    table(
      ctx,
      [
        { header: "#", width: 8 },
        { header: "Issue", width: 132 },
      ],
      issues.map((i, n) => [String(n + 1), i]),
    );
  }
}

function recommendations(input: ReportInput): Array<[string, string, string]> {
  const out: Array<[string, string, string]> = [];
  const g = input.results.grammar?.issues?.length ?? 0;
  const ci = input.results.citations?.issues?.length ?? 0;
  if (input.similarity >= 15) out.push(["Originality", "Paraphrase or quote the matched passages and cite each source.", input.similarity >= 35 ? "High" : "Medium"]);
  if (input.ai >= 30) out.push(["AI content", "Rewrite flagged sections in your own voice with concrete detail.", input.ai >= 60 ? "High" : "Medium"]);
  if (g > 0) out.push(["Grammar", `Resolve ${g} flagged language issue(s).`, input.grammar < 70 ? "High" : "Medium"]);
  if (ci > 0) out.push(["Citations", `Correct ${ci} citation issue(s) and verify every reference.`, input.citation < 70 ? "High" : "Medium"]);
  if (out.length === 0) out.push(["Overall", "No action required — the submission meets all integrity thresholds.", "Low"]);
  return out;
}

/* ------------------------------------------------------------------ public */

export function buildReport(kind: ReportKind, input: ReportInput): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ctx: Ctx = { doc, y: 0, title: KIND_TITLE[kind], input, page: 1 };
  header(ctx);

  doc.setFont("helvetica", "bold").setFontSize(17).setTextColor(...NAVY);
  doc.text(KIND_TITLE[kind], M, ctx.y + 2);
  ctx.y += 10;
  paragraph(ctx, input.documentName, { size: 10, color: MUTED });

  documentBlock(ctx, input);

  if (kind === "full" || kind === "similarity") {
    scoreCards(ctx, [
      { label: "Similarity", value: `${input.similarity}%`, tone: toneFor("similarity", input.similarity) },
      { label: "AI content", value: `${input.ai}%`, tone: toneFor("ai", input.ai) },
      { label: "Grammar", value: `${input.grammar}`, tone: toneFor("grammar", input.grammar) },
      { label: "Citations", value: `${input.citation}`, tone: toneFor("citation", input.citation) },
    ]);
  }

  if (kind === "similarity") {
    similaritySection(ctx, input);
    compositionSection(ctx, input);
    highlightedBody(ctx, input, ["plagiarism"]);
    issuesSection(ctx, input, ["Plagiarism"]);
  }
  if (kind === "ai") {
    aiSection(ctx, input);
    compositionSection(ctx, input);
    highlightedBody(ctx, input, ["ai"]);
    issuesSection(ctx, input, ["AI content"]);
  }
  if (kind === "grammar") {
    grammarSection(ctx, input);
    highlightedBody(ctx, input, ["grammar"]);
    issuesSection(ctx, input, ["Grammar"]);
  }
  if (kind === "citation") {
    citationSection(ctx, input);
    issuesSection(ctx, input, ["Citation"]);
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


  sectionTitle(ctx, "Recommendations");
  table(
    ctx,
    [
      { header: "Area", width: 30 },
      { header: "Recommended action", width: 92 },
      { header: "Priority", width: 20, align: "right" },
    ],
    recommendations(input),
  );

  paragraph(
    ctx,
    "This report is generated automatically by PlagiShield AI from the analysis stored for this submission. Scores are indicators for human review and are not a final determination of misconduct.",
    { size: 7.5, color: MUTED },
  );

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
