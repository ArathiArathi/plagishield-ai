import test from "node:test";
import assert from "node:assert/strict";
import { matchDocumentAgainstSources } from "../src/lib/similarity-matcher.server.ts";

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
