"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { EvalCaseDto, EvalRunDto } from "@/lib/evals/dto";

interface Props {
  initialCases: EvalCaseDto[];
  initialRuns: EvalRunDto[];
  evalsPublic: boolean;
  slug: string;
  isOwner: boolean;
  config: { chat: string; judge: string; offline: boolean };
}

const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);
const inputClass = "h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-accent focus:ring-2 focus:ring-accent/25";

export function EvalsPanel({ initialCases, initialRuns, evalsPublic, slug, isOwner, config }: Props) {
  const router = useRouter();
  const [cases, setCases] = useState(initialCases);
  const runs = initialRuns;
  const [isPublic, setIsPublic] = useState(evalsPublic);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  async function refreshCases() {
    const res = await fetch("/api/evals/cases");
    if (res.ok) setCases(((await res.json()) as { cases: EvalCaseDto[] }).cases);
  }

  async function addCase(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formEl = e.currentTarget; // null after the first await, so capture it now
    const form = new FormData(formEl);
    const body = {
      kind: String(form.get("kind")),
      question: String(form.get("question") ?? ""),
      expectedAnswer: String(form.get("expectedAnswer") ?? ""),
      expectedSource: String(form.get("expectedSource") ?? ""),
    };
    setBusy("add");
    const res = await fetch("/api/evals/cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    if (!res.ok) {
      setError(((await res.json()) as { error?: string }).error ?? "Could not add case");
      return;
    }
    formEl.reset();
    await refreshCases();
  }

  async function importCases() {
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(importText);
    } catch {
      setError("Import must be a JSON array of cases");
      return;
    }
    setBusy("import");
    const res = await fetch("/api/evals/cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed) });
    setBusy(null);
    if (!res.ok) {
      setError(((await res.json()) as { error?: string }).error ?? "Import failed");
      return;
    }
    setImportText("");
    setShowImport(false);
    await refreshCases();
  }

  async function removeCase(id: string) {
    await fetch(`/api/evals/cases/${id}`, { method: "DELETE" });
    setCases((c) => c.filter((x) => x.id !== id));
  }

  async function loadDemo() {
    setError(null);
    setBusy("demo");
    const res = await fetch("/api/evals/demo", { method: "POST" });
    setBusy(null);
    if (!res.ok) {
      setError(((await res.json()) as { error?: string }).error ?? "Could not load the demo set");
      return;
    }
    await refreshCases();
    router.refresh();
  }

  async function startRun() {
    setError(null);
    setBusy("run");
    const res = await fetch("/api/evals/runs", { method: "POST" });
    setBusy(null);
    const json = (await res.json()) as { run?: EvalRunDto; error?: string };
    if (!res.ok || !json.run) {
      setError(json.error ?? "Could not start a run");
      return;
    }
    router.push(`/dashboard/evals/runs/${json.run.id}`);
  }

  async function togglePublic(next: boolean) {
    setIsPublic(next); // optimistic; reverted if the server refuses
    const res = await fetch("/api/workspace", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ evalsPublic: next }) });
    if (!res.ok) {
      setIsPublic(!next);
      setError("Could not update the public setting");
    }
  }

  const answerable = cases.filter((c) => c.kind === "answerable").length;

  return (
    <div className="mt-6 space-y-8">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge tone={config.offline ? "warning" : "accent"}>under test: {config.chat}</Badge>
        <Badge tone={config.offline ? "warning" : "neutral"}>judge: {config.judge}</Badge>
        {config.offline ? <span className="text-warning">Offline stand-ins are active; numbers from this configuration are not meaningful.</span> : null}
      </div>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-medium">Test set</h2>
            <p className="text-xs text-fg-subtle">
              {cases.length} cases · {answerable} answerable · {cases.length - answerable} unanswerable
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={loadDemo} disabled={busy !== null}>
              {busy === "demo" ? "Loading…" : "Load demo set (Ali Shoes)"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowImport((s) => !s)}>
              Import JSON
            </Button>
            <Button size="sm" onClick={startRun} disabled={busy !== null || cases.length === 0}>
              {busy === "run" ? "Starting…" : "Run evals"}
            </Button>
          </div>
        </div>

        {error ? (
          <p role="alert" className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        {showImport ? (
          <Card className="mt-3 p-4">
            <p className="text-xs text-fg-muted">
              Paste a JSON array: <code className="font-mono">[{`{"kind":"answerable","question":"…","expectedAnswer":"…","expectedSource":"Returns"}`}]</code>
            </p>
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={6} className={`${inputClass} mt-2 h-auto py-2 font-mono text-xs`} />
            <div className="mt-2 flex justify-end">
              <Button size="sm" onClick={importCases} disabled={busy !== null || !importText.trim()}>
                Import
              </Button>
            </div>
          </Card>
        ) : null}

        <Card className="mt-3 p-4">
          <form onSubmit={addCase} className="grid gap-3 sm:grid-cols-[120px_1fr]">
            <select name="kind" className={inputClass} aria-label="Kind">
              <option value="answerable">Answerable</option>
              <option value="unanswerable">Unanswerable</option>
            </select>
            <input name="question" required placeholder="Question a visitor would ask" className={inputClass} aria-label="Question" />
            <input name="expectedSource" placeholder="Expected source (title or URL part)" className={inputClass} aria-label="Expected source" />
            <input name="expectedAnswer" placeholder="Reference answer (answerable cases)" className={inputClass} aria-label="Reference answer" />
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" size="sm" variant="secondary" disabled={busy !== null}>
                Add case
              </Button>
            </div>
          </form>
        </Card>

        {cases.length ? (
          <Card className="mt-3 divide-y divide-border">
            {cases.map((c) => (
              <div key={c.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                <Badge tone={c.kind === "answerable" ? "accent" : "warning"} className="mt-0.5 w-28 shrink-0 justify-center">
                  {c.kind}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.question}</p>
                  {c.expectedAnswer ? <p className="truncate text-xs text-fg-muted">→ {c.expectedAnswer}</p> : null}
                  {c.expectedSource ? <p className="text-[11px] text-fg-subtle">source: {c.expectedSource}</p> : null}
                </div>
                <button type="button" onClick={() => removeCase(c.id)} aria-label={`Delete case: ${c.question}`} className="text-fg-subtle hover:text-danger">
                  ✕
                </button>
              </div>
            ))}
          </Card>
        ) : null}
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-base font-medium">Runs</h2>
          {isOwner ? (
            <label className="flex items-center gap-2 text-xs text-fg-muted">
              <input type="checkbox" checked={isPublic} onChange={(e) => togglePublic(e.target.checked)} className="accent-accent" />
              Publish latest run at{" "}
              <Link href={`/evals/${slug}`} className="font-mono underline-offset-4 hover:underline" target="_blank">
                /evals/{slug}
              </Link>
            </label>
          ) : null}
        </div>
        {runs.length === 0 ? (
          <Card className="mt-3 p-4 text-sm text-fg-muted">No runs yet. Add cases (or load the demo set) and press Run evals.</Card>
        ) : (
          <Card className="mt-3 divide-y divide-border">
            {runs.map((r) => (
              <Link key={r.id} href={`/dashboard/evals/runs/${r.id}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3 text-sm hover:bg-surface-2">
                <Badge tone={r.status === "done" ? "success" : r.status === "running" ? "accent" : "danger"}>{r.status}</Badge>
                <div className="min-w-0">
                  <p className="truncate">
                    accuracy {pct(r.metrics.accuracy)} · cited right source {pct(r.metrics.citationHitRate)} · correct refusals {r.metrics.underRefusal === null ? "–" : pct(1 - r.metrics.underRefusal)} · over-refusal {pct(r.metrics.overRefusal)}
                  </p>
                  <p className="truncate text-xs text-fg-subtle">
                    {r.config.chatModel} judged by {r.config.judgeModel} · {r.done}/{r.total} cases · {new Date(r.startedAt).toLocaleString("en-GB")}
                  </p>
                </div>
                <span className="text-xs text-fg-subtle">{r.metrics.avgLatencyMs === null ? "" : `${r.metrics.avgLatencyMs} ms`}</span>
              </Link>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
