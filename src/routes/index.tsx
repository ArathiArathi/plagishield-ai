import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  ArrowRight, ArrowUpRight, BookOpenCheck, Check, FileSearch, FileText,
  LockKeyhole, PenLine, Quote, ShieldCheck, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PlagiShield — A clearer way to review academic writing" },
      { name: "description", content: "Review text matches, writing signals, citations, and document quality with evidence you can inspect." },
      { property: "og:title", content: "PlagiShield — A clearer way to review academic writing" },
      { property: "og:description", content: "A practical writing-review workspace for students, researchers, and educators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WelcomePage,
});

const plans = [
  { name: "Free", price: "$0", allowance: "10 reviews / month", note: "For a first review" },
  { name: "Pro", price: "$14", allowance: "15 reviews / month", note: "For regular coursework", popular: true },
  { name: "Plus", price: "$29", allowance: "25 reviews / month", note: "For ongoing research" },
  { name: "Premium", price: "$49", allowance: "35 reviews / month", note: "For heavier workloads" },
];

function WelcomePage() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated) navigate({ to: "/dashboard", replace: true });
  }, [loading, isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#1d2926] selection:bg-[#dce8e1]">
      <header className="sticky top-0 z-30 border-b border-[#e7e5de] bg-[#f7f6f2]/95 backdrop-blur">
        <nav className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 md:px-8">
          <Link to="/" aria-label="PlagiShield home" className="flex items-center">
            <Logo size="sm" />
          </Link>
          <div className="hidden items-center gap-8 text-sm text-[#56615c] md:flex">
            <a href="#approach" className="transition-colors hover:text-[#1d2926]">Our approach</a>
            <a href="#how-it-works" className="transition-colors hover:text-[#1d2926]">How it works</a>
            <a href="#plans" className="transition-colors hover:text-[#1d2926]">Plans</a>
          </div>
          <div className="flex items-center gap-2">
            {!loading && isAuthenticated ? (
              <Button size="sm" asChild>
                <Link to="/dashboard">Open workspace <ArrowUpRight className="ml-1.5 h-4 w-4" /></Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild><Link to="/login">Sign in</Link></Button>
                <Button size="sm" className="bg-[#244c3e] text-white hover:bg-[#1b3c31]" asChild>
                  <Link to="/register">Create account <ArrowUpRight className="ml-1.5 h-4 w-4" /></Link>
                </Button>
              </>
            )}
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-16 md:grid-cols-[1.02fr_.98fr] md:px-8 md:pb-28 md:pt-24">
          <div className="max-w-2xl">
            <div className="mb-7 inline-flex items-center gap-2 border-b border-[#b9c9bf] pb-2 text-[11px] font-semibold uppercase tracking-[.18em] text-[#426d5b]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#bd6548]" />
              A writing review workspace
            </div>
            <h1 className="font-serif text-[clamp(3.25rem,6.3vw,5.7rem)] leading-[.99] tracking-[-.055em] text-[#1d2926]">
              Good writing deserves a closer look.
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-[#5b6660] md:text-lg">
              See where your document overlaps with available sources, review writing-pattern signals,
              and catch citation or clarity issues before you submit.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button size="lg" className="h-12 rounded-md bg-[#244c3e] px-6 text-white hover:bg-[#1b3c31]" asChild>
                <Link to="/register">Start a document review <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <a href="#how-it-works" className="inline-flex h-12 items-center gap-2 px-3 text-sm font-medium text-[#41544a] hover:text-[#1d2926]">
                See how it works <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-[#e4e1d9] pt-5 text-xs text-[#6c756f]">
              <span className="inline-flex items-center gap-2"><LockKeyhole className="h-3.5 w-3.5" /> Private account workspace</span>
              <span className="inline-flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> Downloadable reports</span>
              <span className="inline-flex items-center gap-2"><BookOpenCheck className="h-3.5 w-3.5" /> Evidence you can inspect</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[590px]">
            <div className="absolute -right-5 -top-5 h-32 w-32 rounded-full border border-[#d8dfd7]" />
            <div className="absolute -bottom-6 -left-5 h-24 w-24 rounded-full border border-[#e5cfc3]" />
            <div className="relative border border-[#deded5] bg-white p-5 shadow-[0_22px_65px_rgba(31,48,40,.10)] md:p-7">
              <div className="flex items-start justify-between border-b border-[#eeede8] pb-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#78847b]">Illustrative report preview</p>
                  <h2 className="mt-2 font-serif text-2xl text-[#26352e]">Research draft.pdf</h2>
                  <p className="mt-1 text-xs text-[#89928b]">Document review · sample values</p>
                </div>
                <span className="rounded-sm bg-[#edf3ee] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#426d5b]">Reviewed</span>
              </div>
              <div className="grid grid-cols-[116px_1fr] gap-5 border-b border-[#eeede8] py-6 sm:grid-cols-[145px_1fr]">
                <div className="flex flex-col items-center justify-center border-r border-[#eeede8] pr-5">
                  <span className="font-serif text-5xl leading-none text-[#bd6548]">18%</span>
                  <span className="mt-2 text-center text-[10px] uppercase tracking-[.13em] text-[#78847b]">Observed overlap</span>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="mb-1.5 flex justify-between text-xs"><span className="font-medium text-[#34453c]">Matched passages</span><span className="text-[#77837a]">3 sources</span></div>
                    <div className="h-1.5 overflow-hidden bg-[#edf0eb]"><div className="h-full w-[18%] bg-[#bd6548]" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-[#f6f7f3] p-3"><span className="block font-serif text-xl text-[#26352e]">126</span><span className="text-[#77837a]">Matched words</span></div>
                    <div className="bg-[#f6f7f3] p-3"><span className="block font-serif text-xl text-[#26352e]">08</span><span className="text-[#77837a]">Passages to review</span></div>
                  </div>
                </div>
              </div>
              <div className="space-y-4 pt-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-[.12em] text-[#647168]">Source evidence</h3>
                  <span className="text-[10px] text-[#9aa29c]">Sample content</span>
                </div>
                {[
                  { n: "01", title: "Journal article", detail: "Open scholarly record", pct: "9%" },
                  { n: "02", title: "Reference website", detail: "Public web source", pct: "6%" },
                  { n: "03", title: "Research abstract", detail: "Scholarly index", pct: "3%" },
                ].map((item) => (
                  <div key={item.n} className="flex items-center gap-3 border-b border-[#f0efe9] pb-3 last:border-0 last:pb-0">
                    <span className="flex h-7 w-7 items-center justify-center bg-[#f3eee9] font-mono text-[10px] text-[#9b5d45]">{item.n}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#34453c]">{item.title}</p>
                      <p className="mt-0.5 text-[10px] text-[#929a93]">{item.detail}</p>
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-[#5e6d63]">{item.pct}</span>
                  </div>
                ))}
              </div>
              <p className="mt-5 border-t border-[#eeede8] pt-4 text-[10px] leading-5 text-[#929a93]">
                A similarity percentage describes matches in the sources searched. It is not a plagiarism verdict.
              </p>
            </div>
            <p className="mt-4 text-right text-[10px] uppercase tracking-[.14em] text-[#8b938d]">A clearer view of the work</p>
          </div>
        </section>

        <section id="approach" className="border-y border-[#e6e3db] bg-[#eeeee7]">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-[.7fr_1.3fr] md:px-8 md:py-20">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#a15d43]">The approach</p>
              <h2 className="mt-4 max-w-sm font-serif text-4xl leading-tight tracking-[-.035em] text-[#24342d]">
                A report should explain what it found.
              </h2>
            </div>
            <div className="grid gap-8 sm:grid-cols-2">
              <div className="border-t border-[#cbd2c9] pt-4">
                <FileSearch className="h-5 w-5 text-[#507461]" />
                <h3 className="mt-4 font-semibold text-[#2b3b33]">See the source, not just a score</h3>
                <p className="mt-2 text-sm leading-7 text-[#657169]">Open matched passages and compare them with the retrieved source context. Check the evidence before drawing a conclusion.</p>
              </div>
              <div className="border-t border-[#cbd2c9] pt-4">
                <PenLine className="h-5 w-5 text-[#507461]" />
                <h3 className="mt-4 font-semibold text-[#2b3b33]">Improve the writing itself</h3>
                <p className="mt-2 text-sm leading-7 text-[#657169]">Review clarity, grammar, citations, and writing-pattern indicators alongside text similarity in one place.</p>
              </div>
              <div className="border-t border-[#cbd2c9] pt-4">
                <Quote className="h-5 w-5 text-[#507461]" />
                <h3 className="mt-4 font-semibold text-[#2b3b33]">Keep context in view</h3>
                <p className="mt-2 text-sm leading-7 text-[#657169]">A quoted sentence, a reference entry, and unattributed reuse are not the same thing. Context still matters.</p>
              </div>
              <div className="border-t border-[#cbd2c9] pt-4">
                <ShieldCheck className="h-5 w-5 text-[#507461]" />
                <h3 className="mt-4 font-semibold text-[#2b3b33]">Be honest about coverage</h3>
                <p className="mt-2 text-sm leading-7 text-[#657169]">Results depend on the public sources available to the search. We do not claim access to private student-paper or licensed publisher databases.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-24">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#a15d43]">A simple process</p>
              <h2 className="mt-4 font-serif text-4xl tracking-[-.04em] text-[#24342d] md:text-5xl">From first draft to informed review.</h2>
            </div>
            <p className="max-w-sm text-sm leading-7 text-[#68746c]">Keep the document, the evidence, and the next steps together—without treating an automated score as the final word.</p>
          </div>
          <div className="mt-12 grid gap-0 border-y border-[#e4e1d9] md:grid-cols-3">
            {[
              { n: "01", title: "Bring in your work", copy: "Upload a document or paste text into your private workspace." },
              { n: "02", title: "Review what surfaced", copy: "Explore text matches, source excerpts, writing signals, and citation notes." },
              { n: "03", title: "Make the call", copy: "Verify the context, edit where needed, and export a report for your records." },
            ].map((step, index) => (
              <div key={step.n} className={`py-7 md:px-7 ${index > 0 ? "border-t border-[#e4e1d9] md:border-l md:border-t-0" : "md:pl-0"}`}>
                <span className="font-mono text-xs text-[#a15d43]">{step.n}</span>
                <h3 className="mt-5 font-serif text-2xl text-[#2b3b33]">{step.title}</h3>
                <p className="mt-3 max-w-xs text-sm leading-7 text-[#68746c]">{step.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="plans" className="border-y border-[#e6e3db] bg-[#eeeee7]">
          <div className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#a15d43]">Straightforward plans</p>
              <h2 className="mt-4 font-serif text-4xl tracking-[-.04em] text-[#24342d] md:text-5xl">Room for the work you have.</h2>
              <p className="mt-4 text-sm leading-7 text-[#68746c]">Choose a document allowance. Every plan includes the same core review tools; paid subscriptions are managed securely through the billing portal.</p>
            </div>
            <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {plans.map((plan) => (
                <div key={plan.name} className={`flex flex-col border bg-[#f9f8f4] p-6 ${plan.popular ? "border-[#537a67] shadow-[0_10px_28px_rgba(39,67,53,.08)]" : "border-[#deded5]"}`}>
                  <div className="flex min-h-6 items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#2c3c34]">{plan.name}</h3>
                    {plan.popular && <span className="text-[9px] font-semibold uppercase tracking-[.12em] text-[#507461]">Popular</span>}
                  </div>
                  <p className="mt-5 font-serif text-4xl tracking-tight text-[#24342d]">{plan.price}<span className="ml-1 font-sans text-xs text-[#818a82]">/ month</span></p>
                  <p className="mt-2 text-xs font-medium text-[#a15d43]">{plan.allowance}</p>
                  <p className="mt-1 text-xs text-[#818a82]">{plan.note}</p>
                  <div className="my-6 h-px bg-[#e7e5de]" />
                  <ul className="flex-1 space-y-3 text-xs leading-5 text-[#657169]">
                    {["Source-backed text similarity", "Writing and citation review", "Downloadable reports"].map((feature) => (
                      <li key={feature} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#507461]" />{feature}</li>
                    ))}
                  </ul>
                  <Button className="mt-7 w-full rounded-sm bg-[#244c3e] text-white hover:bg-[#1b3c31]" asChild>
                    <Link to="/register">Choose {plan.name} <ArrowRight className="ml-2 h-3.5 w-3.5" /></Link>
                  </Button>
                </div>
              ))}
            </div>
            <p className="mt-5 text-center text-[10px] leading-5 text-[#8a938b]">Prices are displayed in USD. Checkout availability depends on the Stripe billing configuration for this deployment.</p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-24">
          <div className="grid gap-8 border-b border-[#e4e1d9] pb-14 md:grid-cols-[1fr_auto] md:items-end">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#a15d43]">A note on interpretation</p>
              <h2 className="mt-4 font-serif text-4xl leading-tight tracking-[-.04em] text-[#24342d]">Similarity is a signal. It is not a verdict.</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#68746c]">
                A matching passage may be a quotation, a correctly cited source, common wording, or material that needs attention. AI-style indicators are not proof of authorship. Read the evidence and apply your own judgement.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#507461]"><Sparkles className="h-4 w-4" /> Built for careful review</div>
          </div>
          <div className="flex flex-col items-start justify-between gap-6 pt-8 sm:flex-row sm:items-center">
            <div>
              <h3 className="font-serif text-2xl text-[#2b3b33]">Start with a document you want to understand better.</h3>
              <p className="mt-2 text-sm text-[#78837a]">Create an account and bring your first draft into the workspace.</p>
            </div>
            <Button size="lg" className="h-12 rounded-sm bg-[#244c3e] px-6 text-white hover:bg-[#1b3c31]" asChild>
              <Link to="/register">Create your workspace <ArrowUpRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#e6e3db] bg-[#f1f0ea]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-xs text-[#7a857d] sm:flex-row sm:items-center sm:justify-between md:px-8">
          <div className="flex items-center gap-3"><Logo size="xs" /><span>© 2026 PlagiShield. All rights reserved.</span></div>
          <div className="flex items-center gap-5"><Link to="/login" className="hover:text-[#24342d]">Sign in</Link><Link to="/register" className="hover:text-[#24342d]">Create account</Link><a href="#approach" className="hover:text-[#24342d]">Our approach</a></div>
        </div>
      </footer>
    </div>
  );
}
