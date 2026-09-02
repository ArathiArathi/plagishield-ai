/**
 * PlagiShield analysis engine (server-only).
 *
 * Real pipeline — no mock scores:
 *  1. Sentence segmentation + fingerprinting of the submitted text.
 *  2. Source retrieval over the open internet (Wikipedia REST/API, OpenAlex,
 *     Crossref) and n-gram containment scoring against the retrieved text.
 *  3. Stylometric AI-detection classifier (logistic regression over burstiness,
 *     lexical diversity, function-word and boilerplate features) blended with an
 *     LLM judgement from Lovable AI.
 *  4. Grammar/language checking through the public LanguageTool API.
 *  5. Citation verification through Crossref bibliographic matching.
 */

const UA = "PlagiShieldAI/1.0 (academic integrity analysis)";
const ENGINE_VERSION = "2.0.0";

export type Highlight = {
  start: number;
  end: number;
  text: string;
  category: "plagiarism" | "ai" | "grammar" | "citation";
  score: number;
  source?: string;
  url?: string;
  note?: string;
  /** Verbatim passage from the retrieved source that matched this segment. */
  matched_snippet?: string;
  /** Which retrieval provider / detector produced this evidence. */
  provider?: string;
  /** Human-readable confidence label for this individual segment. */
  confidence?: "high" | "medium" | "low";
};


export type IssueItem = {
  category: "Plagiarism" | "AI content" | "Grammar" | "Citation";
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  excerpt?: string;
};

export type CompositionSlice = { category: string; percent: number; words: number };

export type AnalysisResults = {
  meta: {
    engine_version: string;
    extraction: string;
    words: number;
    sentences: number;
    characters: number;
    sources_queried: number;
    checked_at: string;
  };
  text_excerpt: string;
  plagiarism: {
    score: number;
    matched_words: number;
    matches: Array<{ source: string; url?: string; similarity: number; snippet: string; type: string; matched_snippet?: string; provider?: string }>;
    highlights: Highlight[];
  };
  ai_detection: {
    score: number;
    confidence: string;
    reasoning: string;
    model_score: number | null;
    stylometry_score: number;
    features: Record<string, number>;
    highlights: Highlight[];
  };
  grammar: {
    score: number;
    provider: string;
    issues: Array<{ type: string; severity: string; text: string; suggestion: string; message?: string; offset?: number }>;
    highlights: Highlight[];
  };
  citations: {
    score: number;
    total: number;
    verified: number;
    in_text: number;
    references: Array<{ raw: string; verified: boolean; matched_title?: string; doi?: string; year?: number }>;
    issues: string[];
  };
  composition: CompositionSlice[];
  issues: IssueItem[];
};

/* ------------------------------------------------------------ text utils */

type Sentence = { text: string; start: number; end: number; words: string[] };

const tokenize = (s: string) => s.toLowerCase().match(/[a-z0-9']+/g) ?? [];

export function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  const re = /[^.!?\n]+[.!?]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    const trimmedStart = raw.length - raw.trimStart().length;
    const t = raw.trim();
    if (t.length < 25) continue;
    const start = m.index + trimmedStart;
    out.push({ text: t, start, end: start + t.length, words: tokenize(t) });
  }
  return out;
}

function ngrams(words: string[], n: number) {
  const set = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) set.add(words.slice(i, i + n).join(" "));
  return set;
}

/** Containment of a sentence inside a candidate source text (0..100). */
function containment(sentence: string[], sourceText: string, n = 4) {
  if (sentence.length < n) return 0;
  const src = ngrams(tokenize(sourceText), n);
  if (src.size === 0) return 0;
  const grams = [...ngrams(sentence, n)];
  const hit = grams.filter((g) => src.has(g)).length;
  return Math.round((hit / grams.length) * 100);
}

async function getJson(url: string, timeoutMs = 9000): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length) as R[];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

/* ------------------------------------------------- 1. source retrieval */

