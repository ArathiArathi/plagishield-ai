import test from "node:test";
import assert from "node:assert/strict";
import { matchDocumentAgainstSources } from "../src/lib/similarity-matcher.server.ts";
import { buildSegments } from "../src/components/analysis/analysis-shared.ts";

const phrase = "The proposed framework combines secure key management with mutual authentication across distributed services";
const source = {
  title: "A source about secure distributed services",
  url: "https://example.org/research/security",
  kind: "Scholarly publication",
  provider: "Test fixture",
  text: phrase,
};

test("detects an exact contiguous phrase and returns original offsets", () => {
  const result = matchDocumentAgainstSources(phrase, [source]);
  assert.equal(result.score, 100);
  assert.equal(result.matched_words, 13);
  assert.equal(result.highlights.length, 1);
  assert.equal(result.highlights[0].start, 0);
  assert.equal(result.highlights[0].end, phrase.length);
  assert.equal(result.highlights[0].text, phrase);
  assert.equal(result.highlights[0].matched_snippet, phrase);
});

test("excludes clearly quoted passages and a recognised references section", () => {
  const document = `This paper adopts ${phrase}. “${phrase}”.\n\nReferences\n${phrase}.`;
  const result = matchDocumentAgainstSources(document, [source]);
  assert.equal(result.matched_words, 13);
  assert.equal(result.excluded_words, 26);
  assert.equal(result.eligible_words, 16);
  assert.equal(result.score, 81);
  assert.equal(result.highlights.length, 1);
  assert.ok(document.slice(result.highlights[0].start, result.highlights[0].end).includes(phrase));
});

test("does not double-count the same document words across overlapping sources", () => {
  const result = matchDocumentAgainstSources(phrase, [
    source,
    { ...source, title: "Another index record", url: "https://example.net/paper" },
  ]);
  assert.equal(result.matches.length, 2);
  assert.equal(result.matched_words, 13);
  assert.equal(result.score, 100);
  assert.equal(result.highlights.length, 1);
  assert.equal(result.highlights[0].alternate_sources.length, 1);
});

test("does not report short or non-matching text as a source match", () => {
  const result = matchDocumentAgainstSources(
    "A completely different paragraph describes unrelated database operations and storage engines",
    [source],
  );
  assert.equal(result.score, 0);
  assert.equal(result.matched_words, 0);
  assert.equal(result.matches.length, 0);
  assert.equal(result.highlights.length, 0);
});

test("keeps every character and resolves overlapping highlights without dropping text", () => {
  const text = "0123456789abcdef";
  const highlights = [
    { start: 2, end: 10, text: text.slice(2, 10), category: "plagiarism", score: 100 },
    { start: 6, end: 14, text: text.slice(6, 14), category: "grammar", score: 80 },
  ];
  const segments = buildSegments(text, highlights);
  assert.equal(segments.map((segment) => segment.text).join(""), text);
  assert.equal(segments.find((segment) => segment.highlight?.category === "plagiarism")?.text, "23456789");
  assert.equal(segments.find((segment) => segment.highlight?.category === "grammar")?.text, "abcd");
});
