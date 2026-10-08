import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentContext } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { conversations, messages } from "@/lib/db/collections";
import { scoped, toObjectId } from "@/lib/tenant";
import { Badge, CitationChip } from "@/components/ui/badge";
import { Card, Stat } from "@/components/ui/card";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const convoId = toObjectId(id);
  if (!convoId) notFound();
  const ctx = await getCurrentContext();
  const db = await getDb();
  const convo = await conversations(db).findOne(scoped(ctx.workspace._id, { _id: convoId }));
  if (!convo) notFound();
  const list = await messages(db).find(scoped(ctx.workspace._id, { conversationId: convoId })).sort({ createdAt: 1 }).toArray();

  const answers = convo.totals.answers || 1;
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard/conversations" className="text-sm text-fg-muted hover:text-fg">
        ← Conversations
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{convo.title || "Conversation"}</h1>
          <p className="mt-1 text-xs text-fg-subtle">
            {convo.channel} · started {convo.createdAt.toLocaleString("en-GB")} · participant <code className="font-mono">{convo.participantId.slice(0, 12)}</code>
          </p>
        </div>
        <Badge tone={convo.status === "human" ? "warning" : "success"}>{convo.status === "human" ? "Human" : convo.status === "closed" ? "Closed" : "AI"}</Badge>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Messages" value={String(convo.messageCount)} />
        <Stat label="Unanswered" value={String(convo.totals.refusals)} hint={`of ${convo.totals.answers} answers`} />
        <Stat label="Cost" value={convo.totals.costUsd ? `$${convo.totals.costUsd.toFixed(4)}` : "$0"} hint={`${convo.totals.inputTokens + convo.totals.outputTokens} tokens`} />
        <Stat label="Avg latency" value={`${Math.round(convo.totals.latencyMs / answers)} ms`} />
      </section>

      <Card className="mt-8 space-y-4 p-4">
        {list.map((m) => (
          <div key={m._id.toHexString()} className={`flex ${m.role === "visitor" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[85%]">
              <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${m.role === "visitor" ? "rounded-br-sm bg-accent text-accent-fg" : m.refused ? "rounded-bl-sm bg-warning-soft text-warning" : "rounded-bl-sm bg-surface-2"}`}>
                {m.role === "agent" ? <p className="mb-0.5 text-[10px] font-medium opacity-70">Agent</p> : null}
                {m.content}
              </div>
              {m.citations?.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {m.citations.map((c) => (
                    <CitationChip key={c.n} title={`[${c.n}] ${c.title}`} detail={c.pageNumber ? `p. ${c.pageNumber}` : undefined} />
                  ))}
                </div>
              ) : null}
              {m.role === "assistant" && m.usage ? (
                <p className="mt-1 text-[11px] text-fg-subtle">
                  {m.usage.model} · {m.usage.latencyMs} ms · {m.usage.inputTokens + m.usage.outputTokens} tokens · {m.usage.costUsd === null ? "cost n/a" : `$${m.usage.costUsd.toFixed(5)}`}
                  {m.retrieval ? ` · top score ${m.retrieval.topScore?.toFixed(2) ?? "–"}` : ""}
                  {m.feedback ? ` · ${m.feedback.vote === "up" ? "👍" : "👎"}` : ""}
                  {m.error ? ` · error: ${m.error}` : ""}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
