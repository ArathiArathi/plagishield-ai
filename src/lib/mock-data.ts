export const summaryStats = {
  qualityScore: 87,
  similarity: 14,
  aiDetection: 9,
  grammar: 92,
  citation: 88,
  totalDocuments: 1284,
};

export const submissionTrend = [
  { month: "Jan", submissions: 120, flagged: 18 },
  { month: "Feb", submissions: 145, flagged: 22 },
  { month: "Mar", submissions: 168, flagged: 19 },
  { month: "Apr", submissions: 192, flagged: 28 },
  { month: "May", submissions: 215, flagged: 24 },
  { month: "Jun", submissions: 248, flagged: 31 },
  { month: "Jul", submissions: 286, flagged: 36 },
];

export const similarityDistribution = [
  { range: "0-10%", count: 412, fill: "var(--color-success)" },
  { range: "10-25%", count: 318, fill: "var(--color-info)" },
  { range: "25-50%", count: 164, fill: "var(--color-warning)" },
  { range: "50%+", count: 58, fill: "var(--color-destructive)" },
];

export const aiContentAnalysis = [
  { name: "Human", value: 76, fill: "var(--color-chart-2)" },
  { name: "AI Assisted", value: 18, fill: "var(--color-chart-3)" },
  { name: "AI Generated", value: 6, fill: "var(--color-chart-4)" },
];

export const grammarRadar = [
  { subject: "Grammar", score: 92 },
  { subject: "Spelling", score: 96 },
  { subject: "Punctuation", score: 88 },
  { subject: "Style", score: 81 },
  { subject: "Clarity", score: 85 },
  { subject: "Tone", score: 90 },
];

export type DocumentStatus = "analyzed" | "processing" | "queued" | "failed";

export interface DocumentRow {
  id: string;
  name: string;
  type: "PDF" | "DOCX" | "TXT";
  uploadedAt: string;
  status: DocumentStatus;
  similarity: number;
  ai: number;
  author: string;
}

export const documents: DocumentRow[] = [
  { id: "doc_001", name: "Thesis - Neural Architectures.pdf", type: "PDF", uploadedAt: "2026-05-28", status: "analyzed", similarity: 12, ai: 4, author: "Aarav Patel" },
  { id: "doc_002", name: "Research Paper - Quantum ML.docx", type: "DOCX", uploadedAt: "2026-05-27", status: "analyzed", similarity: 28, ai: 18, author: "Priya Shah" },
  { id: "doc_003", name: "Essay - Climate Policy.docx", type: "DOCX", uploadedAt: "2026-05-26", status: "processing", similarity: 0, ai: 0, author: "Liam Chen" },
  { id: "doc_004", name: "Dissertation Chapter 3.pdf", type: "PDF", uploadedAt: "2026-05-25", status: "analyzed", similarity: 6, ai: 2, author: "Sara Müller" },
  { id: "doc_005", name: "Lab Report - Polymer Synthesis.pdf", type: "PDF", uploadedAt: "2026-05-24", status: "analyzed", similarity: 58, ai: 41, author: "James Okafor" },
  { id: "doc_006", name: "Capstone Project Draft.docx", type: "DOCX", uploadedAt: "2026-05-23", status: "queued", similarity: 0, ai: 0, author: "Mia Rossi" },
  { id: "doc_007", name: "Conference Abstract.txt", type: "TXT", uploadedAt: "2026-05-22", status: "analyzed", similarity: 19, ai: 11, author: "Noah Kim" },
  { id: "doc_008", name: "Final Thesis Draft.pdf", type: "PDF", uploadedAt: "2026-05-21", status: "failed", similarity: 0, ai: 0, author: "Emma Dubois" },
];

export const sourceMatches = [
  { source: "Journal of Applied AI, 2024", url: "jaai.org/v12/article-238", similarity: 18, confidence: 94 },
  { source: "Wikipedia — Transformer (ML)", url: "en.wikipedia.org/wiki/Transformer_(machine_learning)", similarity: 9, confidence: 88 },
  { source: "ArXiv 2401.10583", url: "arxiv.org/abs/2401.10583", similarity: 6, confidence: 81 },
  { source: "MIT OpenCourseWare 6.S191", url: "ocw.mit.edu/6S191", similarity: 4, confidence: 76 },
];

export const grammarIssues = [
  { id: 1, type: "Grammar", severity: "high", text: "The results was significant.", fix: "The results were significant.", reason: "Subject–verb agreement." },
  { id: 2, type: "Style", severity: "medium", text: "In order to evaluate...", fix: "To evaluate...", reason: "Wordy phrasing." },
  { id: 3, type: "Punctuation", severity: "low", text: "However we found that", fix: "However, we found that", reason: "Missing comma after introductory adverb." },
  { id: 4, type: "Spelling", severity: "medium", text: "occured", fix: "occurred", reason: "Common misspelling." },
];

export const citationIssues = [
  { id: 1, ref: "Smith, J. (2021)", issue: "Missing in references list", style: "APA" },
  { id: 2, ref: "Lee et al., 2019", issue: "Year mismatch with source", style: "APA" },
  { id: 3, ref: "[12]", issue: "Reference [12] not defined", style: "IEEE" },
];

export const recommendations = [
  { group: "Originality", priority: "High", action: "Paraphrase sections 2.3 and 4.1 to reduce 28% similarity with Journal of Applied AI", impact: "−12% similarity" },
  { group: "Grammar", priority: "Medium", action: "Resolve 14 grammar issues across the introduction", impact: "+6 quality score" },
  { group: "Citation", priority: "High", action: "Add 3 missing in-text citations in section 3", impact: "+8 citation score" },
  { group: "Writing Quality", priority: "Low", action: "Tighten passive voice in conclusion", impact: "+2 readability" },
];

export const recentActivity = [
  { id: 1, title: "Thesis - Neural Architectures.pdf", action: "Analysis complete", time: "2 minutes ago", status: "success" as const },
  { id: 2, title: "Lab Report - Polymer Synthesis.pdf", action: "Flagged as high similarity", time: "1 hour ago", status: "warning" as const },
  { id: 3, title: "Capstone Project Draft.docx", action: "Queued for analysis", time: "3 hours ago", status: "info" as const },
  { id: 4, title: "Final Thesis Draft.pdf", action: "Analysis failed — retry needed", time: "Yesterday", status: "error" as const },
];

export const sampleParagraphs = [
  { text: "Recent advances in transformer architectures have fundamentally reshaped how we approach natural language understanding tasks across modalities.", risk: "low" },
  { text: "The attention mechanism, originally introduced in seminal work by Vaswani et al., enables models to weight input tokens dynamically based on contextual relevance.", risk: "medium" },
  { text: "It is widely acknowledged that large language models have demonstrated remarkable capabilities in generating coherent and contextually appropriate text across a variety of domains and applications.", risk: "high" },
  { text: "Our experimental setup combines a custom pretraining corpus with curriculum-based fine-tuning, yielding measurable improvements on downstream benchmarks.", risk: "low" },
];
