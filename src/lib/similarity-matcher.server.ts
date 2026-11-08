/**
 * Evidence-first document matcher.
 *
 * Only exact, contiguous word sequences are reported. Every returned highlight
 * carries offsets into the original extracted submission and the exact source
 * passage used to establish the match. Quoted text and the bibliography are
 * excluded from the comparison denominator by default.
 */

export type MatchSource = {
  title: string;
  url?: string;
  text: string;
  kind: string;
  provider?: string;
};

export type MatchHighlight = {
  start: number;
  end: number;
  text: string;
  category: "plagiarism";
  score: number;
  source: string;
  url?: string;
  note: string;
  matched_snippet: string;
  provider?: string;
  confidence: "high" | "medium" | "low";
  alternate_sources?: Array<{ source: string; url?: string; type: string }>;
};

export type SourceMatch = {
  source: string;
  url?: string;
  similarity: number;
  snippet: string;
  type: string;
  matched_snippet?: string;
  provider?: string;
  matched_words: number;
  match_count: number;
  match_strength: number;
  domain?: string;
};

type Token = { value: string; start: number; end: number };
type Span = { first: number; last: number; sourceFirst: number; sourceLast: number };
type Range = { start: number; end: number };

const SHINGLE_SIZE = 8;
const MIN_MATCH_WORDS = 8;

function normalizedWord(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en");
}

function tokensWithOffsets(text: string): Token[] {
  const out: Token[] = [];
  const re = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    out.push({
      value: normalizedWord(match[0].replace(/’/g, "'")),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return out;
}

function shingle(words: Token[], start: number, size: number): string {
  return words.slice(start, start + size).map((word) => word.value).join(" ");
}

function buildSourceIndex(words: Token[], size: number): Map<string, number[]> {
  const index = new Map<string, number[]>();
  for (let i = 0; i + size <= words.length; i++) {
    const key = shingle(words, i, size);
    const positions = index.get(key);
    if (positions) {
      if (positions.length < 40) positions.push(i);
    } else {
      index.set(key, [i]);
    }
  }
  return index;
}

function mergeSpans(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.first - b.first || b.last - a.last);
  const merged: Span[] = [];
  for (const span of sorted) {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      span.first <= previous.last + 1 &&
      span.sourceFirst - span.first === previous.sourceFirst - previous.first
    ) {
      if (span.last > previous.last) {
        previous.last = span.last;
        previous.sourceLast = span.sourceLast;
      }
    } else {
      merged.push({ ...span });
    }
  }
  return merged;
}

function findExactSpans(
  documentWords: Token[],
  sourceWords: Token[],
  sourceIndex: Map<string, number[]>,
  excludedRanges: Range[],
): Span[] {
  const spans: Span[] = [];
  for (let docAt = 0; docAt + SHINGLE_SIZE <= documentWords.length; docAt++) {
    const firstToken = documentWords[docAt]!;
    const lastToken = documentWords[docAt + SHINGLE_SIZE - 1]!;
    if (excludedRanges.some((range) => firstToken.start < range.end && lastToken.end > range.start)) continue;

    const positions = sourceIndex.get(shingle(documentWords, docAt, SHINGLE_SIZE));
    if (!positions) continue;

    for (const sourceAt of positions) {
      if (
        docAt > 0 &&
        sourceAt > 0 &&
        shingle(documentWords, docAt - 1, SHINGLE_SIZE) === shingle(sourceWords, sourceAt - 1, SHINGLE_SIZE)
      ) continue;

      let length = SHINGLE_SIZE;
      while (
        docAt + length < documentWords.length &&
        sourceAt + length < sourceWords.length &&
        documentWords[docAt + length]!.value === sourceWords[sourceAt + length]!.value
      ) {
        const token = documentWords[docAt + length]!;
        if (excludedRanges.some((range) => token.start < range.end && token.end > range.start)) break;
        length++;
      }

      if (length >= MIN_MATCH_WORDS) {
        spans.push({
          first: docAt,
          last: docAt + length - 1,
          sourceFirst: sourceAt,
          sourceLast: sourceAt + length - 1,
        });
      }
    }
  }
  return mergeSpans(spans);
}

function documentExclusions(text: string): Range[] {
  const ranges: Range[] = [];

  // A bibliography is excluded only when a recognised heading occupies its own
  // line. This avoids stopping at an ordinary sentence mentioning references.
  const referenceHeading = /^\s*(?:\d+(?:\.\d+)*\s+)?(?:references|bibliography|works cited|literature cited|reference list)\s*:?[ \t]*$/gim;
  const heading = referenceHeading.exec(text);
  if (heading) ranges.push({ start: heading.index, end: text.length });

  // Exclude clearly delimited quotations. Single straight quotes are omitted
  // because apostrophes and contractions make them ambiguous.
  const quotePatterns = [
    /“[^”]{1,10000}”/g,
    /"[^"]{1,10000}"/g,
    /«[^»]{1,10000}»/g,
    /„[^“]{1,10000}“/g,
    /‘[^’]{1,10000}’/g,
  ];
  for (const pattern of quotePatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
    }
  }

  // Markdown / block-quoted passages are also clearly marked quotations.
  const blockQuote = /^\s*>[^\n]+/gm;
  let block: RegExpExecArray | null;
  while ((block = blockQuote.exec(text)) !== null) {
    ranges.push({ start: block.index, end: block.index + block[0].length });
  }

  return ranges.sort((a, b) => a.start - b.start);
}

