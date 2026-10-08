import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { MetricsGrid } from "@/components/evals/metrics-grid";
import { getDb } from "@/lib/db";
import { evalRuns, workspaces } from "@/lib/db/collections";

export const metadata: Metadata = { title: "Evals · Groundline" };
export const dynamic = "force-dynamic";

const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);

/** Public results: every workspace that opted in, with its latest finished run. */
export default async function EvalsIndexPage() {
  const db = await getDb();
  const publicWs = await workspaces(db).find({ evalsPublic: true }, { projection: { name: 1, slug: 1 } }).limit(50).toArray();
  const rows = await Promise.all(
    publicWs.map(async (ws) => {
      const run = await evalRuns(db).findOne({ workspaceId: ws._id, status: "done" }, { projection: { results: 0 }, sort: { finishedAt: -1 } });
      return { ws, run };
    }),
  );
  const withRuns = rows.filter((r) => r.run);
  const featured = withRuns[0];

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 pb-24 pt-8">
        <h1 className="text-3xl font-semibold tracking-tight">Eval numbers</h1>
        <p className="mt-3 max-w-2xl text-fg-muted">
          Each workspace below opted to publish its latest eval run: a fixed set of questions with reference answers, asked to the live assistant. Refusals and citations are checked deterministically; a judge model grades correctness with a pinned rubric. No number here is typed in by hand.
        </p>

        {featured?.run ? (
          <section className="mt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-medium">{featured.ws.name}</h2>
              <Link href={`/evals/${featured.ws.slug}`} className="text-sm text-accent underline-offset-4 hover:underline">
                Per-question results →
              </Link>
            </div>
            <p className="mb-4 text-xs text-fg-subtle">
              {featured.run.config.chatModel} judged by {featured.run.config.judgeModel} · rubric {featured.run.config.rubricVersion} · {featured.run.metrics.cases} cases · {new Date(featured.run.finishedAt ?? featured.run.startedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
            <MetricsGrid m={featured.run.metrics} />
          </section>
        ) : (
          <Card className="mt-8 p-6 text-sm text-fg-muted">No workspace has published a run yet. Numbers appear here the moment one does; there are no placeholders.</Card>
        )}

        {withRuns.length > 1 ? (
          <section className="mt-10">
            <h2 className="text-base font-medium">All published workspaces</h2>
            <Card className="mt-3 divide-y divide-border">
              {withRuns.map(({ ws, run }) => (
                <Link key={ws.slug} href={`/evals/${ws.slug}`} className="flex items-center gap-4 px-4 py-3 text-sm hover:bg-surface-2">
                  <span className="min-w-0 flex-1 truncate font-medium">{ws.name}</span>
                  <span className="text-xs text-fg-muted">
                    accuracy {pct(run!.metrics.accuracy)} · source {pct(run!.metrics.citationHitRate)} · refusals {run!.metrics.underRefusal === null ? "–" : pct(1 - run!.metrics.underRefusal)}
                  </span>
                </Link>
              ))}
            </Card>
          </section>
        ) : null}

        <section className="mt-10 text-sm text-fg-muted">
          <h2 className="text-base font-medium text-fg">How the numbers are produced</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Answer accuracy: share of answerable questions the judge marked “correct” (every key fact present, nothing contradicting). “Partial” answers do not count.</li>
            <li>Cited the right source: share of answered answerable questions whose citations include the expected document.</li>
            <li>Correct refusals: share of unanswerable questions where the assistant declined instead of guessing. Over-refusal is the mirror on answerable questions.</li>
            <li>The judge is a different model family from the one under test when keys for both exist, to limit self-preference. Unparseable judge output counts as incorrect, never as missing.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