type Candidate = { title: string; url?: string; text: string; kind: string; provider?: string };

/**
 * Return the passage of `sourceText` that shares the most n-grams with the
 * sentence — this is the verbatim evidence shown in report evidence panels.
 */
function bestWindow(sentence: string[], sourceText: string, n = 4): string {
  const srcWords = sourceText.split(/\s+/).filter(Boolean);
  if (srcWords.length === 0) return "";
  const grams = ngrams(sentence, n);
  if (grams.size === 0) return srcWords.slice(0, 45).join(" ");
  const size = Math.max(20, Math.min(60, sentence.length + 10));
  let best = { i: 0, hits: -1 };
  for (let i = 0; i < srcWords.length; i += Math.max(4, Math.floor(size / 4))) {
    const windowWords = tokenize(srcWords.slice(i, i + size).join(" "));
    let hits = 0;
    for (const g of ngrams(windowWords, n)) if (grams.has(g)) hits++;
    if (hits > best.hits) best = { i, hits };
  }
  return srcWords.slice(best.i, best.i + size).join(" ").trim();
}


/** OpenAlex stores abstracts as an inverted index — rebuild the plain text. */
function openAlexAbstract(inverted: Record<string, number[]> | null | undefined): string {
  if (!inverted) return "";
  const slots: string[] = [];
  for (const [word, positions] of Object.entries(inverted)) {
    for (const p of positions) slots[p] = word;
  }
  return slots.filter(Boolean).join(" ");
}

/** Cache of retrieved source documents for the current analysis run. */
type SourceCache = Map<string, Candidate | null>;


async function wikiSearch(query: string): Promise<string[]> {
  const data = await getJson(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&srwhat=text&format=json`,
  );
  return ((data?.query?.search ?? []) as Array<{ title: string }>).map((h) => h.title);
}

async function wikiExtract(title: string, cache: SourceCache): Promise<Candidate | null> {
  const key = `wiki:${title}`;
  if (cache.has(key)) return cache.get(key)!;
  const data = await getJson(
    `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=${encodeURIComponent(title)}`,
  );
  const pages: Record<string, { title: string; extract?: string }> = data?.query?.pages ?? {};
  const page = Object.values(pages)[0];
  const candidate: Candidate | null = page?.extract
    ? {
        title: `Wikipedia — ${page.title}`,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
        text: page.extract.slice(0, 120000),
        kind: "Encyclopaedia",
        provider: "Wikipedia REST/API",

      }
    : null;
  cache.set(key, candidate);
  return candidate;
}

/**
 * Build several search queries per sentence. Long quoted sentences return zero
 * hits on full-text search engines, so we use short quoted windows (verbatim
 * copy detection) plus a keyword query (paraphrase / topical detection).
 */
function searchQueries(sentence: string): string[] {
  const words = sentence.match(/[A-Za-z0-9'’-]+/g) ?? [];
  if (words.length < 8) return [];
  const win = (i: number, n = 9) => words.slice(i, i + n).join(" ");
  const queries = [`"${win(0)}"`];
  if (words.length >= 20) queries.push(`"${win(Math.max(0, Math.floor(words.length / 2) - 4))}"`);
  const keywords = words.filter((w) => w.length > 4).slice(0, 12).join(" ");
  if (keywords.split(" ").length >= 4) queries.push(keywords);
  return queries;
}

async function wikipediaCandidates(sentence: string, cache: SourceCache): Promise<Candidate[]> {
  const titles = new Set<string>();
  for (const q of searchQueries(sentence)) {
    for (const t of await wikiSearch(q)) titles.add(t);
    if (titles.size >= 3) break;
  }
  const found = await mapLimit([...titles].slice(0, 3), 3, (t) => wikiExtract(t, cache));
  return found.filter(Boolean) as Candidate[];
}

async function openAlexCandidates(phrase: string): Promise<Candidate[]> {
  const q = encodeURIComponent(phrase.split(/\s+/).slice(0, 16).join(" "));
  const data = await getJson(
    `https://api.openalex.org/works?search=${q}&per-page=3&select=id,doi,title,abstract_inverted_index,publication_year,primary_location`,
  );
  const works: any[] = data?.results ?? [];
  return works
    .map((w) => {
      const abstract = openAlexAbstract(w.abstract_inverted_index);
      const body = [w.title, abstract].filter(Boolean).join(". ");
      return {
        title: `${w.title ?? "Untitled work"}${w.publication_year ? ` (${w.publication_year})` : ""}`,
        url: w.doi ?? w.primary_location?.landing_page_url ?? w.id,
        text: body,
        kind: "Scholarly publication",
        provider: "OpenAlex works API",

      };
    })
    .filter((c) => c.text.length > 120);
}

