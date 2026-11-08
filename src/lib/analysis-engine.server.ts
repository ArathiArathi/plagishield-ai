/* eslint-disable @typescript-eslint/no-explicit-any */
import { matchDocumentAgainstSources } from "@/lib/similarity-matcher.server";

/**
 * PlagiShield analysis engine (server-only).
 *
 * Real pipeline — no mock scores:
 *  1. Sentence segmentation + fingerprinting of the submitted text.
 *  2. Source retrieval over open scholarly indexes and the web, followed by
 *     offset-preserving exact phrase matching with overlapping-source evidence.
 *  3. Grammar/language checking through LanguageTool, with a small local
 *     fallback only when the service is unavailable.
 *  4. Reference-list verification against Crossref and OpenAlex.
 *
 *  AI authorship scores are intentionally not emitted until a detector has
 *  been independently validated on a representative, labelled dataset.
 */

const UA = "PlagiShieldAI/1.0 (academic integrity analysis)";
const ENGINE_VERSION = "2.1.0";

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
  alternate_sources?: Array<{ source: string; url?: string; type: string }>;
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
    matches: Array<{ source: string; url?: string; similarity: number; snippet: string; type: string; matched_snippet?: string; provider?: string; matched_words?: number; match_count?: number; match_strength?: number; domain?: string }>;
    highlights: Highlight[];
    source_coverage: { sources_retrieved: number; providers: string[]; matching_method: string; limitation: string; comparison_words: number; excluded_quoted_words: number; excluded_bibliography_words: number };
  };
  ai_detection: {
    score: number | null;
    confidence: "not_assessed";
    reasoning: string;
    model_score: null;
    stylometry_score: null;
    features: Record<string, number>;
    highlights: Highlight[];
  };
  grammar: {
    score: number | null;
    provider: string;
    issues: Array<{ type: string; severity: string; text: string; suggestion: string; message?: string; offset?: number }>;
    highlights: Highlight[];
  };
  citations: {
    score: number | null;
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

async function getText(url: string, timeoutMs = 9000): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/xml,text/plain" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function stripXmlText(xml: string): string {
  return xml
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const value = Number(code);
      return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : " ";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => {
      const value = parseInt(code, 16);
      return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : " ";
    })
    .replace(/\s+/g, " ")
    .trim();
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
const QUERY_STOP_WORDS = new Set([
  "this", "that", "these", "those", "with", "from", "have", "been", "were", "what",
  "when", "where", "which", "will", "would", "could", "should", "their", "there",
  "about", "after", "before", "between", "through", "during", "under", "above", "into",
  "also", "such", "other", "more", "most", "some", "only", "both", "each", "than",
  "paper", "study", "research", "results", "method", "methods", "analysis", "approach",
  "using", "used", "based", "shown", "demonstrate", "demonstrates", "proposed",
]);

