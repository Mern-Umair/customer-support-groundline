import { getCurrentContext } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { chunks, conversations, sources } from "@/lib/db/collections";
import { scoped } from "@/lib/tenant";
import { ButtonLink } from "@/components/ui/button";
import { Card, Stat } from "@/components/ui/card";

const steps = [
  {
    title: "Add your first knowledge source",
    body: "Paste your website URL or upload a PDF. We crawl, chunk and index it.",
    href: "/dashboard/sources",
    status: "next",
  },
  { title: "Test answers in the playground", body: "Ask questions and check the citations before anything goes live.", href: "/dashboard/playground", status: "next" },
  { title: "Install the widget", body: "One script tag on your site. Visitors get grounded answers with a human fallback.", href: "/dashboard/settings", status: "next" },
];

export default async function DashboardOverview() {
  const { workspace } = await getCurrentContext();
  const db = await getDb();
  const since = thirtyDaysAgo();
  const [sourceCount, chunkCount, conversationCount, totals] = await Promise.all([
    sources(db).countDocuments(scoped(workspace._id)),
    chunks(db).countDocuments(scoped(workspace._id)),
    conversations(db).countDocuments(scoped(workspace._id, { lastMessageAt: { $gte: since } })),
    conversations(db)
      .aggregate<{ answers: number; refusals: number; human: number }>([
        { $match: scoped(workspace._id, { lastMessageAt: { $gte: since } }) },
        { $group: { _id: null, answers: { $sum: "$totals.answers" }, refusals: { $sum: "$totals.refusals" }, human: { $sum: { $cond: [{ $eq: ["$status", "human"] }, 1, 0] } } } },
      ])
      .next(),
  ]);
  const firstStepDone = sourceCount > 0;
  const answered = totals && totals.answers > 0 ? Math.round(((totals.answers - totals.refusals) / totals.answers) * 100) : null;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">{workspace.name}</h1>
      <p className="mt-1 text-sm text-fg-muted">
        Workspace created {workspace.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.
      </p>

      <section className="mt-8 grid gap-4 sm:grid-cols-4">
        <Stat label="Knowledge sources" value={String(sourceCount)} hint={chunkCount ? `${chunkCount} chunks indexed` : undefined} />
        <Stat label="Conversations" value={String(conversationCount)} hint="last 30 days" />
        <Stat label="Answered by AI" value={answered === null ? "–" : `${answered}%`} hint={totals ? `${totals.refusals} of ${totals.answers} answers were refusals` : "no answers yet"} />
        <Stat label="Handed to a human" value={totals ? String(totals.human) : "–"} hint="handoff arrives in week 3" />
      </section>

      <section className="mt-10">
        <h2 className="text-base font-medium">Getting started</h2>
        <ol className="mt-3 flex flex-col gap-3">
          {steps.map((step, i) => (
            <Card key={step.title} className="flex items-center gap-4 p-4">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                  i === 0 && firstStepDone ? "bg-success-soft text-success" : step.status === "next" ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-subtle"
                }`}
              >
                {i === 0 && firstStepDone ? "✓" : i + 1}
              </span>
              <div className="flex-1">
                <p className="font-medium">{step.title}</p>
                <p className="mt-0.5 text-sm text-fg-muted">{step.body}</p>
              </div>
              {step.status === "next" && step.href ? (
                <ButtonLink href={step.href} size="sm">
                  Start
                </ButtonLink>
              ) : (
                <span className="text-xs text-fg-subtle">Coming soon</span>
              )}
            </Card>
          ))}
        </ol>
      </section>

      <Card className="mt-10 p-4">
        <h2 className="text-base font-medium">Widget key</h2>
        <p className="mt-1 text-sm text-fg-muted">
          This public key identifies your workspace in the embed script. It is safe to put in your site&apos;s HTML.
        </p>
        <code className="mt-3 block rounded-md bg-surface-2 px-3 py-2 font-mono text-sm">{workspace.publicKey}</code>
      </Card>
    </div>
  );
}

function thirtyDaysAgo(): Date {
  return new Date(Date.now() - 30 * 24 * 3600 * 1000);
}