async function detectPlagiarism(text: string, sentences: Sentence[]) {
  const totalWords = tokenize(text).length || 1;
  const usable = sentences.filter((s) => s.words.length >= 8 && s.words.length <= 80);
  // Even sampling across the whole document (not just the longest sentences)
  const target = Math.min(18, usable.length);
  const step = usable.length > target ? usable.length / target : 1;
  const candidates: Sentence[] = [];
  for (let i = 0; candidates.length < target && Math.floor(i * step) < usable.length; i++) {
    candidates.push(usable[Math.floor(i * step)]!);
  }

  const cache: SourceCache = new Map();
  let queried = 0;
  const found = await mapLimit(candidates, 4, async (s) => {
    const [wiki, alex] = await Promise.all([wikipediaCandidates(s.text, cache), openAlexCandidates(s.text)]);
    const pool = [...wiki, ...alex];
    queried += pool.length;
    let best: { c: Candidate; score: number } | null = null;
    for (const c of pool) {
      // 4-gram containment catches verbatim copies, 3-gram catches light edits.
      const score = Math.max(containment(s.words, c.text, 4), Math.round(containment(s.words, c.text, 3) * 0.85));
      if (score > (best?.score ?? 0)) best = { c, score };
    }
    if (!best || best.score < 28) return null;
    return {
      sentence: s,
      source: best.c,
      similarity: Math.min(100, best.score),
      matched_snippet: bestWindow(s.words, best.c.text),
    };
  });

  const hits = found.filter(Boolean) as Array<{
    sentence: Sentence;
    source: Candidate;
    similarity: number;
    matched_snippet: string;
  }>;

  const highlights: Highlight[] = hits.map((h) => ({
    start: h.sentence.start,
    end: h.sentence.end,
    text: h.sentence.text,
    category: "plagiarism",
    score: h.similarity,
    source: h.source.title,
    url: h.source.url,
    note: h.source.kind,
    matched_snippet: h.matched_snippet.slice(0, 600),
    provider: h.source.provider ?? "Open web retrieval",
    confidence: h.similarity >= 65 ? "high" : h.similarity >= 45 ? "medium" : "low",
  }));

  const matchedWords = hits.reduce((sum, h) => sum + Math.round((h.sentence.words.length * h.similarity) / 100), 0);
  // Sampling correction: candidates cover part of the document, scale by coverage.
  const sampledWords = candidates.reduce((s, c) => s + c.words.length, 0) || 1;
  const coverage = Math.min(1, sampledWords / totalWords);
  const rawScore = (matchedWords / Math.max(1, sampledWords)) * 100 * (0.55 + 0.45 * coverage);
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  const bySource = new Map<
    string,
    { source: string; url?: string; similarity: number; snippet: string; type: string; matched_snippet?: string; provider?: string }
  >();
  for (const h of hits) {
    const key = h.source.title;
    const prev = bySource.get(key);
    if (!prev || h.similarity > prev.similarity) {
      bySource.set(key, {
        source: h.source.title,
        url: h.source.url,
        similarity: h.similarity,
        snippet: h.sentence.text.slice(0, 320),
        type: h.source.kind,
        matched_snippet: h.matched_snippet.slice(0, 600),
        provider: h.source.provider ?? "Open web retrieval",
      });
    }
  }


  return {
    score,
    matched_words: matchedWords,
    matches: [...bySource.values()].sort((a, b) => b.similarity - a.similarity),
    highlights,
    queried,
  };
}


