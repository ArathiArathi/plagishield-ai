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
 * Build several keyword queries per sentence to query open academic repositories.
 */
function searchQueries(sentence: string): string[] {
  const words = sentence.match(/[A-Za-z0-9'’-]+/g) ?? [];
  if (words.length < 6) return [];
  const stopWords = new Set([
    "this", "that", "these", "those", "with", "from", "have", "been", "were", "what",
    "when", "where", "which", "will", "would", "could", "should", "their", "there",
    "about", "after", "before", "between", "through", "during", "under", "above", "into",
    "also", "such", "other", "more", "most", "some", "only", "both", "each", "than"
  ]);
  const keywords = words.filter((w) => w.length > 3 && !stopWords.has(w.toLowerCase())).slice(0, 8).join(" ");
  const queries: string[] = [];
  if (keywords.split(" ").length >= 3) queries.push(keywords);
  const win = words.slice(0, 7).join(" ");
  if (win && win !== keywords) queries.push(win);
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
  const words = phrase.match(/[A-Za-z0-9]+/g) ?? [];
  const stopWords = new Set(["this", "that", "with", "from", "have", "been", "were", "which", "will", "would", "their"]);
  const keywords = words.filter((w) => w.length > 3 && !stopWords.has(w.toLowerCase())).slice(0, 7).join(" ");
  if (!keywords) return [];
  const q = encodeURIComponent(keywords);
  const data = await getJson(
    `https://api.openalex.org/works?search=${q}&per-page=2&select=id,doi,title,abstract_inverted_index,publication_year,primary_location`,
    7000
  );
  const works: any[] = data?.results ?? [];
  return works
    .map((w) => {
      const abstract = openAlexAbstract(w.abstract_inverted_index);
      const body = [w.title, abstract].filter(Boolean).join(". ");
      return {
        title: `${w.title ?? "Scholarly publication"}${w.publication_year ? ` (${w.publication_year})` : ""}`,
        url: w.doi ?? w.primary_location?.landing_page_url ?? w.id,
        text: body,
        kind: "Scholarly publication",
        provider: "OpenAlex works API",
      };
    })
    .filter((c) => c.text.length > 60);
}

async function crossrefCandidates(phrase: string): Promise<Candidate[]> {
  const words = phrase.match(/[A-Za-z0-9]+/g) ?? [];
  const keywords = words.filter((w) => w.length > 4).slice(0, 7).join(" ");
  if (!keywords) return [];
  const data = await getJson(
    `https://api.crossref.org/works?rows=2&select=title,DOI,abstract,container-title&query=${encodeURIComponent(keywords)}&mailto=integrity@plagishield.app`,
    7000
  );
  const items: any[] = data?.message?.items ?? [];
  return items.map((it) => {
    const title = it.title?.[0] ?? "Scholarly Publication";
    const venue = it["container-title"]?.[0] ? ` (${it["container-title"][0]})` : "";
    const abstract = (it.abstract ?? "").replace(/<[^>]+>/g, "").trim();
    return {
      title: `${title}${venue}`,
      url: it.DOI ? `https://doi.org/${it.DOI}` : undefined,
      text: [title, abstract].filter(Boolean).join(". "),
      kind: "Academic Journal / Conference Proceedings",
      provider: "Crossref Scholarly Index",
    };
  }).filter((c) => c.text.length > 40);
}

async function detectPlagiarism(text: string, sentences: Sentence[]) {
  const totalWords = tokenize(text).length || 1;
  const usable = sentences.filter((s) => s.words.length >= 8 && s.words.length <= 80);
  const target = Math.min(8, usable.length);
  const step = usable.length > target ? usable.length / target : 1;
  const candidates: Sentence[] = [];
  for (let i = 0; candidates.length < target && Math.floor(i * step) < usable.length; i++) {
    candidates.push(usable[Math.floor(i * step)]!);
  }

  // Also query document-level key terms (title / abstract keywords)
  const docKeywords = (text.slice(0, 1500).match(/[A-Za-z0-9]+/g) ?? [])
    .filter((w) => w.length > 5)
    .slice(0, 8)
    .join(" ");

  const cache: SourceCache = new Map();
  let queried = 0;

  // Retrieve foundational topical candidates first
  const [docWiki, docAlex, docCross] = await Promise.all([
    wikipediaCandidates(docKeywords, cache),
    openAlexCandidates(docKeywords),
    crossrefCandidates(docKeywords),
  ]);
  const docPool = [...docWiki, ...docAlex, ...docCross];
  queried += docPool.length;

  const found = await mapLimit(candidates, 3, async (s) => {
    const [wiki, alex, cross] = await Promise.all([
      wikipediaCandidates(s.text, cache),
      openAlexCandidates(s.text),
      crossrefCandidates(s.text),
    ]);
    const pool = [...docPool, ...wiki, ...alex, ...cross];
    queried += pool.length;
    let best: { c: Candidate; score: number } | null = null;
    for (const c of pool) {
      const score = Math.max(containment(s.words, c.text, 4), Math.round(containment(s.words, c.text, 3) * 0.85));
      if (score > (best?.score ?? 0)) best = { c, score };
    }
    if (!best || best.score < 24) return null;
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

const AI_SPECIFIC_PHRASES = [
  "in today's rapidly evolving",
  "in today's digital era",
  "in the contemporary landscape",
  "delving into the realm",
  "delve into the",
  "delves into",
  "a testament to",
  "plays a pivotal role",
  "play a pivotal role",
  "serves as a cornerstone",
  "is a cornerstone of",
  "multifaceted nature",
  "multifaceted approach",
  "multifaceted power",
  "holistic understanding",
  "holistic approach",
  "it is important to note",
  "it is worth noting",
  "it is crucial to remember",
  "navigating the complexities",
  "navigate the complexities",
  "navigate the nuances",
  "foster a deeper",
  "fosters a",
  "foster a",
  "rich tapestry",
  "vibrant tapestry",
  "beacon of hope",
  "catalyst for change",
  "a myriad of",
  "paves the way for",
  "paving the way",
  "by embracing this",
  "by leveraging the",
  "seamlessly integrate",
  "seamless integration",
  "deep dive into",
  "in conclusion,",
  "to conclude,",
  "in summary,",
  "to sum up,",
  "crucial role in",
  "resilient future for all",
  "not without its challenges",
];

const AI_KEYWORDS = [
  "delve", "delving", "pivotal", "multifaceted", "holistic", "tapestry", "seamlessly",
  "underscores", "fosters", "cornerstone", "linchpin", "navigating",
  "transformative", "burgeoning", "intertwined", "unravel", "myriad",
  "paramount", "imperative", "catalyst", "overarching", "bespoke"
];

function stylometry(text: string, sentences: Sentence[]) {
  const words = tokenize(text);
  const totalWords = words.length || 1;
  const numSentences = Math.max(1, sentences.length);
  const lower = text.toLowerCase();

  // 1. Sentence length distribution & burstiness (human writing has high variance)
  const lens = sentences.map((s) => s.words.length).filter((l) => l > 0);
  const meanLen = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 15;
  const variance = lens.length ? lens.reduce((a, b) => a + (b - meanLen) ** 2, 0) / lens.length : 0;
  const sd = Math.sqrt(variance);
  const burstiness = meanLen > 0 ? sd / meanLen : 0;

  // First-order delta burstiness (adjacent sentence jump differences)
  let jumpSum = 0;
  for (let i = 0; i < lens.length - 1; i++) {
    jumpSum += Math.abs(lens[i + 1]! - lens[i]!);
  }
  const deltaBurstiness = lens.length > 1 ? (jumpSum / (lens.length - 1)) / meanLen : 0.35;

  // 2. AI Multi-word phrase matches
  let aiPhraseHits = 0;
  for (const phrase of AI_SPECIFIC_PHRASES) {
    let pos = 0;
    while ((pos = lower.indexOf(phrase, pos)) !== -1) {
      aiPhraseHits++;
      pos += phrase.length;
    }
  }
  const aiPhraseDensity = (aiPhraseHits / totalWords) * 1000;

  // 3. AI Keyword matches
  let aiKeywordHits = 0;
  for (const kw of AI_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, "g");
    const m = lower.match(re);
    if (m) aiKeywordHits += m.length;
  }
  const aiKeywordDensity = (aiKeywordHits / totalWords) * 1000;

  // 4. Triad grouping pattern (X, Y, and Z)
  const triadRegex = /\b\w{4,},\s+\w{4,},\s+and\s+\w{4,}\b/g;
  const triads = (text.match(triadRegex) ?? []).length;
  const triadDensity = triads / numSentences;

  // 5. Formulaic transition openers (Furthermore, Moreover, Additionally, In conclusion)
  let transitionOpeners = 0;
  for (const s of sentences) {
    const st = s.text.trim().toLowerCase();
    if (/^(furthermore|moreover|additionally|in conclusion|in summary|ultimately|consequently|to conclude)[,]/i.test(st)) {
      transitionOpeners++;
    }
  }
  const transitionOpenerRatio = transitionOpeners / numSentences;

  // 6. Positive Human Research & Scholarly Indicators
  const empiricalMetrics = (text.match(/\b\d+(\.\d+)?\s*(%|ms|s|gb|mb|kb|ghz|mhz|khz|fps|km|m|cm|mm|clients?|nodes?|packets?|epochs?)\b/gi) ?? []).length;
  const artifactRefs = (text.match(/\b(table|figure|fig\.|section|sec\.|eq\.|equation|algorithm|appendix)\s+\d+([a-z]|\.\d+)?\b/gi) ?? []).length;
  const authorialAgency = (text.match(/\b(we\s+(propose|evaluate|investigate|demonstrate|observe|implement|collected|conducted|designed|developed|found|measured|analyzed|tested)|our\s+(framework|approach|system|model|dataset|experiments?|findings?|results?|prototype|pipeline|architecture|analysis|methodology)|in\s+this\s+(work|paper|study|section))\b/gi) ?? []).length;
  const citations = (text.match(/\[\d+(?:[,\s–-]+\d+)*\]|\([A-Z][a-z]+(?:\s+et\s+al\.)?,\s*\d{4}\)/g) ?? []).length;

  const humanEvidenceCount = empiricalMetrics * 1.5 + artifactRefs * 2 + authorialAgency * 2 + citations * 1.5;
  const humanEvidenceRate = (humanEvidenceCount / totalWords) * 1000;

  // Dampen phrase penalty if text contains substantial human empirical research evidence
  const dampener = humanEvidenceRate > 40 ? 0.6 : 1.0;

  // 7. Composite Calibrated Logistic Score
  let z = -2.2;

  // Add AI indicators:
  z += Math.min(4.0, aiPhraseDensity * 0.25 * dampener);
  z += Math.min(2.5, aiKeywordDensity * 0.25 * dampener);
  z += Math.min(2.0, triadDensity * 2.2);
  z += Math.min(2.2, transitionOpenerRatio * 3.5);

  // Uniformity penalty (low burstiness & low delta indicates mechanical LLM output)
  if (burstiness < 0.22) {
    z += (0.22 - burstiness) * 6.5;
  }
  if (deltaBurstiness < 0.25) {
    z += (0.25 - deltaBurstiness) * 5.5;
  }

  // Credit Human indicators (subtract from z):
  if (burstiness > 0.30) {
    z -= Math.min(1.8, (burstiness - 0.30) * 3.5);
  }
  if (deltaBurstiness > 0.32) {
    z -= Math.min(1.8, (deltaBurstiness - 0.32) * 3.0);
  }
  z -= Math.min(4.0, humanEvidenceRate * 0.20);

  const probability = 1 / (1 + Math.exp(-z));
  const score = Math.max(1, Math.min(99, Math.round(probability * 100)));

  // Generate detailed forensic reasoning
  let reasoning = "";
  if (score < 25) {
    reasoning = `Analysis confirms authentic human authorship (estimated ${score}% AI likelihood). Text exhibits natural sentence-length burstiness (CV = ${burstiness.toFixed(2)}) with healthy structural delta (${deltaBurstiness.toFixed(2)}). Rich empirical markers, experimental references, and authorial agency (${humanEvidenceCount.toFixed(0)} evidentiary markers) are present without formulaic generative AI transitions.`;
  } else if (score < 60) {
    reasoning = `Text shows mixed stylometric characteristics (${score}% AI likelihood). While core sections display human research framing and empirical detail, localized passages contain standardized transition structures and predictable phrasing (${aiPhraseDensity.toFixed(1)} AI markers per 1k words), suggesting potential AI-assisted editing or automated paraphrasing.`;
  } else {
    reasoning = `High probability of synthetic generative AI authorship (${score}% AI likelihood). The text exhibits low sentence-length entropy (CV = ${burstiness.toFixed(2)}), repetitive triadic parallelisms, and a dense concentration of formulaic LLM transition idioms (${aiPhraseDensity.toFixed(1)} markers per 1k words) without primary empirical or experimental signatures.`;
  }

  return {
    score,
    reasoning,
    features: {
      burstiness: Number(burstiness.toFixed(3)),
      delta_burstiness: Number(deltaBurstiness.toFixed(3)),
      avg_sentence_length: Number(meanLen.toFixed(1)),
      ai_phrase_density: Number(aiPhraseDensity.toFixed(2)),
      ai_keyword_density: Number(aiKeywordDensity.toFixed(2)),
      triad_density: Number(triadDensity.toFixed(2)),
      transition_opener_ratio: Number(transitionOpenerRatio.toFixed(2)),
      human_evidence_count: Number(humanEvidenceCount.toFixed(1)),
      human_evidence_rate: Number(humanEvidenceRate.toFixed(2)),
    },
  };
}

export type SentenceVerdict = { p: number; why: string };

/**
 * Sentence-level AI highlights. Evaluates multi-word phrases, transition openers,
 * triadic parallelism, and discounts sentences bearing primary empirical research metrics.
 */
function aiHighlights(
  sentences: Sentence[],
  baseline: number,
  model?: Map<number, SentenceVerdict>,
): Highlight[] {
  const scored = sentences.map((s, i) => {
    const lower = s.text.toLowerCase();
    
    // Check for AI phrases
    let phraseHits = 0;
    let matchedPhrase = "";
    for (const p of AI_SPECIFIC_PHRASES) {
      if (lower.includes(p)) {
        phraseHits++;
        if (!matchedPhrase) matchedPhrase = p;
      }
    }

    // Check for AI keywords
    let kwHits = 0;
    for (const kw of AI_KEYWORDS) {
      if (new RegExp(`\\b${kw}\\b`).test(lower)) kwHits++;
    }

    // Check for transition opener
    const isOpener = /^(furthermore|moreover|additionally|in conclusion|in summary|ultimately|consequently|to conclude)[,]/i.test(s.text.trim());

    // Check for triadic pattern
    const hasTriad = /\b\w{4,},\s+\w{4,},\s+and\s+\w{4,}\b/.test(s.text);

    // Check for empirical numbers / research metrics (human credit)
    const hasEmpirical = /\b\d+(\.\d+)?\s*(%|ms|s|gb|mb|kb|ghz|mhz|khz|fps|km|m|cm|mm|clients?|nodes?|packets?|epochs?)\b/i.test(s.text) ||
      /\b(table|figure|fig\.|section|sec\.|eq\.|equation|algorithm)\s+\d+/i.test(s.text) ||
      /\[\d+(?:[,\s–-]+\d+)*\]/.test(s.text);

    // Compute sentence-level probability
    let local = baseline;
    if (phraseHits > 0) local += phraseHits * 32;
    if (kwHits > 0) local += kwHits * 18;
    if (isOpener) local += 22;
    if (hasTriad) local += 20;
    if (hasEmpirical) local -= 35; // Strongly protect genuine research sentences

    local = Math.max(0, Math.min(100, local));

    const verdict = model?.get(i);
    const finalScore = verdict ? Math.round(verdict.p * 0.70 + local * 0.30) : local;

    let note = "Formulaic LLM sentence structure";
    if (matchedPhrase) note = `Contains stereotypical LLM phrase "${matchedPhrase}"`;
    else if (isOpener) note = "Formulaic transition opener with low entropy";
    else if (hasTriad) note = "Predictable triadic parallel clause structure";

    return {
      s,
      score: finalScore,
      why: verdict?.why || note,
      fromModel: Boolean(verdict),
      hasAiSignatures: phraseHits > 0 || kwHits > 0 || isOpener || hasTriad,
    };
  });

  return scored
    .filter((x) => x.score >= 50 && (x.fromModel || x.hasAiSignatures || baseline >= 60))
    .sort((a, b) => b.score - a.score)
    .slice(0, 14)
    .map((x) => ({
      start: x.s.start,
      end: x.s.end,
      text: x.s.text,
      category: "ai" as const,
      score: Math.round(x.score),
      note: x.why,
      provider: x.fromModel ? `Language-model sentence classifier (${AI_MODEL})` : "Forensic stylometric classifier",
      confidence: (x.score >= 75 ? "high" : x.score >= 60 ? "medium" : "low") as "high" | "medium" | "low",
    }));
}

const AI_MODEL = "google/gemini-2.5-flash";

async function callGateway(body: unknown, timeoutMs = 35000): Promise<any | null> {
  const apiKey =
    process.env["LOVABLE_API_KEY"] ||
    process.env["GEMINI_API_KEY"] ||
    process.env["OPENAI_API_KEY"];
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
    const rawContent = json.choices?.[0]?.message?.content ?? "{}";
    const cleanContent = rawContent.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    return JSON.parse(cleanContent);
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

function isProperNounOrDomainTerm(
  word: string,
  context: string,
  author?: string | null,
  title?: string | null,
): boolean {
  const clean = word.trim().replace(/^['"“‘`]+|['"”’`.,;:]+$/g, "");
  if (!clean || clean.length <= 1) return true;

  // Check author or title
  if (author && author.toLowerCase().includes(clean.toLowerCase())) return true;
  if (title && title.toLowerCase().includes(clean.toLowerCase())) return true;

  // Acronyms (e.g. SOC, SOCs, FL, IDS, PCAP, GDPR, HIPAA, MLSys, CICIDS, CICIDS2017, PyTorch, RTX, TON_IoT, FedAvg, NIDS)
  if (/^[A-Z0-9_]{2,}s?$/.test(clean)) return true;
  if (/[a-z]+[A-Z0-9]/.test(clean)) return true; // CamelCase
  if (/^[A-Z][a-z0-9]+[A-Z]/.test(clean)) return true;

  // Hyphenated compound terms (e.g. non-repudiable, privacy-preserving, tree-explainer)
  if (/^[a-zA-Z0-9]+-[a-zA-Z0-9]+(-[a-zA-Z0-9]+)?$/.test(clean)) return true;

  // Capitalized proper nouns inside sentences (names, locations, institutions)
  if (/^[A-Z][a-z]+/.test(clean)) {
    const idx = context.indexOf(clean);
    if (idx > 0) {
      const prev = context.slice(0, idx).trim();
      // If previous char is NOT sentence terminator, it's mid-sentence proper noun
      if (!/[.!?]$/.test(prev) && !/\n\s*$/.test(prev)) {
        return true;
      }
    }
  }

  // Common academic header keywords
  if (
    /(department|college|university|institute|faculty|school|bangalore|karnataka|india|delhi|mumbai|chennai|california|ieee|acm|springer|elsevier|proc\.|proceedings)/i.test(
      context,
    )
  ) {
    if (/^[A-Z]/.test(clean)) return true;
  }

  return false;
}

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

function heuristicGrammarCheck(text: string, author?: string | null, title?: string | null) {
  const issues: AnalysisResults["grammar"]["issues"] = [];
  const highlights: Highlight[] = [];

  // 1. Repeated consecutive words: "the the", "in in", "of of"
  const dupRe = /\b([a-zA-Z]{2,})\s+\1\b/gi;
  let dm: RegExpExecArray | null;
  while ((dm = dupRe.exec(text)) !== null && issues.length < 15) {
    const word = dm[1]!;
    issues.push({
      type: "TYPOS",
      severity: "medium",
      text: dm[0],
      suggestion: word,
      message: `Possible duplicated word: "${word}"`,
      offset: dm.index,
    });
    highlights.push({
      start: dm.index,
      end: dm.index + dm[0].length,
      text: dm[0],
      category: "grammar",
      score: 90,
      note: `Repeated word: "${word}"`,
      provider: "Heuristic Grammar Engine",
      confidence: "high",
    });
  }

  // 2. Informal contractions in academic writing
  const contractions: Record<string, string> = {
    "don't": "do not",
    "can't": "cannot",
    "won't": "will not",
    "doesn't": "does not",
    "it's": "it is",
    "we've": "we have",
    "they're": "they are",
    "couldn't": "could not",
    "shouldn't": "should not",
    "wouldn't": "would not",
  };
  for (const [contraction, expansion] of Object.entries(contractions)) {
    const re = new RegExp(`\\b${contraction}\\b`, "gi");
    let cm: RegExpExecArray | null;
    while ((cm = re.exec(text)) !== null && issues.length < 25) {
      issues.push({
        type: "STYLE",
        severity: "low",
        text: cm[0],
        suggestion: expansion,
        message: `Use formal academic expansion "${expansion}" instead of contraction "${cm[0]}"`,
        offset: cm.index,
      });
      highlights.push({
        start: cm.index,
        end: cm.index + cm[0].length,
        text: cm[0],
        category: "grammar",
        score: 75,
        note: `Informal contraction in formal prose; suggest "${expansion}"`,
        provider: "Heuristic Grammar Engine",
        confidence: "medium",
      });
    }
  }

  // 3. Lowercase word starting sentence after terminal punctuation
  const lcSentenceRe = /[.!?]\s+([a-z][a-z0-9]{2,})/g;
  let lm: RegExpExecArray | null;
  while ((lm = lcSentenceRe.exec(text)) !== null && issues.length < 35) {
    const word = lm[1]!;
    if (word !== "etc" && word !== "al") {
      const start = lm.index + lm[0].length - word.length;
      issues.push({
        type: "CASING",
        severity: "medium",
        text: word,
        suggestion: word.charAt(0).toUpperCase() + word.slice(1),
        message: `Sentence begins with lowercase character: "${word}"`,
        offset: start,
      });
      highlights.push({
        start,
        end: start + word.length,
        text: word,
        category: "grammar",
        score: 85,
        note: `Sentence should begin with uppercase letter`,
        provider: "Heuristic Grammar Engine",
        confidence: "high",
      });
    }
  }

  return { issues, highlights };
}

async function checkGrammar(text: string, author?: string | null, title?: string | null) {
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
        signal: AbortSignal.timeout(12000),
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
      const ruleId = String(m.rule?.id ?? "");
      const excerpt = String(m.context?.text ?? "").slice(0, 220);
      const flagged = chunk_slice(r.chunk.text, m.offset, m.length);

      // Filter proper nouns, domain terminology, and acronyms from false typo penalties
      if (category === "TYPOS" || ruleId.includes("SPELLING") || ruleId.includes("MORFOLOGIK")) {
        if (isProperNounOrDomainTerm(flagged || excerpt, excerpt, author, title)) {
          continue;
        }
      }

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

  // If LanguageTool failed (rate limited or down) or found few issues, supplement with heuristic check
  if (ok === 0 || issues.length === 0) {
    const heuristic = heuristicGrammarCheck(text, author, title);
    if (ok === 0) {
      provider = "PlagiShield Forensic Grammar & Style Engine";
      issues.push(...heuristic.issues);
      highlights.push(...heuristic.highlights);
    } else if (heuristic.issues.length > 0) {
      issues.push(...heuristic.issues.slice(0, 5));
      highlights.push(...heuristic.highlights.slice(0, 5));
    }
  }

  const checkedWords = tokenize(chunks.map((c) => c.text).join(" ")).length || 1;
  const density = (issues.length / checkedWords) * 100; // issues per 100 words
  const score = Math.max(30, Math.min(100, Math.round(100 - density * 3.5)));

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

function extractTitleFromRef(raw: string): string {
  const quoted = raw.match(/["“]([^"”]+)["”]/);
  if (quoted && quoted[1].length > 10) return quoted[1].trim();
  const parts = raw.split(/[.,]/).map((p) => p.trim()).filter((p) => p.length > 15);
  return parts[0] || raw;
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
    const extractedTitle = extractTitleFromRef(raw);
    let verified = false;
    let matchedTitle: string | undefined = undefined;
    let doi: string | undefined = undefined;
    let year: number | undefined = undefined;

    // 1. Crossref rows=3 by title
    const crData = await getJson(
      `https://api.crossref.org/works?rows=3&select=title,DOI,issued&query.title=${encodeURIComponent(extractedTitle)}&mailto=integrity@plagishield.app`,
      7000,
    );
    for (const item of crData?.message?.items ?? []) {
      const itTitle: string = item?.title?.[0] ?? "";
      if (titleSimilarity(extractedTitle, itTitle) >= 0.45) {
        verified = true;
        matchedTitle = itTitle;
        doi = item?.DOI;
        year = item?.issued?.["date-parts"]?.[0]?.[0];
        break;
      }
    }

    // 2. OpenAlex fallback
    if (!verified) {
      const oaData = await getJson(
        `https://api.openalex.org/works?search=${encodeURIComponent(extractedTitle)}&per-page=3&select=id,doi,title,publication_year`,
        7000,
      );
      for (const w of oaData?.results ?? []) {
        const wTitle: string = w?.title ?? "";
        if (titleSimilarity(extractedTitle, wTitle) >= 0.45) {
          verified = true;
          matchedTitle = wTitle;
          doi = w?.doi ?? w?.id;
          year = w?.publication_year;
          break;
        }
      }
    }

    if (!verified) issues.push(`Could not verify reference against scholarly index: "${raw.slice(0, 90)}…"`);
    if (!/\(?(19|20)\d{2}\)?/.test(raw)) issues.push(`Missing publication year: "${raw.slice(0, 70)}…"`);

    return {
      raw,
      verified,
      matched_title: matchedTitle,
      doi,
      year,
    };
  });

  if (!hasSection && refs.length > 0) issues.push("No dedicated References/Bibliography section header detected.");
  if (refs.length === 0) issues.push("No parsable reference entries were found in the submission.");
  if (inText === 0 && refs.length > 0) issues.push("Reference list present but no in-text citations were detected.");

  const verified = references.filter((r) => r.verified).length;
  let base: number;
  let penalty = 0;
  if (refs.length > 0) {
    base = (verified / refs.length) * 100;
    penalty = (inText === 0 ? 15 : 0) + (!hasSection ? 8 : 0);
  } else {
    // If no references, check if document is an academic paper or standard prose
    const isAcademic = /(abstract|methodology|dataset|references|bibliography|ieee|acm|doi:)/i.test(text);
    base = isAcademic ? 45 : 85;
    if (isAcademic) {
      issues.push("Academic paper structure detected, but no reference list found. Scholarly submissions should include bibliography entries.");
    }
  }
  const score = Math.max(20, Math.min(100, Math.round(base - penalty + (verified > 0 ? 5 : 0))));

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
    checkGrammar(text, meta.author, meta.title),
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
      reasoning: judgement?.reasoning || sty.reasoning,
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
