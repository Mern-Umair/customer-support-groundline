"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Badge, CitationChip } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { RetrievedChunk } from "@/lib/ingest/retrieval";

interface Props {
  sourceId?: string;
  embeddingModel: string;
}

export function RetrievalTester({ sourceId, embeddingModel }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RetrievedChunk[] | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/retrieval/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, sourceId, k: 5 }),
      });
      const json = (await res.json()) as { results?: RetrievedChunk[]; latencyMs?: number; error?: string };
      if (!res.ok) {
        setError(json.error ?? "Search failed");
        return;
      }
      setResults(json.results ?? []);
      setLatency(json.latencyMs ?? null);
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-4">
      <form onSubmit={run} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Can I return sale items?"
          aria-label="Test question"
          className="h-10 flex-1 rounded-md border border-border-strong bg-surface px-3 text-sm outline-none placeholder:text-fg-subtle focus:border-accent focus:ring-2 focus:ring-accent/25"
        />
        <Button type="submit" disabled={pending || query.trim().length < 2}>
          {pending ? "Searching…" : "Search"}
        </Button>
      </form>
      <p className="mt-2 text-xs text-fg-subtle">
        Embeddings: <code className="font-mono">{embeddingModel}</code>
        {embeddingModel.startsWith("fake") ? " · offline test embedder (set GEMINI_API_KEY for real semantic search)" : ""}
        {latency !== null ? ` · ${latency} ms` : ""}
      </p>

      {error ? (
        <p role="alert" className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {results ? (
        <ol className="mt-4 flex flex-col gap-3">
          {results.length === 0 ? <li className="text-sm text-fg-muted">No matching passages. If indexing just finished, the vector index can take a minute to catch up.</li> : null}
          {results.map((r, i) => (
            <li key={r.chunkId} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Badge tone="neutral">#{i + 1}</Badge>
                  <CitationChip title={r.title || r.url || "source"} detail={r.pageNumber ? `p. ${r.pageNumber}` : undefined} />
                </div>
                <span className="shrink-0 font-mono text-xs tabular-nums text-fg-muted">{r.score.toFixed(3)}</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(r.score * 100)}%` }} />
              </div>
              <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-fg-muted">{r.text}</p>
            </li>
          ))}
        </ol>
      ) : null}
    </Card>
  );
}
