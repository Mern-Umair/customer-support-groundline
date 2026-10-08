import type { EvalMetrics, EvalResultDoc } from "../db/types";

/** Case-insensitive substring match of the expected source against cited titles/urls. */
export function citedExpectedSource(expectedSource: string | undefined, cited: { title: string; url?: string }[]): boolean | null {
  if (!expectedSource) return null;
  const needle = expectedSource.trim().toLowerCase();
  if (!needle) return null;
  return cited.some((c) => c.title.toLowerCase().includes(needle) || (c.url ?? "").toLowerCase().includes(needle));
}

const ratio = (num: number, den: number): number | null => (den > 0 ? num / den : null);

/** Aggregates per-case results into the run's headline numbers. Pure; unit-tested. */
export function computeMetrics(results: EvalResultDoc[]): EvalMetrics {
  const answerable = results.filter((r) => r.kind === "answerable");
  const unanswerable = results.filter((r) => r.kind === "unanswerable");
  const correct = answerable.filter((r) => r.verdict === "correct").length;
  const partial = answerable.filter((r) => r.verdict === "partial").length;
  const incorrect = answerable.filter((r) => r.verdict === "incorrect").length;
  const withSource = answerable.filter((r) => !r.refused && r.citedExpected !== null);
  const latencies = results.filter((r) => !r.error).map((r) => r.latencyMs);

  return {
    cases: results.length,
    answerable: answerable.length,
    unanswerable: unanswerable.length,
    correct,
    partial,
    incorrect,
    accuracy: ratio(correct, answerable.length),
    accuracyLenient: ratio(correct + partial, answerable.length),
    citationHitRate: ratio(withSource.filter((r) => r.citedExpected === true).length, withSource.length),
    overRefusal: ratio(answerable.filter((r) => r.refused).length, answerable.length),
    underRefusal: ratio(unanswerable.filter((r) => !r.refused).length, unanswerable.length),
    avgLatencyMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
    costUsd: results.reduce((s, r) => s + (r.costUsd ?? 0), 0),
  };
}

export const emptyMetrics = (): EvalMetrics => computeMetrics([]);
