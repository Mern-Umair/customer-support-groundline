"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MetricsGrid } from "@/components/evals/metrics-grid";
import { ResultsTable } from "@/components/evals/results-table";
import type { EvalResultDto, EvalRunDto } from "@/lib/evals/dto";

interface Props {
  initialRun: EvalRunDto;
  initialResults: EvalResultDto[];
}

/** Drives a run from the browser (POST /process until done) and shows results as they land. */
export function RunView({ initialRun, initialResults }: Props) {
  const [run, setRun] = useState(initialRun);
  const [results, setResults] = useState(initialResults);
  const [error, setError] = useState<string | null>(null);
  const driving = useRef(false);

  useEffect(() => {
    if (run.status !== "running" || driving.current) return;
    driving.current = true;
    let cancelled = false;
    (async () => {
      while (!cancelled) {
        const p = await fetch(`/api/evals/runs/${run.id}/process`, { method: "POST" });
        if (!p.ok) {
          setError(`Run stopped (HTTP ${p.status}). Reload to resume.`);
          break;
        }
        const d = await fetch(`/api/evals/runs/${run.id}`);
        if (!d.ok) break;
        const json = (await d.json()) as { run: EvalRunDto; results: EvalResultDto[] };
        if (cancelled) break;
        setRun(json.run);
        setResults(json.results);
        if (json.run.status !== "running") break;
      }
      driving.current = false;
    })().catch(() => {
      setError("Network error. Reload to resume.");
      driving.current = false;
    });
    return () => {
      cancelled = true;
    };
  }, [run.id, run.status]);

  const pctDone = run.total ? Math.round((run.done / run.total) * 100) : 0;

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Eval run</h1>
        <Badge tone={run.status === "done" ? "success" : run.status === "running" ? "accent" : "danger"}>{run.status}</Badge>
      </div>
      <p className="mt-1 text-xs text-fg-subtle">
        {run.config.chatModel} ({run.config.chatProvider}) · embeddings {run.config.embedder} · judged by {run.config.judgeModel} ({run.config.judgeProvider}) · rubric {run.config.rubricVersion} · started {new Date(run.startedAt).toLocaleString("en-GB")}
      </p>

      {run.status === "running" ? (
        <Card className="mt-4 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              Evaluating… {run.done} of {run.total}
            </span>
            <span className="tabular-nums text-fg-muted">{pctDone}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pctDone}%` }} />
          </div>
        </Card>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
          {error}
        </p>
      ) : null}

      <div className="mt-6">
        <MetricsGrid m={run.metrics} />
      </div>

      <section className="mt-8">
        <h2 className="text-base font-medium">Per case</h2>
        <div className="mt-3">
          <ResultsTable results={results} showReasons />
        </div>
      </section>
    </div>
  );
}