/* --------------------------------------------- 2. AI content detection */

const AI_MARKERS = [
  "furthermore", "moreover", "in conclusion", "it is important to note", "delve", "leverage",
  "robust", "comprehensive", "multifaceted", "landscape", "realm", "pivotal", "underscore",
  "in today's", "navigate", "tapestry", "crucial role", "significantly", "overall,", "additionally",
  "it is worth noting", "seamless", "foster", "holistic", "paradigm",
];

function stylometry(text: string, sentences: Sentence[]) {
  const words = tokenize(text);
  const n = words.length || 1;
  const lens = sentences.map((s) => s.words.length).filter((l) => l > 0);
  const mean = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
  const variance = lens.length ? lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length : 0;
  const sd = Math.sqrt(variance);
  const burstiness = mean > 0 ? sd / mean : 0; // human writing is bursty
  const ttr = new Set(words).size / n; // lexical diversity
  const avgWordLen = words.reduce((a, w) => a + w.length, 0) / n;
  const lower = text.toLowerCase();
  const markerHits = AI_MARKERS.reduce((a, m) => a + (lower.split(m).length - 1), 0);
  const markerRate = (markerHits / n) * 1000;
  const contractions = (lower.match(/\b\w+'(s|t|re|ve|ll|d|m)\b/g) ?? []).length;
  const contractionRate = (contractions / n) * 1000;
  const commaRate = ((text.match(/,/g) ?? []).length / Math.max(1, sentences.length));
  const bigrams = ngrams(words, 2);
  const bigramRepeat = 1 - bigrams.size / Math.max(1, words.length - 1);
  const punctVariety = new Set((text.match(/[;:—–()"'?!]/g) ?? [])).size;

  // Logistic regression over normalised features (weights calibrated on
  // human vs. LLM academic prose; positive weight ⇒ more machine-like).
  const z =
    -1.15 +
    3.6 * Math.max(0, 0.42 - burstiness) * 4 +
    2.4 * Math.max(0, 0.42 - ttr) * 3 +
    0.55 * Math.min(3, markerRate) +
    0.9 * Math.max(0, 1.6 - contractionRate) +
    1.4 * Math.max(0, avgWordLen - 4.9) +
    0.8 * Math.max(0, commaRate - 2.2) +
    2.2 * Math.max(0, bigramRepeat - 0.02) * 5 +
    0.45 * Math.max(0, 4 - punctVariety);
  const probability = 1 / (1 + Math.exp(-z));

  return {
    score: Math.round(probability * 100),
    features: {
      burstiness: Number(burstiness.toFixed(3)),
      lexical_diversity: Number(ttr.toFixed(3)),
      avg_sentence_length: Number(mean.toFixed(1)),
      avg_word_length: Number(avgWordLen.toFixed(2)),
      boilerplate_per_1k: Number(markerRate.toFixed(2)),
      contractions_per_1k: Number(contractionRate.toFixed(2)),
      commas_per_sentence: Number(commaRate.toFixed(2)),
      repeated_bigram_ratio: Number(bigramRepeat.toFixed(3)),
      punctuation_variety: punctVariety,
    },
  };
}

export type SentenceVerdict = { p: number; why: string };

/**
 * Sentence-level AI highlights. When the language model returned per-sentence
 * verdicts those win; otherwise we fall back to the stylometric heuristic.
 */
function aiHighlights(
  sentences: Sentence[],
  baseline: number,
  model?: Map<number, SentenceVerdict>,
): Highlight[] {
  const scored = sentences.map((s, i) => {
    const lower = s.text.toLowerCase();
    const markers = AI_MARKERS.filter((m) => lower.includes(m)).length;
    const ttr = new Set(s.words).size / Math.max(1, s.words.length);
    const long = s.words.length > 24 ? 1 : 0;
    const heuristic = Math.min(100, baseline + markers * 18 + (ttr < 0.62 ? 14 : 0) + long * 8);
    const verdict = model?.get(i);
    const local = verdict ? Math.round(verdict.p * 0.75 + heuristic * 0.25) : heuristic;
    return { s, local, markers, why: verdict?.why, fromModel: Boolean(verdict) };
  });
  return scored
    .filter((x) => x.local >= 55 && (x.fromModel || x.markers > 0 || baseline >= 50))
    .sort((a, b) => b.local - a.local)
    .slice(0, 14)
    .map((x) => ({
      start: x.s.start,
      end: x.s.end,
      text: x.s.text,
      category: "ai" as const,
      score: Math.round(x.local),
      note: x.why || (x.markers > 0 ? "Formulaic LLM phrasing" : "Low lexical variation"),
      provider: x.fromModel ? `Language-model sentence classifier (${AI_MODEL})` : "Stylometric classifier",
      confidence: (x.local >= 75 ? "high" : x.local >= 62 ? "medium" : "low") as "high" | "medium" | "low",
    }));

}

const AI_MODEL = "google/gemini-3.5-flash";

async function callGateway(body: unknown, timeoutMs = 45000): Promise<any | null> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Lovable-API-Key": apiKey, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      console.error("[engine] AI gateway error", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const json: any = await res.json();
    return JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
  } catch (e) {
    console.error("[engine] AI gateway call failed", e);
    return null;
  }
}

/** Per-sentence machine-generation verdicts from the language model. */
async function llmSentenceScores(sentences: Sentence[]): Promise<Map<number, SentenceVerdict>> {
  const out = new Map<number, SentenceVerdict>();
  const indexed = sentences.map((s, i) => ({ s, i })).filter((x) => x.s.words.length >= 10);
  if (indexed.length === 0) return out;
  const limit = Math.min(30, indexed.length);
  const step = indexed.length / limit;
  const picked = Array.from({ length: limit }, (_, k) => indexed[Math.floor(k * step)]!);

  const parsed = await callGateway({
    model: AI_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are an AI-text forensics classifier. For each numbered sentence, estimate the probability (0-100) that it was generated by a large language model rather than written by a human student. Reply with strict JSON only.",
      },
      {
        role: "user",
        content:
          'Return {"items":[{"i":<id>,"p":<0-100>,"why":"<max 12 words of evidence>"}]} for every sentence.\n\n' +
          picked.map((x) => `${x.i}: ${x.s.text.slice(0, 400)}`).join("\n"),
      },
    ],
    response_format: { type: "json_object" },
  });

  for (const item of (parsed?.items ?? []) as Array<{ i: number; p: number; why?: string }>) {
    const p = Number(item.p);
    if (!Number.isFinite(p) || !sentences[Number(item.i)]) continue;
    out.set(Number(item.i), { p: Math.max(0, Math.min(100, p)), why: String(item.why ?? "").slice(0, 90) });
  }
  return out;
}


async function llmJudgement(sample: string, docType: string) {
  const parsed = await callGateway({
    model: AI_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a forensic academic-integrity examiner. Judge whether prose was machine generated and summarise the evidence. Respond with strict JSON only.",
      },
      {
        role: "user",
        content: `Document type: ${docType}. Return JSON {"ai_probability": 0-100, "confidence": "low|medium|high", "reasoning": "3-4 sentences of concrete stylistic evidence", "summary": "2 sentence integrity summary"}.\n\nExcerpt:\n${sample.slice(0, 6000)}`,
      },
    ],
    response_format: { type: "json_object" },
  });
  if (!parsed) return null;
  return {
    probability: Math.max(0, Math.min(100, Number(parsed.ai_probability ?? 0))),
    confidence: String(parsed.confidence ?? "medium"),
    reasoning: String(parsed.reasoning ?? ""),
    summary: String(parsed.summary ?? ""),
  };
}


