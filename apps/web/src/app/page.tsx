import { SiteHeader } from "@/components/site-header";
import { WidgetDemo } from "@/components/widget-demo";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const steps = [
  {
    n: "01",
    title: "Add your documents",
    body: "Paste your website URL or upload PDFs. Pages are crawled, cleaned, chunked and indexed in a vector store, scoped to your workspace.",
  },
  {
    n: "02",
    title: "Paste one line on your site",
    body: "A single script tag renders the chat widget. Answers stream in and every claim carries a citation to the page or document it came from.",
  },
  {
    n: "03",
    title: "Humans take over when it matters",
    body: "Low confidence or a request for a person pages your dashboard in real time. You reply in the same thread; the visitor never leaves.",
  },
];

const principles = [
  { title: "Grounded or silent", body: "If the retrieved context doesn't support an answer, the assistant says so and hands off instead of guessing. Citations are validated after generation, not trusted from the prompt." },
  { title: "Measured in public", body: "A fixed test set per workspace, scored on every run: accuracy, citation hit rate, correct refusals, over-refusal. Published at /evals when the owner opts in." },
  { title: "Multi-tenant by construction", body: "Every query is scoped to a workspace at the data layer and inside the vector index. Isolation is tested, not assumed." },
  { title: "Humans stay in the loop", body: "Low confidence pages a person. Tools that change something (tickets, bookings) wait for a teammate's approval. Costs and latency are visible per message." },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:pt-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-fg-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Open source · built on free tiers · every number measured
            </p>
            <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
              AI customer support that only says what your docs say.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-fg-muted">
              One script tag adds a support chat to your site. It answers from your own content with citations, hands off
              to a human when it should, and shows you exactly how accurate it is.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/signup" size="lg">
                Create a workspace
              </ButtonLink>
              <ButtonLink href="/evals" variant="secondary" size="lg">
                See the eval numbers
              </ButtonLink>
            </div>
            <p className="mt-4 text-xs text-fg-subtle">
              Free plan, no credit card.{" "}
              <a href="https://github.com/Mern-Umair/customer-support-groundline" target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                Source and architecture notes on GitHub
              </a>
              .
            </p>
          </div>
          <div className="flex justify-center lg:justify-end">
            <WidgetDemo />
          </div>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n}>
                <p className="font-mono text-xs text-accent">{s.n}</p>
                <h2 className="mt-2 text-lg font-medium">{s.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pt-16">
          <h2 className="text-2xl font-semibold tracking-tight">The dashboard</h2>
          <p className="mt-2 max-w-xl text-fg-muted">Conversations, handoffs, cost and latency, and the questions your documents could not answer. Real data from the demo workspace, not a mock-up.</p>
          <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface shadow-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/screenshots/overview.png" alt="Groundline dashboard overview: stat tiles, conversations per day chart and unanswered questions" className="block w-full" loading="lazy" />
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">Built to be checked</h2>
          <p className="mt-2 max-w-xl text-fg-muted">
            Support bots fail quietly. Groundline is designed so that failures are visible and counted.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {principles.map((p) => (
              <Card key={p.title} className="p-5">
                <h3 className="font-medium">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{p.body}</p>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-6 text-xs text-fg-subtle">
          <span>Groundline · built in public, free tiers only, no invented metrics.</span>
          <span>Next.js · MongoDB Atlas Vector Search · Gemini · Socket.io</span>
        </div>
      </footer>
    </div>
  );
}
