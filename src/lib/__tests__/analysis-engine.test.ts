/* eslint-disable no-control-regex */
import { describe, expect, it } from "bun:test";

describe("Sanitization & Postgres Safety", () => {
  it("strips null bytes and control characters to prevent Postgres 22P05 error", () => {
    const raw =
      "Sample \0text \u0000with \x00null \x08bytes \x1Fand control chars\nValid newline\tValid tab";
    const sanitized = raw
      .replace(/\0/g, "")
      .replace(/\u0000/g, "")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ");
    expect(sanitized.includes("\0")).toBe(false);
    expect(sanitized.includes("\u0000")).toBe(false);
    expect(sanitized).toContain("Sample text with null  bytes  and control chars");
    expect(sanitized).toContain("\nValid newline");
    expect(sanitized).toContain("\tValid tab");
  });
});

describe("Similarity Scoring Logic", () => {
  function tokenize(text: string): string[] {
    return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  }

  function ngrams(words: string[], n: number): Set<string> {
    const set = new Set<string>();
    for (let i = 0; i <= words.length - n; i++) {
      set.add(words.slice(i, i + n).join(" "));
    }
    return set;
  }

  function matchScore(sWords: string[], srcWords: string[], n = 4): number {
    if (sWords.length < n || srcWords.length < n) return 0;
    const srcGrams = ngrams(srcWords, n);
    if (srcGrams.size === 0) return 0;
    let hit = 0;
    let total = 0;
    for (let i = 0; i <= sWords.length - n; i++) {
      total++;
      if (srcGrams.has(sWords.slice(i, i + n).join(" "))) hit++;
    }
    return total > 0 ? (hit / total) * 100 : 0;
  }

  it("calculates 100% match for identical texts with at least 4 words", () => {
    const text = "The quick brown fox jumps over the lazy dog";
    const words = tokenize(text);
    const score = matchScore(words, words, 4);
    expect(score).toBe(100);
  });

  it("calculates 0% match for completely distinct texts", () => {
    const textA = "Photosynthesis occurs in plant cells containing chloroplasts";
    const textB = "Quantum computing relies on superposition and quantum entanglement";
    const score = matchScore(tokenize(textA), tokenize(textB), 4);
    expect(score).toBe(0);
  });

  it("calculates Turnitin-standard matched word ratio", () => {
    const totalDocWords = 100;
    const matchedWords = 25;
    const similarityScore = Math.min(100, Math.round((matchedWords / totalDocWords) * 100));
    expect(similarityScore).toBe(25);
  });
});

describe("PDF Stream Regex Boundary Safety", () => {
  it("does not match 'endstream' when searching for 'stream'", () => {
    const streamRe = /(?<!end)stream\r?\n/g;
    const sample = "stream\n1 2 3\nendstream\nstream\r\n4 5 6\nendstream";
    const matches = [...sample.matchAll(streamRe)];
    expect(matches.length).toBe(2);
    for (const m of matches) {
      expect(m[0].toLowerCase().startsWith("stream")).toBe(true);
      expect(m[0].toLowerCase().includes("endstream")).toBe(false);
    }
  });
});
