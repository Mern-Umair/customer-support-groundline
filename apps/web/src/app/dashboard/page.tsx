import Link from "next/link";
import { getCurrentContext } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { chunks, sources } from "@/lib/db/collections";
import { getInsights } from "@/lib/insights";
import { scoped } from "@/lib/tenant";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, Stat } from "@/components/ui/card";
import { DailyBars } from "@/components/charts/daily-bars";

const steps = [
  { title: "Add your first knowledge source", body: "Paste your website URL or upload a PDF. We crawl, chunk and index it.", href: "/dashboard/sources" },
  { title: "Test answers in the playground", body: "Ask questions and check the citations before anything goes live.", href: "/dashboard/playground" },
  { title: "Install the widget", body: "One script tag on your site. Visitors get grounded answers with a human fallback.", href: "/dashboard/settings" },
];

export default async function DashboardOverview() {
  const { workspace } = await getCurrentContext();
  const db = await getDb();
  const [sourceCount, chunkCount, insights] = await Promise.all([
    sources(db).countDocuments(scoped(workspace._id)),
    chunks(db).countDocuments(scoped(workspace._id)),
    getInsights(db, workspace._id, 30),
  ]);
  const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{workspace.name}</h1>
          <p className="mt-1 text-sm text-fg-muted">Last 30 days. Every number comes from stored conversations; nothing is estimated except model cost, which uses published list prices.</p>
        </div>
        <Badge tone="neutral">
          {sourceCount} source{sourceCount === 1 ? "" : "s"} · {chunkCount} chunks
        </Badge>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Conversations" value={String(insights.conversations)} hint={`${insights.answers} answers`} />
        <Stat label="Answered by AI" value={pct(insights.answeredRate)} hint={insights.answers ? `${insights.refusals} refusal${insights.refusals === 1 ? "" : "s"}` : "no answers yet"} />
        <Stat label="Handed to a human" value={String(insights.handoffs)} hint="asked for a person or unanswerable" />
        <Stat label="Avg latency" value={insights.avgLatencyMs === null ? "–" : `${insights.avgLatencyMs} ms`} hint="question to full answer" />
        <Stat label="Model cost" value={`$${insights.costUsd.toFixed(4)}`} hint={`${insights.tokens.toLocaleString()} tokens · free tier pays $0`} />
        <Stat label="Feedback score" value={pct(insights.feedback.score)} hint={`${insights.feedback.up} 👍 · ${insights.feedback.down} 👎`} />
      </section>

      <Card className="mt-6 p-4">
        <DailyBars data={insights.daily} />
      </Card>

      <section className="mt-8">
        <div className="flex items-end justify-between">
          <h2 className="text-base font-medium">Unanswered questions</h2>
          <span className="text-xs text-fg-subtle">What visitors asked that the documents could not answer</span>
        </div>
        {insights.unanswered.length === 0 ? (
          <Card className="mt-3 p-4 text-sm text-fg-muted">Nothing yet. When the assistant refuses a question it shows up here, so you know what to add to your knowledge sources.</Card>
        ) : (
          <Card className="mt-3 divide-y divide-border">
            {insights.unanswered.map((q) => (
              <Link key={q.messageId} href={`/dashboard/conversations/${q.conversationId}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-2">
                <Badge tone={q.channel === "widget" ? "accent" : "neutral"}>{q.channel}</Badge>
                <span className="min-w-0 flex-1 truncate">{q.question}</span>
                <span className="shrink-0 text-xs text-fg-subtle">{new Date(q.askedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
              </Link>
            ))}
          </Card>
        )}
      </section>

      {sourceCount === 0 || insights.conversations === 0 ? (
        <section className="mt-10">
          <h2 className="text-base font-medium">Getting started</h2>
          <ol className="mt-3 flex flex-col gap-3">
            {steps.map((step, i) => {
              const done = (i === 0 && sourceCount > 0) || (i === 1 && insights.conversations > 0);
              return (
                <Card key={step.title} className="flex items-center gap-4 p-4">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-medium ${done ? "bg-success-soft text-success" : "bg-accent text-accent-fg"}`}>{done ? "✓" : i + 1}</span>
                  <div className="flex-1">
                    <p className="font-medium">{step.title}</p>
                    <p className="mt-0.5 text-sm text-fg-muted">{step.body}</p>
                  </div>
                  <ButtonLink href={step.href} size="sm" variant={done ? "secondary" : "primary"}>
                    {done ? "Open" : "Start"}
                  </ButtonLink>
                </Card>
              );
            })}
          </ol>
        </section>
      ) : null}

      <Card className="mt-10 p-4">
        <h2 className="text-base font-medium">Widget key</h2>
        <p className="mt-1 text-sm text-fg-muted">
          This public key identifies your workspace in the embed script. It is safe to put in your site&apos;s HTML. Install snippet under <Link href="/dashboard/settings" className="underline-offset-4 hover:underline">Settings</Link>.
        </p>
        <code className="mt-3 block rounded-md bg-surface-2 px-3 py-2 font-mono text-sm">{workspace.publicKey}</code>
      </Card>
    </div>
  );
}
