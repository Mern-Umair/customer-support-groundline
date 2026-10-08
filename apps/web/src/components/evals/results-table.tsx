import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { EvalResultDto } from "@/lib/evals/dto";

function outcome(r: EvalResultDto): { label: string; tone: "success" | "warning" | "danger" | "neutral" } {
  if (r.error) return { label: "error", tone: "danger" };
  if (r.kind === "unanswerable") return r.refused ? { label: "refused ✓", tone: "success" } : { label: "answered ✗", tone: "danger" };
  if (r.refused) return { label: "refused ✗", tone: "danger" };
  if (r.verdict === "correct") return { label: "correct", tone: "success" };
  if (r.verdict === "partial") return { label: "partial", tone: "warning" };
  if (r.verdict === "incorrect") return { label: "incorrect", tone: "danger" };
  return { label: "unjudged", tone: "neutral" };
}

export function ResultsTable({ results, showReasons = false }: { results: EvalResultDto[]; showReasons?: boolean }) {
  if (!results.length) return <Card className="p-4 text-sm text-fg-muted">No results yet.</Card>;
  return (
    <Card className="divide-y divide-border">
      {results.map((r) => {
        const o = outcome(r);
        return (
          <details key={r.caseId} className="group px-4 py-2.5 text-sm">
            <summary className="flex cursor-pointer list-none items-center gap-3">
              <Badge tone={o.tone} className="w-24 shrink-0 justify-center">
                {o.label}
              </Badge>
              <span className="min-w-0 flex-1 truncate font-medium">{r.question}</span>
              {r.kind === "answerable" && r.citedExpected !== null ? <span className={`shrink-0 text-[11px] ${r.citedExpected ? "text-success" : "text-warning"}`}>{r.citedExpected ? "source ✓" : "source ✗"}</span> : null}
              <span className="shrink-0 text-xs tabular-nums text-fg-subtle">{r.latencyMs} ms</span>
            </summary>
            <div className="mt-2 space-y-1.5 pl-1 text-xs text-fg-muted">
              <p>
                <span className="font-medium text-fg">Answer:</span> {r.answer || <em>(empty)</em>}
              </p>
              {r.expectedAnswer ? (
                <p>
                  <span className="font-medium text-fg">Reference:</span> {r.expectedAnswer}
                </p>
              ) : null}
              {r.citedTitles.length ? (
                <p>
                  <span className="font-medium text-fg">Cited:</span> {r.citedTitles.join(", ")}
                  {r.expectedSource ? ` (expected: ${r.expectedSource})` : ""}
                </p>
              ) : null}
              {showReasons && r.judgeReason ? (
                <p>
                  <span className="font-medium text-fg">Judge:</span> {r.judgeReason}
                </p>
              ) : null}
              {r.error ? <p className="text-danger">{r.error}</p> : null}
              <p className="text-fg-subtle">
                top retrieval score {r.topScore?.toFixed(2) ?? "–"} · {r.costUsd === null ? "cost n/a" : `$${r.costUsd.toFixed(5)}`}
              </p>
            </div>
          </details>
        );
      })}
    </Card>
  );
}
