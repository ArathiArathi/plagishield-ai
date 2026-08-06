import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Database, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useWorkspaceData } from "@/hooks/use-workspace-data";

export const Route = createFileRoute("/repository")({
  head: () => ({
    meta: [
      { title: "Repository — PlagiShield AI" },
      { name: "description", content: "Searchable repository of every document indexed and analyzed in your workspace." },
      { property: "og:title", content: "Repository — PlagiShield AI" },
      { property: "og:description", content: "Searchable repository of every document indexed and analyzed in your workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RepositoryPage,
});

function RepositoryPage() {
  const { data, isLoading } = useWorkspaceData();
  const [query, setQuery] = useState("");

  const docs = (data?.documents ?? []).filter((d) =>
    d.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const analyses = data?.analyses ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Repository" description="Search across every document indexed in your workspace." />
      <Card className="p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by document name…"
            className="h-10 pl-9"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <Database className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Indexed documents</h3>
          <Badge variant="secondary" className="font-normal">{data?.documents.length ?? 0}</Badge>
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : docs.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-muted-foreground">
              {data?.documents.length ? "No documents match your search." : "No documents indexed yet."}
            </p>
            <Button asChild size="sm" className="mt-4"><Link to="/documents">Upload a document</Link></Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Indexed</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="text-right">Similarity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((d) => {
                const a = analyses.find((x) => x.document_id === d.id && x.status === "completed");
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium text-foreground">
                      <Link to="/analysis" search={{ doc: d.id }} className="hover:underline">{d.name}</Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</TableCell>
                    <TableCell><Badge variant="outline">{d.file_type}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">v{d.latest_version}</TableCell>
                    <TableCell className="text-right font-medium text-foreground">
                      {a ? `${Math.round(Number(a.similarity_score ?? 0))}%` : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
