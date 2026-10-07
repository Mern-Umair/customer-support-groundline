import Link from "next/link";
import { PLAN_LIMITS } from "@groundline/shared";
import { getCurrentContext } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { sources } from "@/lib/db/collections";
import { toSourceDto } from "@/lib/ingest/dto";
import { scoped } from "@/lib/tenant";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/card";
import { AddSourceForm } from "./add-source-form";
import { SourceStatusBadge } from "./source-status";

export default async function SourcesPage() {
  const ctx = await getCurrentContext();
  const db = await getDb();
  const list = (await sources(db).find(scoped(ctx.workspace._id)).sort({ createdAt: -1 }).toArray()).map(toSourceDto);
  const limits = PLAN_LIMITS[ctx.workspace.plan];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge sources</h1>
          <p className="mt-1 text-sm text-fg-muted">Website pages and documents the assistant is allowed to answer from.</p>
        </div>
        <Badge tone="neutral">
          {list.length} / {limits.maxSources} sources
        </Badge>
      </div>

      <div className="mt-8">
        <AddSourceForm canAdd={list.length < limits.maxSources} maxPages={limits.maxPagesPerSite} maxUploadMb={Math.round(limits.maxUploadBytes / 1024 / 1024)} />
      </div>

      <section className="mt-10">
        <h2 className="text-base font-medium">Your sources</h2>
        {list.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No sources yet" body="Add a website URL or upload a PDF above. You will see pages get crawled, chunked and indexed in real time." />
          </div>
        ) : (
          <Card className="mt-3 divide-y divide-border">
            {list.map((s) => (
              <Link key={s.id} href={`/dashboard/sources/${s.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-[10px] font-semibold uppercase text-fg-muted">
                  {s.kind === "website" ? "web" : s.kind}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="truncate text-xs text-fg-subtle">
                    {s.counts.pagesProcessed} page{s.counts.pagesProcessed === 1 ? "" : "s"} · {s.counts.chunks} chunks
                    {s.counts.pagesFailed ? ` · ${s.counts.pagesFailed} failed` : ""}
                  </p>
                </div>
                <SourceStatusBadge status={s.status} />
              </Link>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
