import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import {
  Download, Eye, FileText, Filter, MoreHorizontal, ScanSearch, Trash2, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { documents, type DocumentStatus } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/documents")({
  head: () => ({ meta: [{ title: "Documents — PlagiShield AI" }, { name: "description", content: "Upload, manage, and analyze your documents." }] }),
  component: DocumentsPage,
});

const statusStyles: Record<DocumentStatus, string> = {
  analyzed: "bg-success/15 text-success border-success/30",
  processing: "bg-info/15 text-info border-info/30",
  queued: "bg-muted text-muted-foreground border-border",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
};

function DocumentsPage() {
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length === 0) return;
    simulateUpload(files[0].name);
  }, []);

  const simulateUpload = (name: string) => {
    setUploadProgress(0);
    const i = setInterval(() => {
      setUploadProgress((p) => {
        if (p === null) return null;
        if (p >= 100) { clearInterval(i); setTimeout(() => setUploadProgress(null), 600); toast.success(`Uploaded ${name}`); return 100; }
        return p + 12;
      });
    }, 180);
  };

  const filtered = documents.filter((d) =>
    d.name.toLowerCase().includes(query.toLowerCase()) ||
    d.author.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Upload, organize, and analyze your documents."
        actions={
          <Button size="sm" onClick={() => simulateUpload("manual-upload.pdf")}>
            <Upload className="mr-1.5 h-4 w-4" />Upload
          </Button>
        }
      />

      <Card
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-3 border-2 border-dashed p-10 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/30"
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Upload className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Drag & drop files to upload</p>
          <p className="text-xs text-muted-foreground">Supports PDF, DOCX, and TXT up to 50MB</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => simulateUpload("browse-upload.docx")}>Browse files</Button>
        {uploadProgress !== null && (
          <div className="mt-3 w-full max-w-md">
            <Progress value={uploadProgress} />
            <p className="mt-1.5 text-xs text-muted-foreground">Uploading… {uploadProgress}%</p>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">All documents</h3>
            <Badge variant="secondary" className="font-normal">{filtered.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Input placeholder="Search by name or author" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 w-64" />
            <Button variant="outline" size="sm"><Filter className="mr-1.5 h-4 w-4" />Filter</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Similarity</TableHead>
                <TableHead>AI</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((doc) => (
                <TableRow key={doc.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.type} · {doc.id}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{doc.author}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{doc.uploadedAt}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("capitalize", statusStyles[doc.status])}>{doc.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {doc.status === "analyzed" ? <SimilarityPill value={doc.similarity} /> : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {doc.status === "analyzed" ? <span className="text-sm font-medium text-foreground">{doc.ai}%</span> : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild><Link to="/analysis"><Eye className="h-4 w-4" /></Link></Button>
                      <Button variant="ghost" size="sm" asChild><Link to="/analysis"><ScanSearch className="h-4 w-4" /></Link></Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Download className="mr-2 h-4 w-4" />Download report</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function SimilarityPill({ value }: { value: number }) {
  const tone = value < 15 ? "bg-success/15 text-success" : value < 30 ? "bg-warning/20 text-warning" : "bg-destructive/15 text-destructive";
  return <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", tone)}>{value}%</span>;
}