function isExcluded(token: Token, ranges: Range[]): boolean {
  return ranges.some((range) => token.start < range.end && token.end > range.start);
}

function unionWordCount(spans: Array<{ first: number; last: number }>): number {
  const sorted = [...spans].sort((a, b) => a.first - b.first);
  let total = 0;
  let start = -1;
  let end = -1;
  for (const span of sorted) {
    if (start < 0) {
      start = span.first;
      end = span.last;
    } else if (span.first <= end + 1) {
      end = Math.max(end, span.last);
    } else {
      total += end - start + 1;
      start = span.first;
      end = span.last;
    }
  }
  return start < 0 ? 0 : total + end - start + 1;
}

function domainFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

export function matchDocumentAgainstSources(
  text: string,
  sources: MatchSource[],
): {
  score: number;
  matched_words: number;
  eligible_words: number;
  excluded_words: number;
  matches: SourceMatch[];
  highlights: MatchHighlight[];
} {
  const documentWords = tokensWithOffsets(text);
  const exclusions = documentExclusions(text);
  const eligibleWords = documentWords.filter((word) => !isExcluded(word, exclusions)).length;
  const excludedWords = documentWords.length - eligibleWords;

  if (eligibleWords < MIN_MATCH_WORDS || sources.length === 0) {
    return {
      score: 0,
      matched_words: 0,
      eligible_words: eligibleWords,
      excluded_words: excludedWords,
      matches: [],
      highlights: [],
    };
  }

  const sourceEvidence = sources.map((source) => {
    const sourceWords = tokensWithOffsets(source.text);
    const index = buildSourceIndex(sourceWords, SHINGLE_SIZE);
    const spans = findExactSpans(documentWords, sourceWords, index, exclusions);
    return { source, sourceWords, spans, matchedWords: unionWordCount(spans) };
  }).filter((entry) => entry.matchedWords >= MIN_MATCH_WORDS);

  const documentCoverage = unionWordCount(
    sourceEvidence.flatMap((entry) => entry.spans.map((span) => ({ first: span.first, last: span.last }))),
  );
  const score = Math.min(100, Math.round((documentCoverage / eligibleWords) * 100));

  const matches: SourceMatch[] = sourceEvidence.map((entry) => {
    const first = entry.spans[0]!;
    const documentSnippet = text.slice(
      documentWords[first.first]!.start,
      documentWords[first.last]!.end,
    );
    const sourceSnippet = entry.source.text.slice(
      entry.sourceWords[first.sourceFirst]!.start,
      entry.sourceWords[first.sourceLast]!.end,
    );
    return {
      source: entry.source.title,
      url: entry.source.url,
      similarity: Number(((entry.matchedWords / eligibleWords) * 100).toFixed(1)),
      snippet: documentSnippet.slice(0, 600),
      type: entry.source.kind,
      matched_snippet: sourceSnippet.slice(0, 600),
      provider: entry.source.provider,
      matched_words: entry.matchedWords,
      match_count: entry.spans.length,
      match_strength: 100,
      domain: domainFromUrl(entry.source.url),
    };
  }).sort((a, b) => b.matched_words - a.matched_words);

  const highlights: MatchHighlight[] = [];
  for (const entry of sourceEvidence) {
    for (const span of entry.spans) {
      const start = documentWords[span.first]!.start;
      const end = documentWords[span.last]!.end;
      const overlapping = sourceEvidence
        .filter((other) => other !== entry && other.spans.some(
          (candidate) => candidate.first <= span.last && candidate.last >= span.first,
        ))
        .sort((a, b) => b.matchedWords - a.matchedWords)
        .slice(0, 5)
        .map((other) => ({
          source: other.source.title,
          url: other.source.url,
          type: other.source.kind,
        }));
      highlights.push({
        start,
        end,
        text: text.slice(start, end),
        category: "plagiarism",
        score: 100,
        source: entry.source.title,
        url: entry.source.url,
        note: entry.source.kind,
        matched_snippet: entry.source.text.slice(
          entry.sourceWords[span.sourceFirst]!.start,
          entry.sourceWords[span.sourceLast]!.end,
        ).slice(0, 600),
        provider: entry.source.provider,
        confidence: "high",
        alternate_sources: overlapping,
      });
    }
  }

  const primaryBySpan = new Map<string, MatchHighlight>();
  for (const highlight of highlights) {
    const key = `${highlight.start}:${highlight.end}`;
    const previous = primaryBySpan.get(key);
    if (!previous) primaryBySpan.set(key, highlight);
    else {
      previous.alternate_sources = [
        ...(previous.alternate_sources ?? []),
        { source: highlight.source, url: highlight.url, type: highlight.note },
        ...(highlight.alternate_sources ?? []),
      ].slice(0, 5);
    }
  }

  return {
    score,
    matched_words: documentCoverage,
    eligible_words: eligibleWords,
    excluded_words: excludedWords,
    matches,
    highlights: [...primaryBySpan.values()].sort((a, b) => a.start - b.start),
  };
}
