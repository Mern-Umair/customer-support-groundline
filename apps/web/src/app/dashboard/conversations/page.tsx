import Link from "next/link";
import { getCurrentContext } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { conversations } from "@/lib/db/collections";
import { scoped } from "@/lib/tenant";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

function relative(d: Date): string {
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function ConversationsPage() {
  const ctx = await getCurrentContext();
  const db = await getDb();
  const list = await conversations(db).find(scoped(ctx.workspace._id)).sort({ lastMessageAt: -1 }).limit(100).toArray();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">Conversations</h1>
      <p className="mt-1 text-sm text-fg-muted">Every chat from the widget and the playground, with what it cost and whether the AI could answer.</p>

      {list.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No conversations yet"
            body="Try the playground, or install the widget on your site. Each chat shows up here with its citations, feedback and cost."
            action={
              <ButtonLink href="/dashboard/playground" size="sm">
                Open the playground
              </ButtonLink>
            }
          />
        </div>
      ) : (
        <Card className="mt-8 divide-y divide-border">
          {list.map((c) => {
            const refusalRate = c.totals.answers ? c.totals.refusals / c.totals.answers : 0;
            return (
              <Link key={c._id.toHexString()} href={`/dashboard/conversations/${c._id.toHexString()}`} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-2">
                <Badge tone={c.channel === "widget" ? "accent" : "neutral"} className="w-24 justify-center">
                  {c.channel}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.title || "Untitled"}</p>
                  <p className="truncate text-xs text-fg-subtle">
                    {c.messageCount} messages · {c.totals.refusals ? `${c.totals.refusals} unanswered · ` : ""}
                    {c.totals.costUsd ? `$${c.totals.costUsd.toFixed(4)}` : "$0"} · {c.totals.answers ? `${Math.round(c.totals.latencyMs / c.totals.answers)} ms avg` : ""}
                  </p>
                </div>
                <StatusBadge status={c.status} refusalRate={refusalRate} />
                <span className="w-20 shrink-0 text-right text-xs text-fg-subtle">{relative(c.lastMessageAt)}</span>
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status, refusalRate }: { status: "ai" | "human" | "closed"; refusalRate: number }) {
  if (status === "human") return <Badge tone="warning">Human</Badge>;
  if (status === "closed") return <Badge tone="neutral">Closed</Badge>;
  return refusalRate > 0 ? <Badge tone="warning">AI · gaps</Badge> : <Badge tone="success">AI</Badge>;
}
