"use client";

import { useState } from "react";

/**
 * Turns a real unanswered question into an eval case. Owners pick: "unanswerable" (the
 * documents genuinely don't cover it, refusing was right) or "answerable" (we expect the
 * docs to cover it; the reference answer can be filled in on the Evals page later).
 */
export function AddToEvals({ question }: { question: string }) {
  const [state, setState] = useState<"idle" | "busy" | "added" | "exists" | "error">("idle");

  async function add(kind: "answerable" | "unanswerable") {
    setState("busy");
    const res = await fetch("/api/evals/cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, question }) });
    if (!res.ok) {
      setState("error");
      return;
    }
    const json = (await res.json()) as { created: number };
    setState(json.created ? "added" : "exists");
  }

  if (state === "added") return <span className="shrink-0 text-xs text-success">Added to evals</span>;
  if (state === "exists") return <span className="shrink-0 text-xs text-fg-subtle">Already in evals</span>;
  if (state === "error") return <span className="shrink-0 text-xs text-danger">Could not add</span>;
  return (
    <span className="flex shrink-0 items-center gap-1 text-[11px]" onClick={(e) => e.preventDefault()}>
      <span className="text-fg-subtle">Add to evals:</span>
      <button type="button" disabled={state === "busy"} onClick={() => add("answerable")} className="rounded border border-border px-1.5 py-0.5 hover:bg-surface-2">
        should answer
      </button>
      <button type="button" disabled={state === "busy"} onClick={() => add("unanswerable")} className="rounded border border-border px-1.5 py-0.5 hover:bg-surface-2">
        right to refuse
      </button>
    </span>
  );
}
