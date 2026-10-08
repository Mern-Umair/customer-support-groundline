import type { EvalMetrics } from "@/lib/db/types";
import { Stat } from "@/components/ui/card";

const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);

/** The headline numbers of a run. Shared by the dashboard and the public page. */
export function MetricsGrid({ m }: { m: EvalMetrics }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat label="Answer accuracy" value={pct(m.accuracy)} hint={`${m.correct} correct · ${m.partial} partial · ${m.incorrect} incorrect of ${m.answerable} answerable`} />
      <Stat label="Cited the right source" value={pct(m.citationHitRate)} hint="answerable questions with an expected source" />
      <Stat label="Correct refusals" value={m.underRefusal === null ? "–" : pct(1 - m.underRefusal)} hint={`${m.unanswerable} unanswerable questions`} />
      <Stat label="Over-refusal" value={pct(m.overRefusal)} hint="answerable questions the assistant refused" />
      <Stat label="Avg latency" value={m.avgLatencyMs === null ? "–" : `${m.avgLatencyMs} ms`} hint="question to full answer" />
      <Stat label="Run cost" value={`$${m.costUsd.toFixed(4)}`} hint={`${m.cases} cases · list prices, free tier pays $0`} />
    </div>
  );
}
