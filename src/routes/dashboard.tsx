import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, FileBarChart, Upload } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { useAnalysisQueue } from "@/hooks/use-analysis-queue";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Workspace — PlagiShield" },
      { name: "description", content: "Your uploaded documents, text matches and review history." },
    ],
  }),
  component: DashboardPage,
});

type PlagiarismResults = {
  plagiarism?: {
    matched_words?: number;
    eligible_words?: number;
    matches?: Array<{ source?: string; url?: string; snippet?: string; similarity?: number }>;
  };
};

function DashboardPage() {
  const { data, isPending } = useWorkspaceData();
  useAnalysisQueue();

  const documents = data?.documents ?? [];
  const analyses = data?.analyses ?? [];
  const completed = analyses.filter((analysis) => analysis.status === "completed");
  const sourceMatches = completed
    .flatMap((analysis) => {
      const result = (analysis.results ?? {}) as PlagiarismResults;
      const document = documents.find((item) => item.id === analysis.document_id);
      return (result.plagiarism?.matches ?? []).map((match) => ({
        ...match,
        documentName: document?.name ?? "Document",
        documentId: analysis.document_id,
      }));
    })
    .slice(0, 5);

  const stats = data?.summaryStats;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Workspace"
        description="Your documents and the evidence returned by each review."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/reports" search={{ doc: undefined }}>
                <FileBarChart className="mr-1.5 h-4 w-4" />
                Reports
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/documents">
                <Upload className="mr-1.5 h-4 w-4" />
                Upload document
              </Link>
            </Button>
          </div>
        }
      />

      {isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Summary label="Documents" value={stats?.totalDocuments ?? documents.length} />
          <Summary label="Completed reviews" value={stats?.analyzed ?? completed.length} />
          <Summary label="Source records matched" value={stats?.matchedSourceRecords ?? 0} />
          <Summary
            label="Matched words"
            value={Number(stats?.matchedWords ?? 0).toLocaleString()}
          />
        </div>
      )}

      {!isPending && documents.length === 0 ? (
        <Card className="border-border bg-card p-9">
          <div className="max-w-lg">
            <FileText className="h-6 w-6 text-muted-foreground" />
            <h2 className="mt-4 font-serif text-2xl text-foreground">Start with a document</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Upload a paper or assignment. PlagiShield will extract its text, search connected
              public sources and show the passages it can substantiate.
            </p>
            <Button size="sm" className="mt-5" asChild>
              <Link to="/documents">Upload your first document</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
          <Card className="overflow-hidden">
            <div className="flex items-end justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Recently updated documents
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Open a document to inspect its latest review.
                </p>
              </div>
              <Link to="/documents" className="text-xs font-medium text-primary hover:underline">
                All documents
              </Link>
            </div>
            {documents.slice(0, 8).length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">No documents have been uploaded.</p>
            ) : (
              <ul className="divide-y divide-border">
                {documents.slice(0, 8).map((document) => {
                  const analysis = analyses.find((item) => item.document_id === document.id);
                  const result = (analysis?.results ?? {}) as PlagiarismResults;
                  const matchCount = result.plagiarism?.matches?.length ?? 0;
                  const state = analysis?.status ?? document.status;
                  return (
                    <li key={document.id}>
                      <Link
                        to="/analysis"
                        search={{ doc: document.id }}
                        className="grid gap-2 px-5 py-4 transition-colors hover:bg-muted/30 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {document.name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {document.file_type} · updated{" "}
                            {new Date(document.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">
                            {state === "completed" ? `${matchCount} source matches` : state}
                          </span>
                          <Badge variant={state === "completed" ? "secondary" : "outline"}>
                            {state}
                          </Badge>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">Latest source evidence</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Passages returned by your recent completed reviews.
              </p>
            </div>
            {sourceMatches.length === 0 ? (
              <p className="p-5 text-sm leading-6 text-muted-foreground">
                No exact source matches have been recorded yet. A report will list source evidence
                when the search returns a qualifying passage.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {sourceMatches.map((match, index) => (
                  <li
                    key={`${match.documentId}-${match.url ?? match.source ?? index}`}
                    className="p-5"
                  >
                    <p className="text-[11px] text-muted-foreground">{match.documentName}</p>
                    {match.url ? (
                      <a
                        href={match.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block text-sm font-medium text-primary hover:underline"
                      >
                        {match.source ?? "Source record"}
                      </a>
                    ) : (
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {match.source ?? "Source record"}
                      </p>
                    )}
                    {match.snippet && (
                      <p className="mt-2 line-clamp-3 border-l-2 border-[#bd6548] pl-3 text-xs leading-5 text-muted-foreground">
                        {match.snippet}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <p className="max-w-3xl text-xs leading-5 text-muted-foreground">
        Similarity is the share of compared text that overlaps with retrieved source records. It is
        not a finding of plagiarism, and an empty result does not prove originality.
      </p>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-b border-border px-1 py-4 sm:border-b-0 sm:border-l sm:pl-4 first:border-l-0 first:pl-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 font-serif text-3xl tabular-nums tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}