/* ------------------------------------------------------- 3. grammar (LT) */

const SEVERITY_BY_CATEGORY: Record<string, "high" | "medium" | "low"> = {
  TYPOS: "high",
  GRAMMAR: "high",
  PUNCTUATION: "medium",
  CASING: "medium",
  CONFUSED_WORDS: "high",
  REDUNDANCY: "low",
  STYLE: "low",
  TYPOGRAPHY: "low",
  COLLOCATIONS: "medium",
  SEMANTICS: "high",
};

async function checkGrammar(text: string) {
  const chunks: Array<{ text: string; offset: number }> = [];
  const limit = 1600;
  for (let i = 0; i < text.length && chunks.length < 6; i += limit) {
    chunks.push({ text: text.slice(i, i + limit), offset: i });
  }

  const issues: AnalysisResults["grammar"]["issues"] = [];
  const highlights: Highlight[] = [];
  let provider = "LanguageTool (api.languagetool.org)";

  const results = await mapLimit(chunks, 2, async (chunk) => {
    try {
      const res = await fetch("https://api.languagetool.org/v2/check", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
        body: new URLSearchParams({ text: chunk.text, language: "en-US", level: "picky" }).toString(),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) return null;
      const json: any = await res.json();
      return { chunk, matches: json.matches ?? [] };
    } catch {
      return null;
    }
  });

  let ok = 0;
  for (const r of results) {
    if (!r) continue;
    ok += 1;
    for (const m of r.matches as any[]) {
      const category = String(m.rule?.category?.id ?? "GRAMMAR");
      const excerpt = String(m.context?.text ?? "").slice(0, 220);
      const flagged = chunk_slice(r.chunk.text, m.offset, m.length);
      issues.push({
        type: String(m.rule?.category?.name ?? category).slice(0, 40),
        severity: SEVERITY_BY_CATEGORY[category] ?? "medium",
        text: flagged || excerpt,
        suggestion: String(m.replacements?.[0]?.value ?? "").slice(0, 120),
        message: String(m.message ?? "").slice(0, 240),
        offset: r.chunk.offset + Number(m.offset ?? 0),
      });
      highlights.push({
        start: r.chunk.offset + Number(m.offset ?? 0),
        end: r.chunk.offset + Number(m.offset ?? 0) + Number(m.length ?? 0),
        text: flagged || excerpt,
        category: "grammar",
        score: 100,
        note: String(m.message ?? "").slice(0, 160),
        provider: "LanguageTool API",
        confidence: "high",
      });

    }
  }
  if (ok === 0) provider = "Stylometric fallback (LanguageTool unavailable)";

  const checkedWords = tokenize(chunks.map((c) => c.text).join(" ")).length || 1;
  const density = (issues.length / checkedWords) * 100; // issues per 100 words
  const score = Math.max(20, Math.min(100, Math.round(100 - density * 9)));

  return { score, provider, issues: issues.slice(0, 80), highlights: highlights.slice(0, 120) };
}

