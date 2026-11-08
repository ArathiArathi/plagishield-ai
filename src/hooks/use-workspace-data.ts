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

const avg = (nums: number[]) =>
  nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;

function resultOf(analysis: AnalysisRow): any {
  return analysis.results && typeof analysis.results === "object" ? analysis.results : {};
}

function observedSimilarity(analysis: AnalysisRow): number {
  const value = resultOf(analysis).plagiarism?.score ?? analysis.similarity_score;
  return Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : 0;
}

function matchedWordCount(analysis: AnalysisRow): number {
  const value = resultOf(analysis).plagiarism?.matched_words;
  return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
}


const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
      const done = analyses.filter((a) => a.status === "completed");

      const similarity = avg(done.map(observedSimilarity));
      const matchedDocuments = done.filter((analysis) => matchedWordCount(analysis) > 0).length;
      const matchedWords = done.reduce((sum, analysis) => sum + matchedWordCount(analysis), 0);
      const sourceRecordsRetrieved = done.reduce((sum, analysis) => {
        const count = resultOf(analysis).plagiarism?.source_coverage?.sources_retrieved;
        return sum + (Number.isFinite(Number(count)) ? Number(count) : 0);
      }, 0);
      const grammarIssues = done.reduce((sum, analysis) => {
        const issues = resultOf(analysis).grammar?.issues;
        return sum + (Array.isArray(issues) ? issues.length : 0);
      }, 0);
      const referencesVerified = done.reduce((sum, analysis) => {
        const count = resultOf(analysis).citations?.verified;
        return sum + (Number.isFinite(Number(count)) ? Number(count) : 0);
      }, 0);

      // Submission trend — last 7 calendar months. These are counts of uploads
      // and completed analyses, not a fabricated risk or pass/fail series.
      const now = new Date();
      const submissionTrend = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1);
        const inMonth = documents.filter((doc) => {
          const created = new Date(doc.created_at);
          return created.getFullYear() === d.getFullYear() && created.getMonth() === d.getMonth();
        });
        const completedInMonth = done.filter((analysis) => {
          const created = new Date(analysis.created_at);
          return created.getFullYear() === d.getFullYear() && created.getMonth() === d.getMonth();
        });
        return { month: MONTHS[d.getMonth()], submissions: inMonth.length, analyses: completedInMonth.length };
      });

      const buckets = [
        { range: "0%", min: 0, max: 0, fill: "var(--color-muted-foreground)" },
        { range: "1–10%", min: 0.01, max: 10, fill: "var(--color-primary)" },
        { range: "11–25%", min: 10.01, max: 25, fill: "var(--color-primary)" },
        { range: "26–50%", min: 25.01, max: 50, fill: "var(--color-primary)" },
        { range: "51–100%", min: 50.01, max: 100, fill: "var(--color-primary)" },
      ];
      const similarityDistribution = buckets.map((bucket) => ({
        range: bucket.range,
        fill: bucket.fill,
        count: done.filter((analysis) => {
          const score = observedSimilarity(analysis);
          return score >= bucket.min && score <= bucket.max;
        }).length,
      }));

      const recentActivity = documents.slice(0, 6).map((doc) => {
        const analysis = analyses.find((item) => item.document_id === doc.id);
        const matched = analysis ? matchedWordCount(analysis) : 0;
        const status =
          doc.status === "failed" ? "error" :
          doc.status === "analyzed" && matched > 0 ? "warning" :
          doc.status === "analyzed" ? "success" : "info";
        return {
          id: doc.id,
          title: doc.name,
          action:
            doc.status === "analyzed"
              ? matched > 0
                ? `Analysis complete · ${matched.toLocaleString()} matched words`
                : "No exact matches in retrieved sources"
              : doc.status === "failed"
                ? "Analysis failed"
                : doc.status === "processing"
                  ? "Analysis running"
                  : "Uploaded",
          time: new Date(doc.updated_at).toLocaleString(),
          status,
        };
      });

      return {
        documents,
        analyses,
        summaryStats: {
          similarity,
          matchedDocuments,
          matchedWords,
          sourceRecordsRetrieved,
          grammarIssues,
          referencesVerified,
          totalDocuments: documents.length,
          analyzed: done.length,
        },
        submissionTrend,
        similarityDistribution,
        recentActivity,
      };
    },
  });
}
