import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentContext } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { conversations, messages } from "@/lib/db/collections";
import { scoped, toObjectId } from "@/lib/tenant";
import { Stat } from "@/components/ui/card";
import { LiveThread, type ThreadMessage } from "./live-thread";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const convoId = toObjectId(id);
  if (!convoId) notFound();
  const ctx = await getCurrentContext();
  const db = await getDb();
  const convo = await conversations(db).findOne(scoped(ctx.workspace._id, { _id: convoId }));
  if (!convo) notFound();
  const list = await messages(db).find(scoped(ctx.workspace._id, { conversationId: convoId })).sort({ createdAt: 1 }).toArray();

  const thread: ThreadMessage[] = list.map((m) => ({
    id: m._id.toHexString(),
    role: m.role,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    citations: m.citations?.map((c) => ({ n: c.n, title: c.title, url: c.url, pageNumber: c.pageNumber })),
    refused: m.refused,
    meta:
      m.role === "assistant" && m.usage
        ? `${m.usage.model} · ${m.usage.latencyMs} ms · ${m.usage.inputTokens + m.usage.outputTokens} tokens · ${m.usage.costUsd === null ? "cost n/a" : `$${m.usage.costUsd.toFixed(5)}`}${m.retrieval ? ` · top score ${m.retrieval.topScore?.toFixed(2) ?? "–"}` : ""}${m.feedback ? ` · ${m.feedback.vote === "up" ? "👍" : "👎"}` : ""}${m.error ? ` · error: ${m.error}` : ""}`
        : undefined,
  }));

  const answers = convo.totals.answers || 1;
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard/conversations" className="text-sm text-fg-muted hover:text-fg">
        ← Conversations
      </Link>
      <div className="mt-3 min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight">{convo.title || "Conversation"}</h1>
        <p className="mt-1 text-xs text-fg-subtle">
          {convo.channel} · started {convo.createdAt.toLocaleString("en-GB")} · participant <code className="font-mono">{convo.participantId.slice(0, 12)}</code>
          {convo.handoff ? ` · handoff requested ${convo.handoff.requestedAt.toLocaleTimeString("en-GB")} (${convo.handoff.reason.replace("_", " ")})` : ""}
        </p>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Messages" value={String(convo.messageCount)} />
        <Stat label="Unanswered" value={String(convo.totals.refusals)} hint={`of ${convo.totals.answers} answers`} />
        <Stat label="Cost" value={convo.totals.costUsd ? `$${convo.totals.costUsd.toFixed(4)}` : "$0"} hint={`${convo.totals.inputTokens + convo.totals.outputTokens} tokens`} />
        <Stat label="Avg latency" value={`${Math.round(convo.totals.latencyMs / answers)} ms`} />
      </section>

      <div className="mt-8">
        <LiveThread conversationId={convo._id.toHexString()} initialStatus={convo.status} initialMessages={thread} agentName={ctx.user.name} />
      </div>
    </div>
  );
}