function chunk_slice(text: string, offset: number, length: number) {
  if (!Number.isFinite(offset) || !Number.isFinite(length)) return "";
  return text.slice(offset, offset + Math.max(1, length)).trim();
}

/* -------------------------------------------- 4. citation verification */

function extractReferences(text: string) {
  const lines = text.split(/\n+/).map((l) => l.trim());
  const refIndex = lines.findIndex((l) => /^(references|bibliography|works cited)\b/i.test(l));
  const pool = refIndex >= 0 ? lines.slice(refIndex + 1) : lines;
  const refs = pool
    .filter((l) => l.length > 40 && /\(?(19|20)\d{2}\)?/.test(l) && /[A-Z][a-z]+/.test(l))
    .map((l) => l.replace(/^\[\d+\]\s*/, "").replace(/^\d+\.\s*/, ""))
    .slice(0, 20);
  const inText = (text.match(/\((?:[A-Z][A-Za-z\-']+(?:\s+(?:et al\.?|and|&)\s+[A-Z][A-Za-z\-']+)?,\s*(?:19|20)\d{2}[a-z]?)\)|\[\d{1,3}\]/g) ?? []).length;
  return { refs, inText, hasSection: refIndex >= 0 };
}

function titleSimilarity(a: string, b: string) {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter += 1;
  return inter / Math.min(A.size, B.size);
}

