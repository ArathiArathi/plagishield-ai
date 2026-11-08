/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { secureUserCache } from "@/lib/cache/secure-cache";
import { useAuth } from "@/hooks/use-auth";

export type AnalysisRow = {
  id: string;
  document_id: string;
  version_id: string;
  status: string;
  similarity_score: number | null;
  ai_score: number | null;
  grammar_score: number | null;
  citation_score: number | null;
  results: unknown;
  error: string | null;
  created_at: string;
};

export type DocumentRow = {
  id: string;
  name: string;
  file_type: string;
  status: string;
  size_bytes: number;
  latest_version: number;
  created_at: string;
  updated_at: string;
  doc_type: string | null;
  author_name: string | null;
  paper_title: string | null;
};

let activeChannel: ReturnType<typeof supabase.channel> | null = null;
const activeClients = new Set<ReturnType<typeof useQueryClient>>();

function attachRealtimeListener(queryClient: ReturnType<typeof useQueryClient>) {
  activeClients.add(queryClient);

  if (!activeChannel) {
    activeChannel = supabase
      .channel(`workspace-sync-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "analyses" },
        async () => {
          await secureUserCache.invalidateByTag("analyses");
          await secureUserCache.invalidateByTag("workspace");
          activeClients.forEach((qc) => {
            qc.invalidateQueries({ queryKey: ["workspace-data"] });
            qc.invalidateQueries({ queryKey: ["analyses-latest"] });
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents" },
        async () => {
          await secureUserCache.invalidateByTag("documents");
          await secureUserCache.invalidateByTag("workspace");
          activeClients.forEach((qc) => {
            qc.invalidateQueries({ queryKey: ["workspace-data"] });
            qc.invalidateQueries({ queryKey: ["documents"] });
          });
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("[Realtime] Subscription error on workspace sync channel");
        }
      });
  }

  return () => {
    activeClients.delete(queryClient);
    if (activeClients.size === 0 && activeChannel) {
      supabase.removeChannel(activeChannel);
      activeChannel = null;
    }
  };
}

export function useWorkspaceData() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Real-time Supabase subscription with safe ref-counted channel management
  useEffect(() => {
    return attachRealtimeListener(queryClient);
  }, [queryClient]);

  return useQuery({
    queryKey: ["workspace-data", user?.id],
    enabled: !!user,
    refetchInterval: (query) => {
      const analyses = (query.state.data as any)?.analyses ?? [];
      const documents = (query.state.data as any)?.documents ?? [];
      const hasActive =
        analyses.some((a: any) => a.status === "processing" || a.status === "pending") ||
        documents.some((d: any) => d.status === "processing" || d.status === "queued");
      return hasActive ? 1200 : false;
    },
    queryFn: async () => {
      const session = (await supabase.auth.getSession()).data.session;
      const userId = session?.user?.id ?? "global";

      const [docsRes, analysesRes] = await Promise.all([
        supabase
          .from("documents")
          .select("id,name,file_type,status,size_bytes,latest_version,created_at,updated_at,doc_type,author_name,paper_title")
          .order("created_at", { ascending: false }),
        supabase
          .from("analyses")
          .select("id,document_id,version_id,status,similarity_score,ai_score,grammar_score,citation_score,results,error,created_at")
          .order("created_at", { ascending: false }),
      ]);
      if (docsRes.error) throw docsRes.error;
      if (analysesRes.error) throw analysesRes.error;

      const documents = (docsRes.data ?? []) as DocumentRow[];
      const analyses = (analysesRes.data ?? []) as AnalysisRow[];
      const done = analyses.filter((analysis) => analysis.status === "completed");
      const resultFor = (analysis: AnalysisRow) => (analysis.results ?? {}) as {
        plagiarism?: {
          matched_words?: number;
          eligible_words?: number;
          excluded_words?: number;
          matches?: unknown[];
          source_coverage?: { sources_retrieved?: number };
        };
      };

      const summaryStats = done.reduce((summary, analysis) => {
        const plagiarism = resultFor(analysis).plagiarism;
        summary.matchedSourceRecords += plagiarism?.matches?.length ?? 0;
        summary.matchedWords += Number(plagiarism?.matched_words ?? 0);
        summary.comparedWords += Number(plagiarism?.eligible_words ?? 0);
        summary.excludedWords += Number(plagiarism?.excluded_words ?? 0);
        summary.sourcesRetrieved += Number(plagiarism?.source_coverage?.sources_retrieved ?? 0);
        return summary;
      }, {
        totalDocuments: documents.length,
        analyzed: done.length,
        matchedSourceRecords: 0,
        matchedWords: 0,
        comparedWords: 0,
        excludedWords: 0,
        sourcesRetrieved: 0,
      });

      const recentActivity = documents.slice(0, 6).map((document) => {
        const analysis = analyses.find((item) => item.document_id === document.id);
        const result = analysis ? resultFor(analysis) : null;
        const matchCount = result?.plagiarism?.matches?.length ?? 0;
        const status =
          analysis?.status === "failed" || document.status === "failed" ? "error" :
          analysis?.status === "completed" ? "success" :
          analysis?.status === "processing" || document.status === "processing" ? "info" :
          "info";
        return {
          id: document.id,
          title: document.name,
          action: analysis?.status === "completed"
            ? `Analysis complete · ${matchCount} source match(es)`
            : analysis?.status === "failed" || document.status === "failed"
              ? "Analysis failed"
              : analysis?.status === "processing" || document.status === "processing"
                ? "Analysis running"
                : "Uploaded",
          time: new Date(document.updated_at).toLocaleString(),
          status,
        };
      });

      return {
        documents,
        analyses,
        summaryStats,
        recentActivity,
      };
    },
  });
}
