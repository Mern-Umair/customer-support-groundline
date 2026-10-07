"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, Stat } from "@/components/ui/card";
import type { PageDto, SourceDto } from "@/lib/ingest/dto";
import { SourceStatusBadge } from "../source-status";
import { RetrievalTester } from "./retrieval-tester";

interface Props {
  initialSource: SourceDto;
  initialPages: PageDto[];
}

const ACTIVE = new Set<SourceDto["status"]>(["queued", "discovering", "processing"]);

/**
 * Drives ingestion from the browser: while the source is not finished, it calls
 * POST /process (which works for ~25s) and then refreshes the detail. This keeps
 * each server call short and lets the user watch pages get indexed.
 */
export function SourceDetail({ initialSource, initialPages }: Props) {
  const router = useRouter();
  const [source, setSource] = useState(initialSource);
  const [pages, setPages] = useState(initialPages);
  const [runError, setRunError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const running = useRef(false);

  useEffect(() => {
    if (!ACTIVE.has(source.status) || running.current) return;
    running.current = true;
    let cancelled = false;

    (async () => {
      while (!cancelled) {
        const res = await fetch(`/api/sources/${source.id}/process`, { method: "POST" });
        if (!res.ok) {
          setRunError(`Indexing stopped (HTTP ${res.status}). Reload to retry.`);
          break;
        }
        const detail = await fetch(`/api/sources/${source.id}`);
        if (!detail.ok) break;
        const json = (await detail.json()) as { source: SourceDto; pages: PageDto[] };
        if (cancelled) break;
        setSource(json.source);
        setPages(json.pages);
        if (!ACTIVE.has(json.source.status)) break;
      }
      running.current = false;
    })().catch(() => {
      setRunError("Network error while indexing. Reload to retry.");
      running.current = false;
    });

    return () => {
      cancelled = true;
    };
  }, [source.id, source.status]);

  async function remove() {
    if (!confirm(`Delete "${source.name}" and all its indexed content?`)) return;
    setDeleting(true);
    const res = await fetch(`/api/sources/${source.id}`, { method: "DELETE" });
    if (res.ok) router.push("/dashboard/sources");
    else setDeleting(false);
  }

  const total = Math.max(source.counts.pagesDiscovered, 1);
  const done = source.counts.pagesProcessed + source.counts.pagesFailed + pages.filter((p) => p.status === "skipped").length;
  const pct = Math.min(100, Math.round((done / total) * 100));
  const active = ACTIVE.has(source.status);

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{source.name}</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {source.kind === "website" && source.url ? (
              <a href={source.url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                {source.url}
              </a>
            ) : (
              `${source.kind.toUpperCase()} source`
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SourceStatusBadge status={source.status} />
          <Button variant="ghost" size="sm" onClick={remove} disabled={deleting || active}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>

      {active ? (
        <Card className="mt-6 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{source.status === "discovering" ? "Finding pages…" : `Indexing pages… ${done} of ${source.counts.pagesDiscovered}`}</span>
            <span className="tabular-nums text-fg-muted">{pct}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-fg-subtle">Each page is fetched, cleaned, split into ~512-token chunks and embedded. You can leave this page; indexing resumes when you return.</p>
        </Card>
      ) : null}

      {source.status === "failed" && source.error ? (
        <p role="alert" className="mt-6 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {source.error}
        </p>
      ) : null}
      {runError ? (
        <p role="alert" className="mt-6 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
          {runError}
        </p>
      ) : null}

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Pages found" value={String(source.counts.pagesDiscovered)} hint={`limit ${source.pageLimit}`} />
        <Stat label="Pages indexed" value={String(source.counts.pagesProcessed)} />
        <Stat label="Chunks" value={String(source.counts.chunks)} hint="~512 tokens each" />
        <Stat label="Failed" value={String(source.counts.pagesFailed)} />
      </section>

      {source.status === "ready" || source.counts.chunks > 0 ? (
        <section className="mt-10">
          <h2 className="text-base font-medium">Test retrieval</h2>
          <p className="mt-1 text-sm text-fg-muted">Ask a question and see exactly which passages the assistant would be grounded on, with similarity scores. This is the raw search, before any model writes an answer.</p>
          <div className="mt-3">
            <RetrievalTester sourceId={source.id} embeddingModel={source.embeddingModel} />
          </div>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-base font-medium">Pages</h2>
        <Card className="mt-3 divide-y divide-border">
          {pages.length === 0 ? <p className="px-4 py-6 text-center text-sm text-fg-muted">No pages yet.</p> : null}
          {pages.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <PageStatus status={p.status} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.title || p.url || "Untitled"}</p>
                {p.url ? <p className="truncate text-xs text-fg-subtle">{p.url}</p> : null}
                {p.error ? <p className="truncate text-xs text-danger">{p.error}</p> : null}
              </div>
              <span className="shrink-0 text-xs tabular-nums text-fg-subtle">{p.status === "processed" ? `${p.chunkCount} chunks` : ""}</span>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}

function PageStatus({ status }: { status: PageDto["status"] }) {
  const tone = status === "processed" ? "success" : status === "failed" ? "danger" : status === "skipped" ? "warning" : "neutral";
  return (
    <Badge tone={tone} className="w-20 justify-center">
      {status}
    </Badge>
  );
}