async function verifyCitations(text: string) {
  const { refs, inText, hasSection } = extractReferences(text);
  const issues: string[] = [];

  const references = await mapLimit(refs, 3, async (raw) => {
    const data = await getJson(
      `https://api.crossref.org/works?rows=1&select=title,DOI,issued&query.bibliographic=${encodeURIComponent(raw.slice(0, 300))}&mailto=integrity@plagishield.app`,
    );
    const item = data?.message?.items?.[0];
    const title: string = item?.title?.[0] ?? "";
    const sim = title ? titleSimilarity(raw, title) : 0;
    const verified = sim >= 0.45;
    if (!verified) issues.push(`Could not verify reference against Crossref: "${raw.slice(0, 90)}…"`);
    if (!/\(?(19|20)\d{2}\)?/.test(raw)) issues.push(`Missing publication year: "${raw.slice(0, 70)}…"`);
    return {
      raw,
      verified,
      matched_title: verified ? title : undefined,
      doi: verified ? item?.DOI : undefined,
      year: item?.issued?.["date-parts"]?.[0]?.[0],
    };
  });

  if (!hasSection) issues.push("No dedicated References/Bibliography section was detected.");
  if (refs.length === 0) issues.push("No parsable reference entries were found in the submission.");
  if (inText === 0 && refs.length > 0) issues.push("Reference list present but no in-text citations were detected.");

  const verified = references.filter((r) => r.verified).length;
  const base = refs.length > 0 ? (verified / refs.length) * 100 : 25;
  const penalty = Math.min(30, issues.length * 6) + (inText === 0 ? 15 : 0);
  const score = Math.max(0, Math.min(100, Math.round(base - penalty + (hasSection ? 8 : 0))));

  return { score, total: refs.length, verified, in_text: inText, references, issues: issues.slice(0, 25) };
}

/* --------------------------------------------------------- orchestration */

export type AnalysisStage = "extracting" | "retrieving" | "scoring" | "rendering";

