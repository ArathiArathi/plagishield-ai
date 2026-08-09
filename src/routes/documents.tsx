import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Download, Eye, FileText, History, MoreHorizontal, ScanSearch, Trash2, Upload,
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
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { processQueue, runAnalysis } from "@/lib/analysis.functions";

import { cn } from "@/lib/utils";

export const Route = createFileRoute("/documents")({
  head: () => ({ meta: [{ title: "Documents — PlagiShield AI" }] }),
  component: DocumentsPage,
});

const statusStyles: Record<string, string> = {
  analyzed: "bg-success/15 text-success border-success/30",
  processing: "bg-info/15 text-info border-info/30",
  queued: "bg-muted text-muted-foreground border-border",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
};

type DocRow = {
  id: string; name: string; file_type: string; size_bytes: number;
  latest_version: number; status: string; created_at: string;
};
type VersionRow = {
  id: string; version: number; storage_path: string; size_bytes: number; created_at: string;
};
type AnalysisRow = {
  id: string; document_id: string; status: string;
  similarity_score: number | null; ai_score: number | null;
};

function DocumentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const runAnalysisFn = useServerFn(runAnalysis);
  const fileRef = useRef<HTMLInputElement>(null);
  const versionRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [versionTarget, setVersionTarget] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState<DocRow | null>(null);

  const docsQ = useQuery({
    queryKey: ["documents", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("documents").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as DocRow[];
    },
  });

  const analysesQ = useQuery({
    queryKey: ["analyses-latest", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("analyses").select("id,document_id,status,similarity_score,ai_score").order("created_at", { ascending: false });
      if (error) throw error;
      const map = new Map<string, AnalysisRow>();
      (data as AnalysisRow[]).forEach((a) => { if (!map.has(a.document_id)) map.set(a.document_id, a); });
      return map;
    },
  });

  const versionsQ = useQuery({
    queryKey: ["versions", historyOpen?.id],
    enabled: !!historyOpen,
    queryFn: async () => {
      const { data, error } = await supabase.from("document_versions").select("*").eq("document_id", historyOpen!.id).order("version", { ascending: false });
      if (error) throw error;
      return data as VersionRow[];
    },
  });

  const uploadFile = useCallback(async (file: File, existingDocId?: string) => {
    if (!user) return;
    setUploadProgress(5);
    try {
      let documentId = existingDocId;
      let version = 1;

      if (documentId) {
        const { data: doc } = await supabase.from("documents").select("latest_version").eq("id", documentId).single();
        version = (doc?.latest_version ?? 0) + 1;
      } else {
        const { data: inserted, error: insErr } = await supabase.from("documents").insert({
          owner_id: user.id, name: file.name,
          file_type: file.name.split(".").pop()?.toUpperCase() ?? "FILE",
          size_bytes: file.size, latest_version: 1, status: "queued",
        }).select().single();
        if (insErr) throw insErr;
        documentId = inserted.id;
      }
      setUploadProgress(25);

      const storagePath = `${user.id}/${documentId}/v${version}-${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(storagePath, file, { upsert: false });
      if (upErr) throw upErr;
      setUploadProgress(55);

      const { data: ver, error: vErr } = await supabase.from("document_versions").insert({
        document_id: documentId!, version, storage_path: storagePath,
        size_bytes: file.size, uploaded_by: user.id,
      }).select().single();
      if (vErr) throw vErr;

      await supabase.from("documents").update({
        latest_version: version, size_bytes: file.size, status: "queued",
      }).eq("id", documentId!);
      setUploadProgress(70);

      const { data: analysis, error: aErr } = await supabase.from("analyses").insert({
        document_id: documentId!, version_id: ver.id, status: "pending",
      }).select().single();
      if (aErr) throw aErr;
      setUploadProgress(85);

      toast.success(`Uploaded ${file.name} (v${version}) — analyzing…`);
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["analyses-latest"] });

      runAnalysisFn({ data: {
        analysisId: analysis.id, documentId: documentId!,
        versionId: ver.id, storagePath,
      }}).then(() => {
        toast.success(`Analysis complete: ${file.name}`);
        qc.invalidateQueries({ queryKey: ["documents"] });
        qc.invalidateQueries({ queryKey: ["analyses-latest"] });
      }).catch((e) => {
        toast.error(`Analysis failed: ${e.message ?? e}`);
        qc.invalidateQueries({ queryKey: ["documents"] });
      });

      setUploadProgress(100);
      setTimeout(() => setUploadProgress(null), 600);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error(msg);
      setUploadProgress(null);
    }
  }, [user, qc, runAnalysisFn]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) uploadFile(f);
  }, [uploadFile]);

  const deleteDoc = async (id: string) => {
    if (!confirm("Delete this document and all versions?")) return;
    const { data: versions } = await supabase.from("document_versions").select("storage_path").eq("document_id", id);
    const paths = (versions ?? []).map((v) => v.storage_path);
    if (paths.length) await supabase.storage.from("documents").remove(paths);
    await supabase.from("documents").delete().eq("id", id);
    toast.success("Document deleted");
    qc.invalidateQueries({ queryKey: ["documents"] });
  };

  const downloadVersion = async (storagePath: string, name: string) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(storagePath, 60);
    if (error || !data) { toast.error("Could not generate link"); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl; a.download = name; a.target = "_blank"; a.click();
  };

  const docs = docsQ.data ?? [];
  const filtered = docs.filter((d) => d.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-6">
      <input ref={fileRef} type="file" className="hidden"
        accept=".pdf,.docx,.txt,.md"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }} />
      <input ref={versionRef} type="file" className="hidden"
        accept=".pdf,.docx,.txt,.md"
        onChange={(e) => { const f = e.target.files?.[0]; if (f && versionTarget) uploadFile(f, versionTarget); e.target.value = ""; setVersionTarget(null); }} />

      <PageHeader
        title="Documents"
        description="Upload, version, and analyze your documents."
        actions={
          <Button size="sm" onClick={() => fileRef.current?.click()}>
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
          <p className="text-xs text-muted-foreground">PDF, DOCX, TXT, MD — stored privately, scored automatically</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Browse files</Button>
        {uploadProgress !== null && (
          <div className="mt-3 w-full max-w-md">
            <Progress value={uploadProgress} />
            <p className="mt-1.5 text-xs text-muted-foreground">Working… {uploadProgress}%</p>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">All documents</h3>
            <Badge variant="secondary" className="font-normal">{filtered.length}</Badge>
          </div>
          <Input placeholder="Search by name" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 w-64" />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Similarity</TableHead>
                <TableHead>AI</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docsQ.isLoading && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">Loading…</TableCell></TableRow>
              )}
              {!docsQ.isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">No documents yet — upload one to get started.</TableCell></TableRow>
              )}
              {filtered.map((doc) => {
                const a = analysesQ.data?.get(doc.id);
                return (
                  <TableRow key={doc.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">{doc.file_type} · {(doc.size_bytes / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">v{doc.latest_version}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("capitalize", statusStyles[doc.status] ?? statusStyles.queued)}>{doc.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {a?.similarity_score != null ? <SimilarityPill value={Number(a.similarity_score)} /> : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {a?.ai_score != null ? <span className="text-sm font-medium text-foreground">{Number(a.ai_score).toFixed(0)}%</span> : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild title="Open analysis"><Link to="/analysis" search={{ doc: doc.id }}><Eye className="h-4 w-4" /></Link></Button>
                        <Button variant="ghost" size="sm" title="Version history" onClick={() => setHistoryOpen(doc)}><History className="h-4 w-4" /></Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setVersionTarget(doc.id); versionRef.current?.click(); }}>
                              <Upload className="mr-2 h-4 w-4" />Upload new version
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild><Link to="/analysis" search={{ doc: doc.id }}><ScanSearch className="mr-2 h-4 w-4" />View analysis</Link></DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => deleteDoc(doc.id)}>
                              <Trash2 className="mr-2 h-4 w-4" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!historyOpen} onOpenChange={(o) => !o && setHistoryOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Version history — {historyOpen?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(versionsQ.data ?? []).map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>v{v.version}</TableCell>
                    <TableCell>{(v.size_bytes / 1024).toFixed(1)} KB</TableCell>
                    <TableCell>{new Date(v.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => downloadVersion(v.storage_path, `${historyOpen?.name}-v${v.version}`)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SimilarityPill({ value }: { value: number }) {
  const tone = value < 15 ? "bg-success/15 text-success" : value < 30 ? "bg-warning/20 text-warning" : "bg-destructive/15 text-destructive";
  return <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", tone)}>{value.toFixed(0)}%</span>;
}