function informativeTerms(phrase: string, limit = 8): string[] {
  const words = phrase.match(/[A-Za-z0-9]+/g) ?? [];
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const word of words) {
    const normalized = word.toLowerCase();
    if (normalized.length < 4 || QUERY_STOP_WORDS.has(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    terms.push(normalized);
  }
  return terms.slice(0, limit);
}

function searchQueries(sentence: string): string[] {
  const words = sentence.match(/[A-Za-z0-9'’-]+/g) ?? [];
  if (words.length < 6) return [];
  const keywords = informativeTerms(sentence, 8).join(" ");
  const middle = Math.max(0, Math.floor(words.length / 2) - 4);
  const centralPhrase = words.slice(middle, middle + 8).join(" ");
  const queries = [keywords, centralPhrase]
    .map((query) => query.trim())
    .filter((query, index, all) => query.split(/\s+/).length >= 3 && all.indexOf(query) === index);
  return queries.slice(0, 2);
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
  const keywords = informativeTerms(phrase, 8).join(" ");
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

async function semanticScholarCandidates(phrase: string): Promise<Candidate[]> {
  const query = informativeTerms(phrase, 8).join(" ");
  if (!query) return [];
  const data = await getJson(
    `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=3&fields=title,abstract,url,year,externalIds`,
    6500,
  );
  const papers: any[] = data?.data ?? [];
  return papers
    .filter((paper) => paper.abstract && paper.abstract.length > 80)
    .map((paper) => ({
      title: `${paper.title ?? "Scholarly paper"}${paper.year ? ` (${paper.year})` : ""}`,
      url: paper.url ?? (paper.externalIds?.DOI ? `https://doi.org/${paper.externalIds.DOI}` : undefined),
      text: [paper.title, paper.abstract].filter(Boolean).join(". "),
      kind: "Scholarly publication (abstract)",
      provider: "Semantic Scholar Graph API",
    }));
}

async function europePmcCandidates(phrase: string, includeFullText = false): Promise<Candidate[]> {
  const query = informativeTerms(phrase, 8).join(" ");
  if (!query) return [];
  const data = await getJson(
    `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=3&resultType=core`,
    6500,
  );
  const results: any[] = (data?.resultList?.result ?? [])
    .filter((item: any) => item.abstractText && item.abstractText.length > 80)
    .slice(0, 3);

  return mapLimit(results, includeFullText ? 2 : 3, async (item) => {
    let sourceText = [item.title, item.abstractText].filter(Boolean).join(". ");
    let kind = "Scholarly publication (abstract)";
    if (includeFullText && item.pmcid) {
      const fullXml = await getText(
        `https://www.ebi.ac.uk/europepmc/webservices/rest/${encodeURIComponent(item.pmcid)}/fullTextXML`,
        10000,
      );
      const body = fullXml?.match(/<body[\s\S]*?<\/body>/i)?.[0] ?? "";
      const extractedBody = body ? stripXmlText(body).slice(0, 120000) : "";
      if (extractedBody.length > sourceText.length + 500) {
        sourceText = extractedBody;
        kind = "Open-access full text (Europe PMC)";
      }
    }
    return {
      title: `${item.title ?? "Biomedical publication"}${item.pubYear ? ` (${item.pubYear})` : ""}`,
      url: item.doi ? `https://doi.org/${item.doi}` : item.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${item.pmid}/` : item.pmcid ? `https://europepmc.org/articles/${item.pmcid}` : undefined,
      text: sourceText,
      kind,
      provider: "Europe PMC REST API",
    };
  });
}

async function crossrefCandidates(phrase: string): Promise<Candidate[]> {
  const keywords = informativeTerms(phrase, 8).join(" ");
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

type ExcludedTextRange = { start: number; end: number; reason: "quotation" | "bibliography" };

function findExcludedRanges(text: string): { ranges: ExcludedTextRange[] } {
  const ranges: ExcludedTextRange[] = [];
  const quotePattern = /["“«「『]([^"”»」』]{20,3000})["”»」』]/gu;
  let quote: RegExpExecArray | null;
  while ((quote = quotePattern.exec(text)) !== null) {
    ranges.push({ start: quote.index, end: quote.index + quote[0].length, reason: "quotation" });
  }

  const bibliographyHeading = /^\s*(?:references|bibliography|works cited|literature cited|reference list)\s*:?\s*$/im;
  const heading = bibliographyHeading.exec(text);
  if (heading) ranges.push({ start: heading.index, end: text.length, reason: "bibliography" });

  ranges.sort((a, b) => a.start - b.start);
  const merged: ExcludedTextRange[] = [];
  for (const range of ranges) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
      if (range.reason === "bibliography") previous.reason = "bibliography";
    } else {
      merged.push({ ...range });
    }
  }
  return { ranges: merged };
}

async function detectPlagiarism(
  text: string,
  sentences: Sentence[],
  meta?: { title?: string | null; docType?: string | null }
) {
  const usable = sentences.filter((s) => s.words.length >= 8 && s.words.length <= 80);
  // Sample across the full document rather than relying only on the opening
  // paragraphs. This improves retrieval diversity without claiming exhaustive
  // crawling of the web or licensed academic databases.
  const target = Math.min(18, usable.length);
  const step = usable.length > target ? usable.length / target : 1;
  const candidates: Sentence[] = [];
  for (let i = 0; candidates.length < target && Math.floor(i * step) < usable.length; i++) {
    candidates.push(usable[Math.floor(i * step)]!);
  }

  const stopWords = new Set([
    "about", "above", "after", "again", "also", "among", "because", "been", "before",
    "being", "between", "could", "during", "each", "from", "have", "into", "more",
    "most", "other", "over", "same", "such", "than", "that", "their", "there",
    "these", "they", "this", "those", "through", "under", "very", "were", "which",
    "while", "will", "with", "would", "your", "using", "used", "paper", "study",
    "research", "results", "method", "methods", "analysis", "approach",
  ]);
  const frequency = new Map<string, number>();
  for (const word of tokenize(text)) {
    if (word.length >= 5 && !stopWords.has(word)) frequency.set(word, (frequency.get(word) ?? 0) + 1);
  }
  const topicalTerms = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
  const docKeywords = [meta?.title?.trim() ?? "", topicalTerms.join(" ")].filter(Boolean).join(" ");

  const cache: SourceCache = new Map();
  let queried = 0;
  const [docWiki, docAlex, docCross, docSemantic, docEuropePmc] = await Promise.all([
    wikipediaCandidates(docKeywords, cache),
    openAlexCandidates(docKeywords),
    crossrefCandidates(docKeywords),
    semanticScholarCandidates(docKeywords),
    europePmcCandidates(docKeywords, true),
  ]);
  const docPool = [...docWiki, ...docAlex, ...docCross, ...docSemantic, ...docEuropePmc];
  queried += docPool.length;

  await mapLimit(candidates, 3, async (sentence) => {
    const [wiki, alex, cross, semantic, europePmc] = await Promise.all([
      wikipediaCandidates(sentence.text, cache),
      openAlexCandidates(sentence.text),
      crossrefCandidates(sentence.text),
      semanticScholarCandidates(sentence.text),
      europePmcCandidates(sentence.text),
    ]);
    docPool.push(...wiki, ...alex, ...cross, ...semantic, ...europePmc);
    queried += wiki.length + alex.length + cross.length + semantic.length + europePmc.length;
  });

  const poolMap = new Map<string, Candidate>();
  for (const candidate of docPool) {
    const key = candidate.url?.replace(/\/$/, "").toLowerCase() ?? candidate.title.toLowerCase();
    const previous = poolMap.get(key);
    // Prefer the candidate with the longer text when providers return the same
    // record more than once.
    if (!previous || candidate.text.length > previous.text.length) poolMap.set(key, candidate);
  }
  const uniquePool = [...poolMap.values()];
  const excluded = findExcludedRanges(text);
  const compared = matchDocumentAgainstSources(text, uniquePool, { excludedRanges: excluded.ranges });
  const countWords = (reason: ExcludedTextRange["reason"]) => tokenize(
    excluded.ranges.filter((range) => range.reason === reason)
      .map((range) => text.slice(range.start, range.end)).join(" "),
  ).length;
  const excludedQuotedWords = countWords("quotation");
  const excludedBibliographyWords = countWords("bibliography");
  const comparisonWords = Math.max(0, tokenize(text).length - excludedQuotedWords - excludedBibliographyWords);

  return {
    ...compared,
    queried,
    source_coverage: {
      sources_retrieved: uniquePool.length,
      providers: [...new Set(uniquePool.map((source) => source.provider ?? "Unknown provider"))],
      matching_method: "Normalized exact word-sequence matching; minimum 8 consecutive words",
      comparison_words: comparisonWords,
      excluded_quoted_words: excludedQuotedWords,
      excluded_bibliography_words: excludedBibliographyWords,
      limitation: "Compared only text returned by the listed public providers. Detected quoted passages and the detected reference-list section are excluded. In-text citation context is not automatically excluded. These providers do not include a complete web archive, licensed publisher full text, or private student-paper repository. Paraphrased reuse and sources not retrieved may not be detected.",
    },
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
  const limit = 10000;
  for (let i = 0; i < text.length; i += limit) {
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

  // Use local fallback rules only when the external service failed for every
  // chunk. A successful zero-issue response is a real zero, not a reason to
  // manufacture heuristic warnings.
  if (ok === 0) {
    const heuristic = heuristicGrammarCheck(text, author, title);
    provider = "PlagiShield local fallback (LanguageTool unavailable)";
    issues.push(...heuristic.issues);
    highlights.push(...heuristic.highlights);
  }

  return { score: null, provider, issues: issues.slice(0, 80), highlights: highlights.slice(0, 120) };
}

function chunk_slice(text: string, offset: number, length: number) {
  if (!Number.isFinite(offset) || !Number.isFinite(length)) return "";
  return text.slice(offset, offset + Math.max(1, length)).trim();
}

/* -------------------------------------------- 4. citation verification */

function extractReferences(text: string) {
  const lines = text.split(/\n+/).map((l) => l.trim());
  const refIndex = lines.findIndex((l) => /^(references|bibliography|works cited|literature cited|reference list)\b/i.test(l));
  const pool = refIndex >= 0 ? lines.slice(refIndex + 1) : [];
  const refs = pool
    .filter((l) => l.length > 40 && /\(?(19|20)\d{2}\)?/.test(l) && /[A-Z][a-z]+/.test(l))
    .map((l) => l.replace(/^\[\d+\]\s*/, "").replace(/^\d+\.\s*/, ""))
    .slice(0, 50);
  const inText = (text.match(/\((?:[A-Z][A-Za-z\-']+(?:\s+(?:et al\.?|and|&)\s+[A-Z][A-Za-z\-']+)?,\s*(?:19|20)\d{2}[a-z]?)\)|\[\d{1,3}\]/g) ?? []).length;
  return { refs, inText, hasSection: refIndex >= 0 };
}

function extractTitleFromRef(raw: string): string {
  const quoted = raw.match(/["“]([^"”]+)["”]/);
  if (quoted && quoted[1].length > 10) return quoted[1].trim();

  // APA-style references usually place the title immediately after the year.
  const afterYear = raw.match(/\(?(?:19|20)\d{2}[a-z]?\)?\.\s+([^.!?]{12,300})/i);
  if (afterYear?.[1]) return afterYear[1].trim();

  const parts = raw.split(/[.,]/).map((part) => part.trim()).filter((part) => part.length > 15);
  return parts.length > 1 ? parts[1]! : parts[0] || raw;
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
      if (titleSimilarity(extractedTitle, itTitle) >= 0.85) {
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
        if (titleSimilarity(extractedTitle, wTitle) >= 0.85) {
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

  if (refs.length === 0) {
    issues.push("No reference-list entries were detected; reference verification was not assessed.");
  }
  if (inText === 0 && refs.length > 0) {
    issues.push("Reference list detected, but no supported in-text citation pattern was found.");
  }

  const verified = references.filter((r) => r.verified).length;
  const score = refs.length > 0 ? Math.round((verified / refs.length) * 100) : null;

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
  const [plag, grammar, citations] = await Promise.all([
    detectPlagiarism(text, sentences, { title: meta.title, docType: meta.docType }),
    checkGrammar(text, meta.author, meta.title),
    verifyCitations(text),
  ]);

  await stage("scoring");
  const totalWords = words.length || 1;
  const matchedWords = Math.min(totalWords, plag.matched_words);
  const unmatchedWords = Math.max(0, totalWords - matchedWords);
  const pct = (count: number) => Number(((count / totalWords) * 100).toFixed(1));

  // Only measurable document categories are shown. No estimated AI share or
  // invented "human-written" residual is inferred from unmatched text.
  const composition: CompositionSlice[] = [
    { category: "Observed source overlap", percent: pct(matchedWords), words: matchedWords },
    { category: "No match found in retrieved sources", percent: pct(unmatchedWords), words: unmatchedWords },
  ];

  await stage("rendering");
  const aiReasoning = "AI authorship scoring is not reported. This deployment has no independently validated detector and representative benchmark dataset; stylistic patterns alone cannot establish authorship.";
  const aiHl: Highlight[] = [];

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
    // Preserve the complete extracted text (up to the 120k ingestion limit).
    // PDF and on-screen highlights use offsets into this exact string.
    text_excerpt: text,
    plagiarism: {
      score: plag.score,
      matched_words: plag.matched_words,
      matches: plag.matches,
      highlights: plag.highlights,
      source_coverage: plag.source_coverage,
    },
    ai_detection: {
      score: null,
      confidence: "not_assessed",
      reasoning: aiReasoning,
      model_score: null,
      stylometry_score: null,
      features: {},
      highlights: aiHl,
    },
    grammar,
    citations,
    composition,
    issues,
  };
}
