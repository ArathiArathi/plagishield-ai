import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  ShieldCheck, ScanSearch, Sparkles, SpellCheck, Quote, FileBarChart, ArrowRight, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PlagiShield AI — Plagiarism & AI Content Detection" },
      { name: "description", content: "Review text similarity, AI-style signals, writing clarity, and citations in one private workspace." },
      { property: "og:title", content: "PlagiShield AI — Plagiarism & AI Content Detection" },
      { property: "og:description", content: "Review text similarity, AI-style signals, writing clarity, and citations in one private workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WelcomePage,
});

const features = [
  { icon: ScanSearch, title: "Text similarity review", copy: "Find passages that resemble retrieved sources and inspect the matching context." },
  { icon: Sparkles, title: "AI-style indicators", copy: "Review writing-pattern signals as prompts for closer reading, not proof of authorship." },
  { icon: SpellCheck, title: "Grammar & clarity", copy: "Get actionable writing feedback grouped by issue type and severity." },
  { icon: Quote, title: "Citation review", copy: "Spot incomplete or malformed references that may need a manual check." },
  { icon: FileBarChart, title: "Readable reports", copy: "Bring scores, highlighted passages, and review notes together in one report." },
  { icon: Lock, title: "Private workspace", copy: "Keep your documents and results in your own account workspace." },
];

const steps = [
  { number: "01", title: "Add your document", copy: "Upload a supported file or paste your writing into the workspace." },
  { number: "02", title: "Review the findings", copy: "Explore similarity matches, writing signals, grammar feedback, and citation notes." },
  { number: "03", title: "Use your judgement", copy: "Open the source context, verify the evidence, and make any changes you consider appropriate." },
];

function WelcomePage() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <Link to="/" className="flex items-center">
            <Logo size="sm" />
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
            <Sparkles className="h-3.5 w-3.5 text-primary" /> A thoughtful writing-review workspace
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Understand your writing. Review with confidence.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            Explore text similarity, AI-style indicators, grammar suggestions, and citation checks
            in one workspace designed for students, faculty, and researchers.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/register">Get started <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild><Link to="/login">I already have an account</Link></Button>
          </div>
          <p className="mx-auto mt-5 max-w-xl text-xs leading-5 text-muted-foreground">
            Analysis results are review aids. Similarity coverage depends on available sources, and
            AI-style indicators cannot establish who wrote a document.
          </p>
        </section>

        <section className="border-y border-border bg-muted/30 py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Everything in one review workspace
              </h2>
              <p className="mt-3 text-sm text-muted-foreground md:text-base">
                Clear signals and useful context to help you decide what deserves a closer look.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <Card key={f.title} className="p-6 transition-shadow hover:shadow-md">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{f.copy}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              From upload to useful next steps
            </h2>
            <p className="mt-3 text-sm text-muted-foreground md:text-base">
              A simple workflow keeps the evidence visible and the final decision in your hands.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map((step) => (
              <Card key={step.number} className="p-6">
                <span className="text-xs font-semibold tracking-widest text-primary">{step.number}</span>
                <h3 className="mt-3 text-base font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.copy}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-t border-border bg-muted/20 px-4 py-16 text-center md:px-6 md:py-20">
          <div className="mx-auto max-w-3xl">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Evidence first. Human judgement always.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              No automated score should be treated as a final academic-integrity decision. Check
              matched-source context, review the document, and follow your institution’s guidance.
            </p>
            <Button size="lg" className="mt-7" asChild>
              <Link to="/register">Create your account <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-xs text-muted-foreground md:flex-row md:px-6">
          <div className="flex items-center gap-3">
            <Logo size="xs" />
            <span className="text-muted-foreground/60">·</span>
            <span>© 2026 PlagiShield AI. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-foreground">Login</Link>
            <Link to="/register" className="hover:text-foreground">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
