import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
};

const avg = (nums: number[]) =>
  nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function useWorkspaceData() {
  return useQuery({
    queryKey: ["workspace-data"],
    queryFn: async () => {
      const [docsRes, analysesRes] = await Promise.all([
        supabase
          .from("documents")
          .select("id,name,file_type,status,size_bytes,latest_version,created_at,updated_at")
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

      const similarity = avg(done.map((a) => Number(a.similarity_score ?? 0)));
      const aiDetection = avg(done.map((a) => Number(a.ai_score ?? 0)));
      const grammar = avg(done.map((a) => Number(a.grammar_score ?? 0)));
      const citation = avg(done.map((a) => Number(a.citation_score ?? 0)));
      const qualityScore = done.length
        ? Math.round((grammar + citation + (100 - similarity) + (100 - aiDetection)) / 4)
        : 0;

      // Submission trend — last 7 calendar months
      const now = new Date();
      const submissionTrend = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1);
        const inMonth = documents.filter((doc) => {
          const c = new Date(doc.created_at);
          return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
        });
        const flagged = inMonth.filter((doc) => {
          const a = done.find((x) => x.document_id === doc.id);
          return a ? Number(a.similarity_score ?? 0) >= 25 || Number(a.ai_score ?? 0) >= 50 : false;
        });
        return { month: MONTHS[d.getMonth()], submissions: inMonth.length, flagged: flagged.length };
      });

      const buckets = [
        { range: "0-10%", min: 0, max: 10, fill: "var(--color-success)" },
        { range: "11-25%", min: 11, max: 25, fill: "var(--color-success)" },
        { range: "26-40%", min: 26, max: 40, fill: "var(--color-warning)" },
        { range: "41-60%", min: 41, max: 60, fill: "var(--color-warning)" },
        { range: "61%+", min: 61, max: 101, fill: "var(--color-destructive)" },
      ];
      const similarityDistribution = buckets.map((b) => ({
        range: b.range,
        fill: b.fill,
        count: done.filter((a) => {
          const s = Number(a.similarity_score ?? 0);
          return s >= b.min && s <= b.max;
        }).length,
      }));

      const aiHigh = done.filter((a) => Number(a.ai_score ?? 0) >= 60).length;
      const aiMid = done.filter((a) => {
        const s = Number(a.ai_score ?? 0);
        return s >= 25 && s < 60;
      }).length;
      const aiLow = done.length - aiHigh - aiMid;
      const aiContentAnalysis = [
        { name: "Human", value: aiLow, fill: "var(--color-success)" },
        { name: "AI Assisted", value: aiMid, fill: "var(--color-warning)" },
        { name: "AI Generated", value: aiHigh, fill: "var(--color-destructive)" },
      ];

      const recentActivity = documents.slice(0, 6).map((doc) => {
        const a = analyses.find((x) => x.document_id === doc.id);
        const status =
          doc.status === "failed" ? "error" :
          doc.status === "analyzed"
            ? Number(a?.similarity_score ?? 0) >= 25 ? "warning" : "success"
            : "info";
        return {
          id: doc.id,
          title: doc.name,
          action:
            doc.status === "analyzed" ? `Analysis complete · ${Math.round(Number(a?.similarity_score ?? 0))}% similarity` :
            doc.status === "failed" ? "Analysis failed" :
            doc.status === "processing" ? "Analysis running" : "Uploaded",
          time: new Date(doc.updated_at).toLocaleString(),
          status,
        };
      });

      return {
        documents,
        analyses,
        summaryStats: {
          qualityScore,
          similarity,
          aiDetection,
          grammar,
          citation,
          totalDocuments: documents.length,
          analyzed: done.length,
        },
        submissionTrend,
        similarityDistribution,
        aiContentAnalysis,
        recentActivity,
      };
    },
  });
}
