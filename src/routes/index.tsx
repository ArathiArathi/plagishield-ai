import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldCheck, ScanSearch, Sparkles, SpellCheck, Quote, FileBarChart, ArrowRight, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PlagiShield AI — Plagiarism & AI Content Detection" },
      { name: "description", content: "Check originality, detect AI-generated text, fix grammar, and verify citations — all in one private workspace." },
      { property: "og:title", content: "PlagiShield AI — Plagiarism & AI Content Detection" },
      { property: "og:description", content: "Check originality, detect AI-generated text, fix grammar, and verify citations in one private workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WelcomePage,
});

const features = [
  { icon: ScanSearch, title: "Similarity detection", copy: "Sentence-level matching that surfaces exactly which passages need attention." },
  { icon: Sparkles, title: "AI content analysis", copy: "Estimate how much of a draft reads as machine-generated, with reasoning." },
  { icon: SpellCheck, title: "Grammar & clarity", copy: "Actionable writing feedback grouped by issue type and severity." },
  { icon: Quote, title: "Citation verification", copy: "Validate references and catch incomplete or malformed citations." },
  { icon: FileBarChart, title: "Shareable reports", copy: "Executive-ready summaries with scores, trends, and recommendations." },
  { icon: Lock, title: "Private by default", copy: "Your documents and results are visible only to you — never to other users." },
];

function WelcomePage() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="h-4 w-4" strokeWidth={2.4} />
            </div>
            <span className="font-semibold text-foreground">PlagiShield AI</span>
          </Link>
          <div className="flex items-center gap-2">
            {!loading && isAuthenticated ? (
              <Button size="sm" asChild>
                <Link to="/dashboard">Go to dashboard <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild><Link to="/login">Login</Link></Button>
                <Button size="sm" asChild><Link to="/register">Register</Link></Button>
              </>
            )}
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 py-20 text-center md:px-6 md:py-28">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Academic integrity, powered by AI
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Write with confidence. Publish with proof.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            PlagiShield AI checks originality, detects AI-generated text, reviews grammar, and verifies
            citations — in one private workspace built for students, faculty, and researchers.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/register">Get started free <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild><Link to="/login">I already have an account</Link></Button>
          </div>
        </section>

        <section className="border-t border-border bg-muted/30 py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground">
              Everything you need in one review pass
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <Card key={f.title} className="p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{f.copy}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-20 text-center md:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Your first check takes under a minute
          </h2>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">
            Create an account, upload a document, and get a full integrity report with scores and fixes.
          </p>
          <Button size="lg" className="mt-7" asChild>
            <Link to="/register">Create your account <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-xs text-muted-foreground md:flex-row md:px-6">
          <p>© 2026 PlagiShield AI. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-foreground">Login</Link>
            <Link to="/register" className="hover:text-foreground">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
