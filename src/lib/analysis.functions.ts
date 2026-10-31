import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  analysisId: z.string().uuid(),
  documentId: z.string().uuid(),
  versionId: z.string().uuid(),
  storagePath: z.string().min(1),
});

type Ctx = { supabase: any; userId: string };

async function execute(
  context: Ctx,
  data: { analysisId: string; documentId: string; versionId: string; storagePath: string },
) {
  const { supabase } = context;
  const { analyzeDocument } = await import("@/lib/analysis-engine.server");
  const { extractText } = await import("@/lib/text-extract.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const STAGE_PCT: Record<string, number> = {
    extracting: 15,
    retrieving: 45,
    scoring: 75,
    rendering: 90,
  };
  const setStage = async (stage: string) => {
    const { error } = await supabase
      .from("analyses")
      .update({ stage, stage_pct: STAGE_PCT[stage] ?? 0 })
      .eq("id", data.analysisId);
    if (error) throw error;
  };

  try {
    const { error: analysisUpdateError } = await supabase
      .from("analyses")
      .update({ status: "processing", error: null, stage: "extracting", stage_pct: STAGE_PCT.extracting })
      .eq("id", data.analysisId);
    if (analysisUpdateError) throw analysisUpdateError;

    const { error: documentUpdateError } = await supabase
      .from("documents")
      .update({ status: "processing" })
      .eq("id", data.documentId);
    if (documentUpdateError) throw documentUpdateError;

    const { data: doc } = await supabase
      .from("documents")
      .select("name,doc_type,author_name,paper_title")
      .eq("id", data.documentId)
      .single();

    const { data: file, error: dlErr } = await supabaseAdmin.storage.from("documents").download(data.storagePath);
    if (dlErr || !file) throw new Error(dlErr?.message ?? "Stored file could not be downloaded");

    const buf = await file.arrayBuffer();
    const { text, method } = await extractText(buf, doc?.name ?? data.storagePath);
    if (text.replace(/\s+/g, " ").trim().length < 200) {
      throw new Error(
        "Not enough readable text could be extracted from this file. Upload a text-based PDF, DOCX, TXT or MD file (scanned images are not supported).",
      );
    }

    const result = await analyzeDocument(text, {
      extraction: method,
      docType: doc?.doc_type ?? "other",
      title: doc?.paper_title ?? null,
      author: doc?.author_name ?? null,
      onStage: (stage) => setStage(stage),
    });


    const { error: analysisSaveError } = await supabase
      .from("analyses")
      .update({
        status: "completed",
        similarity_score: result.plagiarism.score,
        ai_score: result.ai_detection.score,
        grammar_score: result.grammar.score,
        citation_score: result.citations.score,
        results: result,
        error: null,
        stage: "completed",
        stage_pct: 100,
      })
      .eq("id", data.analysisId);
    if (analysisSaveError) throw analysisSaveError;

    const { error: documentSaveError } = await supabase
      .from("documents")
      .update({ status: "analyzed" })
      .eq("id", data.documentId);
    if (documentSaveError) throw documentSaveError;
    return { ok: true as const, analysisId: data.analysisId };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Analysis failed";
    await supabase.from("analyses").update({ status: "failed", error: msg, stage: "failed" }).eq("id", data.analysisId);

    await supabase.from("documents").update({ status: "failed" }).eq("id", data.documentId);
    return { ok: false as const, error: msg };
  }
}

/** Run (or re-run) the analysis for a specific version — used by "Re-analyze". */
export const runAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => execute(context as unknown as Ctx, data));

/**
 * Queue driver. Starts the oldest pending analysis only when nothing else is
 * currently processing for this user, so uploads are analysed strictly one at
 * a time and never stall behind an abandoned job.
 */
export const processQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    const { supabase } = ctx;

    const { data: processing, error: processingError } = await supabase
      .from("analyses")
      .select("id,document_id,updated_at")
      .eq("status", "processing")
      .order("updated_at", { ascending: true });
    if (processingError) throw processingError;

    const STALE_MS = 6 * 60 * 1000;
    const active = (processing ?? []).filter(
      (a: { updated_at: string }) => Date.now() - new Date(a.updated_at).getTime() < STALE_MS,
    );
    const stale = (processing ?? []).filter(
      (a: { updated_at: string }) => Date.now() - new Date(a.updated_at).getTime() >= STALE_MS,
    );
    for (const s of stale) {
      const { error: staleAnalysisError } = await supabase
        .from("analyses")
        .update({ status: "failed", error: "Analysis timed out — please re-run.", stage: "failed" })
        .eq("id", s.id);
      if (staleAnalysisError) throw staleAnalysisError;

      const { error: staleDocumentError } = await supabase
        .from("documents")
        .update({ status: "failed" })
        .eq("id", s.document_id);
      if (staleDocumentError) throw staleDocumentError;
    }

    if (active.length > 0) {
      return { started: false as const, reason: "busy" as const, activeId: active[0]!.id };
    }

    const { data: pending, error: pendingError } = await supabase
      .from("analyses")
      .select("id,document_id,version_id")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1);
    if (pendingError) throw pendingError;

    const next = pending?.[0];
    if (!next) return { started: false as const, reason: "empty" as const };

    const { data: version, error: versionError } = await supabase
      .from("document_versions")
      .select("storage_path")
      .eq("id", next.version_id)
      .maybeSingle();
    if (versionError) throw versionError;

    if (!version?.storage_path) {
      const { error: failedAnalysisError } = await supabase
        .from("analyses")
        .update({ status: "failed", error: "Stored file missing for this version", stage: "failed" })
        .eq("id", next.id);
      if (failedAnalysisError) throw failedAnalysisError;
      const { error: failedDocumentError } = await supabase
        .from("documents")
        .update({ status: "failed" })
        .eq("id", next.document_id);
      if (failedDocumentError) throw failedDocumentError;
      return {
        started: true as const,
        ok: false as const,
        error: "Stored file missing for this version",
      };
    }

    const { data: claimed, error: claimError } = await supabase
      .from("analyses")
      .update({ status: "processing", error: null, stage: "extracting", stage_pct: 15 })
      .eq("id", next.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return { started: false as const, reason: "claimed" as const };

    const res = await execute(ctx, {
      analysisId: next.id,
      documentId: next.document_id,
      versionId: next.version_id,
      storagePath: version.storage_path,
    });

    return { started: true as const, ...res };
  });
