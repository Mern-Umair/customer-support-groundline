"use client";

import { useCallback, useEffect, useState } from "react";
import { REALTIME_EVENTS, type ActionPending } from "@groundline/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { connectRealtime } from "@/lib/realtime/client";
import type { ActionDto } from "@/lib/tools/dto";

interface Props {
  conversationId: string;
  initialActions: ActionDto[];
}

/** Proposed tool calls for this conversation, with approve/reject. Refreshes on realtime alerts. */
export function ActionsPanel({ conversationId, initialActions }: Props) {
  const [actions, setActions] = useState(initialActions);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/actions?all=1&conversation=${conversationId}`);
    if (res.ok) setActions(((await res.json()) as { actions: ActionDto[] }).actions);
  }, [conversationId]);

  useEffect(() => {
    let cleanup = () => {};
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/realtime/token");
      if (!res.ok) return;
      const { url, token } = (await res.json()) as { url: string | null; token: string | null };
      if (!url || !token || cancelled) return;
      const socket = connectRealtime(url, token);
      const onPending = (a: ActionPending) => {
        if (a.conversationId === conversationId) void refresh();
      };
      socket.on(REALTIME_EVENTS.actionPending, onPending);
      cleanup = () => socket.off(REALTIME_EVENTS.actionPending, onPending);
    })();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [conversationId, refresh]);

  async function decide(id: string, decision: "approve" | "reject") {
    setBusy(id);
    const res = await fetch(`/api/actions/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision }) });
    setBusy(null);
    if (res.ok) await refresh();
  }

  if (!actions.length) return null;
  return (
    <Card className="mt-4 divide-y divide-border">
      {actions.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm" data-testid="action-row">
          <Badge tone={a.status === "pending" ? "warning" : a.status === "approved" ? "success" : a.status === "failed" ? "danger" : "neutral"} className="w-20 justify-center">
            {a.status}
          </Badge>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{a.summary}</p>
            <p className="truncate font-mono text-[11px] text-fg-subtle">
              {a.tool}({JSON.stringify(a.args)})
            </p>
            {a.result ? <p className="text-xs text-fg-muted">{a.result.summary}</p> : null}
          </div>
          {a.status === "pending" ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => decide(a.id, "approve")} disabled={busy !== null}>
                Approve
              </Button>
              <Button size="sm" variant="secondary" onClick={() => decide(a.id, "reject")} disabled={busy !== null}>
                Reject
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </Card>
  );
}
