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

const STAGE_PCT: Record<string, number> = {
  extracting: 15,
  retrieving: 45,
  scoring: 75,
  rendering: 90,
};

async function execute(
  context: Ctx,
  data: { analysisId: string; documentId: string; versionId: string; storagePath: string },
) {
  const { analyzeDocument } = await import("@/lib/analysis-engine.server");
  const { extractText } = await import("@/lib/text-extract.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Track progress in results JSON so it doesn't fail on tables without separate stage columns
  const setStage = async (stage: string) => {
    try {
      await supabaseAdmin
        .from("analyses")
        .update({
          updated_at: new Date().toISOString(),
          results: { stage, stage_pct: STAGE_PCT[stage] ?? 0 },
        })
        .eq("id", data.analysisId);
    } catch {
      // Progress reporting must not interrupt the analysis pipeline
    }
  };

  try {
    // 1. Mark analysis & document as processing
    const { error: analysisUpdateError } = await supabaseAdmin
      .from("analyses")
      .update({
        status: "processing",
        error: null,
        updated_at: new Date().toISOString(),
        results: { stage: "extracting", stage_pct: STAGE_PCT.extracting },
      })
      .eq("id", data.analysisId);
    if (analysisUpdateError) throw analysisUpdateError;

    const { error: documentUpdateError } = await supabaseAdmin
      .from("documents")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", data.documentId);
    if (documentUpdateError) throw documentUpdateError;

    // 2. Fetch document metadata
    const { data: doc } = await supabaseAdmin
      .from("documents")
      .select("name,doc_type,author_name,paper_title")
      .eq("id", data.documentId)
      .single();

    // 3. Download uploaded file from private storage
    const { data: file, error: dlErr } = await supabaseAdmin.storage
      .from("documents")
      .download(data.storagePath);
    if (dlErr || !file) throw new Error(dlErr?.message ?? "Stored file could not be downloaded");

    const buf = await file.arrayBuffer();
    const { text, method } = await extractText(buf, doc?.name ?? data.storagePath);

    if (text.replace(/\s+/g, " ").trim().length < 50) {
      throw new Error(
        "Not enough readable text could be extracted from this file. Upload a text-based PDF, DOCX, TXT or MD file (scanned images are not supported).",
      );
    }

    // 4. Run the multi-dimensional analysis engine
    const result = await analyzeDocument(text, {
      extraction: method,
      docType: doc?.doc_type ?? "other",
      title: doc?.paper_title ?? null,
      author: doc?.author_name ?? null,
      onStage: (stage) => setStage(stage),
    });

function sanitizeForPostgres<T>(val: T): T {
  if (typeof val === "string") {
    return val.replace(/\0/g, "").replace(/\u0000/g, "") as unknown as T;
  }
  if (Array.isArray(val)) {
    return val.map((v) => sanitizeForPostgres(v)) as unknown as T;
  }
  if (val !== null && typeof val === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = sanitizeForPostgres(v);
    }
    return out as unknown as T;
  }
  return val;
}

    // 5. Save completed results
    const cleanResults = sanitizeForPostgres({
      ...result,
      stage: "completed",
      stage_pct: 100,
    });

    const { error: analysisSaveError } = await supabaseAdmin
      .from("analyses")
      .update({
        status: "completed",
        similarity_score: result.plagiarism.score,
        ai_score: result.ai_detection.score,
        grammar_score: result.grammar.score,
        citation_score: result.citations.score,
        results: cleanResults,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.analysisId);
    if (analysisSaveError) throw analysisSaveError;

    const { error: documentSaveError } = await supabaseAdmin
      .from("documents")
      .update({ status: "analyzed", updated_at: new Date().toISOString() })
      .eq("id", data.documentId);
    if (documentSaveError) throw documentSaveError;

    return { ok: true as const, analysisId: data.analysisId };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Analysis failed";
    console.error(`[Analysis Worker] Error analyzing document ${data.documentId}:`, msg);

    try {
      await supabaseAdmin
        .from("analyses")
        .update({
          status: "failed",
          error: msg,
          results: { stage: "failed", error: msg },
        })
        .eq("id", data.analysisId);

      await supabaseAdmin
        .from("documents")
        .update({ status: "failed" })
        .eq("id", data.documentId);
    } catch (saveErr) {
      console.error("[Analysis Worker] Failed updating error status:", saveErr);
    }

    return { ok: false as const, error: msg };
  }
}

/** Run (or re-run) the analysis for a specific version — used by "Re-analyze". */
export const runAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => InputSchema.parse(input))
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Check for running analyses for this user
    const { data: processing, error: processingError } = await supabaseAdmin
      .from("analyses")
      .select("id,document_id,updated_at,documents!inner(owner_id)")
      .eq("status", "processing")
      .eq("documents.owner_id", ctx.userId)
      .order("updated_at", { ascending: true });
    if (processingError) throw processingError;

    const STALE_MS = 6 * 60 * 1000; // 6 minutes
    const now = Date.now();

    const active = (processing ?? []).filter(
      (a: { updated_at: string }) => now - new Date(a.updated_at).getTime() < STALE_MS,
    );
    const stale = (processing ?? []).filter(
      (a: { updated_at: string }) => now - new Date(a.updated_at).getTime() >= STALE_MS,
    );

    // Timeout stale jobs for this user
    for (const s of stale) {
      try {
        await supabaseAdmin
          .from("analyses")
          .update({
            status: "failed",
            error: "Analysis timed out — please re-run.",
            results: { stage: "failed", error: "Analysis timed out" },
          })
          .eq("id", s.id);

        await supabaseAdmin
          .from("documents")
          .update({ status: "failed" })
          .eq("id", s.document_id);
      } catch (err) {
        console.warn("[processQueue] Error cleaning stale job:", err);
      }
    }

    if (active.length > 0) {
      return { started: false as const, reason: "busy" as const, activeId: active[0]!.id };
    }

    // Pick the oldest pending analysis for this user
    const { data: pending, error: pendingError } = await supabaseAdmin
      .from("analyses")
      .select("id,document_id,version_id,documents!inner(owner_id)")
      .eq("status", "pending")
      .eq("documents.owner_id", ctx.userId)
      .order("created_at", { ascending: true })
      .limit(1);
    if (pendingError) throw pendingError;

    const next = pending?.[0];
    if (!next) return { started: false as const, reason: "empty" as const };

    const { data: version, error: versionError } = await supabaseAdmin
      .from("document_versions")
      .select("storage_path")
      .eq("id", next.version_id)
      .maybeSingle();
    if (versionError) throw versionError;

    if (!version?.storage_path) {
      await supabaseAdmin
        .from("analyses")
        .update({
          status: "failed",
          error: "Stored file missing for this version",
          results: { stage: "failed" },
        })
        .eq("id", next.id);

      await supabaseAdmin
        .from("documents")
        .update({ status: "failed" })
        .eq("id", next.document_id);

      return {
        started: true as const,
        ok: false as const,
        error: "Stored file missing for this version",
      };
    }

    // Atomically claim the pending job
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("analyses")
      .update({
        status: "processing",
        error: null,
        results: { stage: "extracting", stage_pct: 15 },
      })
      .eq("id", next.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return { started: false as const, reason: "claimed" as const };

    // Execute the analysis pipeline
    const res = await execute(ctx, {
      analysisId: next.id,
      documentId: next.document_id,
      versionId: next.version_id,
      storagePath: version.storage_path,
    });

    return { started: true as const, ...res };
  });