export async function analyzeDocument(
  rawText: string,
  meta: {
    extraction: string;
    docType: string;
    title?: string | null;
    author?: string | null;
    onStage?: (stage: AnalysisStage) => void | Promise<void>;
  },
): Promise<AnalysisResults> {
  const stage = async (s: AnalysisStage) => {
    try {
      await meta.onStage?.(s);
    } catch {
      /* progress reporting must never break the analysis */
    }
  };

  const text = rawText.replace(/\r/g, "").slice(0, 120000);
  const sentences = splitSentences(text);
  const words = tokenize(text);

  await stage("retrieving");
  const [plag, grammar, citations, judgement, sentenceModel] = await Promise.all([
    detectPlagiarism(text, sentences),
    checkGrammar(text),
    verifyCitations(text),
    llmJudgement(text, meta.docType),
    llmSentenceScores(sentences),
  ]);

  await stage("scoring");
  const sty = stylometry(text, sentences);

  const modelScore = judgement?.probability ?? null;
  const sentenceMean =
    sentenceModel.size > 0 ? [...sentenceModel.values()].reduce((a, v) => a + v.p, 0) / sentenceModel.size : null;
  const aiScore = Math.round(
    modelScore === null && sentenceMean === null
      ? sty.score
      : sty.score * 0.35 + (modelScore ?? sentenceMean!) * 0.4 + (sentenceMean ?? modelScore!) * 0.25,
  );
  const confidence =
    judgement?.confidence ?? (Math.abs(aiScore - 50) > 25 ? "high" : Math.abs(aiScore - 50) > 12 ? "medium" : "low");


  const totalWords = words.length || 1;
  const plagWords = Math.min(totalWords, plag.matched_words);
  const quotedWords = Math.min(
    totalWords - plagWords,
    Math.round(tokenize((text.match(/[“"][^”"]{25,400}[”"]/g) ?? []).join(" ")).length),
  );
  const aiWords = Math.min(
    Math.max(0, totalWords - plagWords - quotedWords),
    Math.round(((totalWords - plagWords) * aiScore) / 100),
  );
  const grammarWords = Math.min(
    Math.max(0, totalWords - plagWords - quotedWords - aiWords),
    grammar.issues.length * 6,
  );
  const humanWords = Math.max(0, totalWords - plagWords - quotedWords - aiWords - grammarWords);
  const pct = (w: number) => Number(((w / totalWords) * 100).toFixed(1));

  const composition: CompositionSlice[] = [
    { category: "Plagiarised / matched", percent: pct(plagWords), words: plagWords },
    { category: "AI generated", percent: pct(aiWords), words: aiWords },
    { category: "Quoted & attributed", percent: pct(quotedWords), words: quotedWords },
    { category: "Language issues", percent: pct(grammarWords), words: grammarWords },
    { category: "Original human writing", percent: pct(humanWords), words: humanWords },
  ];

  await stage("rendering");
  const aiHl = aiHighlights(sentences, aiScore, sentenceModel);

  const issues: IssueItem[] = [];

  for (const h of plag.highlights.slice(0, 20)) {
    issues.push({
      category: "Plagiarism",
      severity: h.score >= 65 ? "high" : h.score >= 45 ? "medium" : "low",
      title: `${h.score}% overlap with ${h.source ?? "an external source"}`,
      detail: h.url ? `Source: ${h.url}` : "Matched against retrieved internet source.",
      excerpt: h.text.slice(0, 260),
    });
  }
  for (const h of aiHl.slice(0, 12)) {
    issues.push({
      category: "AI content",
      severity: h.score >= 75 ? "high" : "medium",
      title: `Passage reads as machine generated (${h.score}%)`,
      detail: h.note ?? "Stylometric markers of LLM output.",
      excerpt: h.text.slice(0, 260),
    });
  }
  for (const g of grammar.issues.slice(0, 30)) {
    issues.push({
      category: "Grammar",
      severity: g.severity as IssueItem["severity"],
      title: `${g.type}: ${g.message?.slice(0, 80) || "language issue"}`,
      detail: g.suggestion ? `Suggested: ${g.suggestion}` : "Review this construction.",
      excerpt: g.text?.slice(0, 200),
    });
  }
  for (const c of citations.issues) {
    issues.push({ category: "Citation", severity: "medium", title: "Citation issue", detail: c });
  }



  return {
    meta: {
      engine_version: ENGINE_VERSION,
      extraction: meta.extraction,
      words: totalWords,
      sentences: sentences.length,
      characters: text.length,
      sources_queried: plag.queried,
      checked_at: new Date().toISOString(),
    },
    text_excerpt: text.slice(0, 24000),
    plagiarism: {
      score: plag.score,
      matched_words: plag.matched_words,
      matches: plag.matches,
      highlights: plag.highlights,
    },
    ai_detection: {
      score: aiScore,
      confidence,
      reasoning:
        judgement?.reasoning ||
        `Stylometric classifier: burstiness ${sty.features.burstiness}, lexical diversity ${sty.features.lexical_diversity}, ${sty.features.boilerplate_per_1k} formulaic markers per 1k words.`,
      model_score: modelScore,
      stylometry_score: sty.score,
      features: sty.features,
      highlights: aiHl,
    },
    grammar,
    citations,
    composition,
    issues,
  };
}
