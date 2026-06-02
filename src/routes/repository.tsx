import { createFileRoute } from "@tanstack/react-router";
import { Database, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { documents } from "@/lib/mock-data";

export const Route = createFileRoute("/repository")({
  head: () => ({ meta: [{ title: "Repository — PlagiShield AI" }, { name: "description", content: "Searchable repository of all previously analyzed documents." }] }),
  component: RepositoryPage,
});

function RepositoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Repository" description="Search and compare across your institutional document repository." />
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by title, author, keyword, source..." className="h-10 pl-9" />
          </div>
          <Button variant="outline">Filter by user</Button>
          <Button variant="outline">Filter by date</Button>
          <Button>Compare</Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Indexed documents</h3>
            <Badge variant="secondary" className="font-normal">12,847</Badge>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead><TableHead>Author</TableHead>
              <TableHead>Indexed</TableHead><TableHead>Type</TableHead>
              <TableHead className="text-right">Similarity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium text-foreground">{d.name}</TableCell>
                <TableCell className="text-muted-foreground">{d.author}</TableCell>
                <TableCell className="text-muted-foreground">{d.uploadedAt}</TableCell>
                <TableCell><Badge variant="outline">{d.type}</Badge></TableCell>
                <TableCell className="text-right font-medium text-foreground">{d.similarity}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
