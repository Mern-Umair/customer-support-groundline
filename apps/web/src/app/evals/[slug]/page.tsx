import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { MetricsGrid } from "@/components/evals/metrics-grid";
import { ResultsTable } from "@/components/evals/results-table";
import { getDb } from "@/lib/db";
import { evalRuns, workspaces } from "@/lib/db/collections";
import { toResultDto } from "@/lib/evals/dto";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Evals · ${slug} · Groundline` };
}

/** Public per-question results for a workspace that opted in. Judge reasons are not shown. */
export default async function PublicEvalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await getDb();
  const ws = await workspaces(db).findOne({ slug, evalsPublic: true }, { projection: { name: 1, slug: 1 } });
  if (!ws) notFound();
  const run = await evalRuns(db).findOne({ workspaceId: ws._id, status: "done" }, { sort: { finishedAt: -1 } });

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 pb-24 pt-8">
        <Link href="/evals" className="text-sm text-fg-muted hover:text-fg">
          ← All evals
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{ws.name}</h1>
        {!run ? (
          <p className="mt-4 text-sm text-fg-muted">This workspace has not completed an eval run yet.</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-fg-subtle">
              {run.config.chatModel} ({run.config.chatProvider}) · embeddings {run.config.embedder} · judged by {run.config.judgeModel} ({run.config.judgeProvider}) · rubric {run.config.rubricVersion} · {new Date(run.finishedAt ?? run.startedAt).toLocaleString("en-GB")}
            </p>
            <div className="mt-6">
              <MetricsGrid m={run.metrics} />
            </div>
            <section className="mt-8">
              <h2 className="text-base font-medium">Per question</h2>
              <div className="mt-3">
                <ResultsTable results={run.results.map(toResultDto)} />
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
