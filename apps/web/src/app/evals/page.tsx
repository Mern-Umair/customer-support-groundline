import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Evals · Groundline" };

const metrics = [
  { label: "Answer accuracy", body: "Share of test questions answered correctly, judged against a reference answer." },
  { label: "Citation precision", body: "Share of answers whose cited source actually contains the supporting passage." },
  { label: "Correct refusals", body: "Share of unanswerable questions where the assistant declined instead of guessing." },
];

export default function EvalsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-24 pt-8">
        <h1 className="text-3xl font-semibold tracking-tight">Eval numbers</h1>
        <p className="mt-3 text-fg-muted">
          This page will publish results from a fixed test set run against the demo workspace. Nothing appears here until
          the eval runner exists (planned for week 5). No placeholder numbers.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {metrics.map((m) => (
            <Card key={m.label} className="p-4">
              <p className="text-xs text-fg-muted">{m.label}</p>
              <p className="mt-1 text-2xl font-semibold text-fg-subtle">–</p>
              <p className="mt-2 text-xs leading-relaxed text-fg-muted">{m.body}</p>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
