import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, ArrowUpRight, Check, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PlagiShield — Review a paper with its sources in view" },
      { name: "description", content: "Compare a document with available public sources, inspect exact text matches, and export a report that includes the submitted text." },
      { property: "og:title", content: "PlagiShield — Review a paper with its sources in view" },
      { property: "og:description", content: "Source-linked text comparison and document review." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: WelcomePage,
});

const plans = [
  { name: "Free", monthly: "₹0", annual: "—", allowance: "10 document reviews per month" },
  { name: "Pro", monthly: "₹1,300", annual: "₹11,300", allowance: "15 document reviews per month" },
  { name: "Plus", monthly: "₹2,700", annual: "₹22,600", allowance: "25 document reviews per month" },
  { name: "Premium", monthly: "₹4,600", annual: "₹39,500", allowance: "35 document reviews per month" },
];

function WelcomePage() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated) navigate({ to: "/dashboard", replace: true });
  }, [loading, isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-[#fbfaf7] text-[#202b26]">
      <header className="border-b border-[#e6e4dd] bg-[#fbfaf7]">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8">
          <Link to="/" aria-label="PlagiShield home"><Logo size="sm" /></Link>
          <div className="hidden items-center gap-7 text-sm text-[#5f6962] md:flex">
            <a href="#what-it-checks" className="hover:text-[#202b26]">What it checks</a>
            <a href="#limits" className="hover:text-[#202b26]">Coverage</a>
            <a href="#plans" className="hover:text-[#202b26]">Pricing</a>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild><Link to="/login">Sign in</Link></Button>
            <Button size="sm" className="rounded-sm bg-[#28513f] text-white hover:bg-[#1f4032]" asChild>
              <Link to="/register">Create account <ArrowUpRight className="ml-1.5 h-4 w-4" /></Link>
            </Button>
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-16 md:grid-cols-[1.15fr_.85fr] md:items-center md:px-8 md:pb-24 md:pt-24">
          <div>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[.12em] text-[#527461]">Document review for students and researchers</p>
            <h1 className="max-w-2xl font-serif text-[clamp(2.8rem,5.4vw,5rem)] leading-[1.04] tracking-[-.045em]">
              Check the passages that deserve a second look.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-[#5f6962]">
              PlagiShield compares your paper with public sources it can retrieve, marks exact text matches, and puts the source excerpts beside your document. You can review language and reference notes, then export the paper with its highlights.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" className="h-11 rounded-sm bg-[#28513f] px-5 text-white hover:bg-[#1f4032]" asChild>
                <Link to="/register">Review a document <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <a href="#what-it-checks" className="inline-flex h-11 items-center px-3 text-sm text-[#4e6256] hover:text-[#202b26]">What gets checked</a>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 border-t border-[#e6e4dd] pt-4 text-xs text-[#68736c]">
              <span className="inline-flex items-center gap-2"><LockKeyhole className="h-3.5 w-3.5" /> Private workspace</span>
              <span className="inline-flex items-center gap-2"><Check className="h-3.5 w-3.5" /> Source-linked matches</span>
              <span className="inline-flex items-center gap-2"><Check className="h-3.5 w-3.5" /> PDF export</span>
            </div>
          </div>

          <aside className="border-l border-[#d9ded7] pl-6 md:pl-8">
            <h2 className="font-serif text-2xl leading-snug">A useful report should let you check the work.</h2>
            <ol className="mt-6 space-y-5">
              <li className="border-t border-[#e6e4dd] pt-4">
                <span className="font-mono text-xs text-[#a26048]">01</span>
                <h3 className="mt-1 text-sm font-semibold">The paper stays in view</h3>
                <p className="mt-1 text-sm leading-6 text-[#68736c]">The extracted submission text is included in the report, with matched passages highlighted and numbered by source.</p>
              </li>
              <li className="border-t border-[#e6e4dd] pt-4">
                <span className="font-mono text-xs text-[#a26048]">02</span>
                <h3 className="mt-1 text-sm font-semibold">Every match has context</h3>
                <p className="mt-1 text-sm leading-6 text-[#68736c]">Open the source record and compare the matching passage instead of relying on a percentage alone.</p>
              </li>
              <li className="border-t border-[#e6e4dd] pt-4">
                <span className="font-mono text-xs text-[#a26048]">03</span>
                <h3 className="mt-1 text-sm font-semibold">No invented AI score</h3>
                <p className="mt-1 text-sm leading-6 text-[#68736c]">AI authorship scoring is not shown until it can be supported by independent validation.</p>
              </li>
            </ol>
          </aside>
        </section>

        <section id="what-it-checks" className="border-y border-[#e6e4dd] bg-[#f1f1eb]">
          <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#a26048]">What gets checked</p>
              <h2 className="mt-3 font-serif text-3xl leading-tight tracking-[-.03em] md:text-4xl">Evidence first. Scores second.</h2>
              <p className="mt-4 text-sm leading-7 text-[#68736c]">The checks below report what the connected services actually return. Missing data is labelled as not assessed rather than filled with an estimate.</p>
            </div>
            <div className="mt-10 grid gap-8 border-t border-[#d9ded7] pt-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <h3 className="text-sm font-semibold">Text similarity</h3>
                <p className="mt-2 text-sm leading-6 text-[#68736c]">Exact phrase matches from retrieved source text, with word counts, source excerpts and document highlights.</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold">Language review</h3>
                <p className="mt-2 text-sm leading-6 text-[#68736c]">Grammar and spelling suggestions from the configured language checker, with the original passage shown.</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold">Reference checks</h3>
                <p className="mt-2 text-sm leading-6 text-[#68736c]">Detected reference entries are compared with public scholarly records. This is not a citation-style formatter.</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold">Annotated PDF</h3>
                <p className="mt-2 text-sm leading-6 text-[#68736c]">The report includes the extracted submission text and source-coloured highlights, not just a summary page.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="limits" className="mx-auto grid max-w-6xl gap-8 px-5 py-16 md:grid-cols-[.8fr_1.2fr] md:px-8 md:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#a26048]">Coverage and limitations</p>
            <h2 className="mt-3 font-serif text-3xl leading-tight tracking-[-.03em]">Know what was searched.</h2>
          </div>
          <div className="space-y-4 text-sm leading-7 text-[#68736c]">
            <p>PlagiShield currently searches public records from Crossref, OpenAlex, Semantic Scholar, Europe PMC and Wikipedia. Open-access full text is retrieved from Europe PMC when available; many other records provide only an abstract.</p>
            <p>The matcher looks for exact normalized passages of at least eight consecutive words. It is not yet a semantic paraphrase detector and does not have access to Turnitin or DrillBit's licensed web archives, publisher collections or private student-paper repositories.</p>
            <p>A similarity percentage describes overlap in the retrieved source set. It is not a plagiarism verdict, and a low score does not prove that a paper is original.</p>
          </div>
        </section>

        <section id="plans" className="border-y border-[#e6e4dd] bg-[#f1f1eb]">
          <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#a26048]">Plans</p>
              <h2 className="mt-3 font-serif text-3xl leading-tight tracking-[-.03em] md:text-4xl">Choose the monthly allowance you need.</h2>
              <p className="mt-3 text-sm leading-7 text-[#68736c]">Every plan includes the same core review tools. The allowance is the number of documents you can review each month.</p>
            </div>
            <div className="mt-9 grid gap-0 border-y border-[#d9ded7] sm:grid-cols-2 lg:grid-cols-4">
              {plans.map((plan, index) => (
                <div key={plan.name} className={`flex flex-col py-6 ${index > 0 ? "border-t border-[#d9ded7] sm:border-l sm:border-t-0 sm:pl-6" : "sm:pr-6"} lg:px-5 lg:first:pl-0 lg:last:pr-0`}>
                  <h3 className="text-sm font-semibold">{plan.name}</h3>
                  <p className="mt-4 font-serif text-3xl">{plan.monthly}<span className="ml-1 font-sans text-xs text-[#78837a]">/ month</span></p>
                  {plan.annual !== "—" && <p className="mt-1 text-xs text-[#68736c]">{plan.annual} billed yearly</p>}
                  <p className="mt-4 text-xs leading-5 text-[#68736c]">{plan.allowance}</p>
                  <Button size="sm" className="mt-6 w-fit rounded-sm bg-[#28513f] px-4 text-white hover:bg-[#1f4032]" asChild>
                    <Link to="/register">Choose {plan.name}</Link>
                  </Button>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs leading-6 text-[#7a857d]">Prices are in INR. GST is not added by the current checkout configuration. Paid plans are billed through Stripe.</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="font-serif text-3xl leading-tight">A match needs a person to interpret it.</h2>
              <p className="mt-4 text-sm leading-7 text-[#68736c]">A match may be a quotation, a correctly attributed passage, standard wording or something that needs attention. Review the source and the surrounding paragraph before deciding what it means.</p>
            </div>
            <div className="border-l border-[#d9ded7] pl-6 text-sm leading-7 text-[#68736c] md:pl-8">
              <p>PlagiShield is a document-review tool, not an institutional misconduct decision system. It does not currently provide a validated AI-writing probability.</p>
              <p className="mt-4">If your institution requires a report from Turnitin or DrillBit, use the service licensed by your institution for that submission.</p>
            </div>
          </div>
          <div className="mt-12 flex flex-col justify-between gap-5 border-t border-[#e6e4dd] pt-7 sm:flex-row sm:items-center">
            <div>
              <h3 className="font-serif text-2xl">Have a draft ready to review?</h3>
              <p className="mt-2 text-sm text-[#78837a]">Create an account and upload the document you want to check.</p>
            </div>
            <Button size="lg" className="h-11 rounded-sm bg-[#28513f] px-5 text-white hover:bg-[#1f4032]" asChild>
              <Link to="/register">Create account <ArrowUpRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#e6e4dd] bg-[#f1f1eb]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-7 text-xs text-[#78837a] sm:flex-row sm:items-center sm:justify-between md:px-8">
          <div className="flex items-center gap-3"><Logo size="xs" /><span>© 2026 PlagiShield</span></div>
          <div className="flex items-center gap-5"><Link to="/login" className="hover:text-[#202b26]">Sign in</Link><Link to="/register" className="hover:text-[#202b26]">Create account</Link><a href="#limits" className="hover:text-[#202b26]">Coverage</a></div>
        </div>
      </footer>
    </div>
  );
}
