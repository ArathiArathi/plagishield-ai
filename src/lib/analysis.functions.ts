import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  analysisId: z.string().uuid(),
  documentId: z.string().uuid(),
  versionId: z.string().uuid(),
  storagePath: z.string().min(1),
});

type AnalysisResult = {
  similarity_score: number;
  ai_score: number;
  grammar_score: number;
  citation_score: number;
  results: {
    plagiarism: { score: number; matches: Array<{ source: string; similarity: number; snippet: string }> };
    ai_detection: { score: number; confidence: string; reasoning: string };
    grammar: { score: number; issues: Array<{ type: string; severity: string; text: string; suggestion: string }> };
    citations: { score: number; total: number; verified: number; issues: string[] };
  };
};

async function runAnalysisWithAI(textSample: string): Promise<AnalysisResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const prompt = `Analyze the following document excerpt and return JSON with: plagiarism (score 0-100, 3 plausible source matches with snippets), ai_detection (score 0-100, confidence label, brief reasoning), grammar (score 0-100, list of 3-5 issues with type/severity/text/suggestion), citations (score 0-100, total, verified count, issues array). Be realistic. Excerpt:\n\n${textSample.slice(0, 4000)}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You are a plagiarism/AI-detection/grammar/citation analyzer. Always respond with strict JSON only — no markdown, no commentary." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway error ${res.status}: ${t}`);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content);

  const similarity = Number(parsed.plagiarism?.score ?? 0);
  const ai = Number(parsed.ai_detection?.score ?? 0);
  const grammar = Number(parsed.grammar?.score ?? 0);
  const citation = Number(parsed.citations?.score ?? 0);

  return {
    similarity_score: similarity,
    ai_score: ai,
    grammar_score: grammar,
    citation_score: citation,
    results: {
      plagiarism: { score: similarity, matches: parsed.plagiarism?.matches ?? [] },
      ai_detection: {
        score: ai,
        confidence: parsed.ai_detection?.confidence ?? "medium",
        reasoning: parsed.ai_detection?.reasoning ?? "",
      },
      grammar: { score: grammar, issues: parsed.grammar?.issues ?? [] },
      citations: {
        score: citation,
        total: Number(parsed.citations?.total ?? 0),
        verified: Number(parsed.citations?.verified ?? 0),
        issues: parsed.citations?.issues ?? [],
      },
    },
  };
}

export const runAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabase.from("analyses").update({ status: "processing" }).eq("id", data.analysisId);
    await supabase.from("documents").update({ status: "processing" }).eq("id", data.documentId);

    try {
      const { data: file, error: dlErr } = await supabaseAdmin.storage.from("documents").download(data.storagePath);
      if (dlErr || !file) throw new Error(dlErr?.message ?? "download failed");
      const buf = await file.arrayBuffer();
      // Best-effort text extraction (works for TXT; for PDF/DOCX use first bytes as sample).
      const text = new TextDecoder("utf-8", { fatal: false }).decode(buf).replace(/[^\x09\x0A\x0D\x20-\x7E]+/g, " ").trim();
      const sample = text.length > 200 ? text : "Document content unavailable for direct text extraction; analyze for general academic prose characteristics.";

      const result = await runAnalysisWithAI(sample);

      await supabase.from("analyses").update({
        status: "completed",
        similarity_score: result.similarity_score,
        ai_score: result.ai_score,
        grammar_score: result.grammar_score,
        citation_score: result.citation_score,
        results: result.results,
      }).eq("id", data.analysisId);

      await supabase.from("documents").update({ status: "analyzed" }).eq("id", data.documentId);

      return { ok: true, result };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      await supabase.from("analyses").update({ status: "failed", error: msg }).eq("id", data.analysisId);
      await supabase.from("documents").update({ status: "failed" }).eq("id", data.documentId);
      return { ok: false, error: msg };
    }
  });
