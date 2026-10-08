"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { LiveMessage, StatusChanged } from "@groundline/shared";
import { Button } from "@/components/ui/button";
import { Badge, CitationChip } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SystemNote } from "@/components/chat/chat-panel";
import { useLiveConversation } from "@/components/chat/use-live-conversation";

export interface ThreadMessage {
  id: string;
  role: "visitor" | "assistant" | "agent" | "system";
  content: string;
  createdAt: string;
  citations?: { n: number; title: string; url?: string; pageNumber?: number }[];
  refused?: boolean;
  meta?: string;
}

interface Props {
  conversationId: string;
  initialStatus: "ai" | "human" | "closed";
  initialMessages: ThreadMessage[];
  agentName: string;
}

export function LiveThread({ conversationId, initialStatus, initialMessages, agentName }: Props) {
  const [status, setStatus] = useState<"ai" | "human" | "closed">(initialStatus);
  const [list, setList] = useState<ThreadMessage[]>(initialMessages);
  const [realtime, setRealtime] = useState<{ url: string; token: string } | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const seen = useRef(new Set(initialMessages.map((m) => m.id)));
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/realtime/token")
      .then((r) => r.json())
      .then((j: { url: string | null; token: string | null }) => {
        if (j.url && j.token) setRealtime({ url: j.url, token: j.token });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [list]);

  const onMessage = useCallback((m: LiveMessage) => {
    if (seen.current.has(m.id)) return;
    seen.current.add(m.id);
    setList((l) => [...l, { id: m.id, role: m.role, content: m.content, createdAt: m.createdAt }]);
  }, []);
  const onStatus = useCallback((s: StatusChanged) => setStatus(s.status), []);

  const { connected } = useLiveConversation({
    conversationId,
    realtime,
    joinAsAgent: true,
    pollUrl: (after) => `/api/conversations/${conversationId}/messages${after ? `?after=${after}` : ""}`,
    status,
    lastMessageId: list[list.length - 1]?.id,
    onMessage,
    onStatus,
  });

  async function setConversationStatus(next: "ai" | "human" | "closed") {
    const res = await fetch(`/api/conversations/${conversationId}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next }) });
    if (res.ok) setStatus(next);
  }

  async function sendReply(e: FormEvent) {
    e.preventDefault();
    const content = reply.trim();
    if (!content || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content }) });
      if (res.ok) {
        const { message } = (await res.json()) as { message: LiveMessage };
        onMessage(message);
        setStatus("human");
        setReply("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={status === "human" ? "warning" : status === "closed" ? "neutral" : "success"}>{status === "human" ? "Human" : status === "closed" ? "Closed" : "AI"}</Badge>
        <span className="text-[11px] text-fg-subtle" data-testid="thread-live">
          {realtime ? (connected ? "live" : "polling") : "realtime not configured"}
        </span>
        <span className="flex-1" />
        {status !== "human" ? (
          <Button size="sm" variant="secondary" onClick={() => setConversationStatus("human")}>
            Take over
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setConversationStatus("ai")}>
            Hand back to AI
          </Button>
        )}
        {status !== "closed" ? (
          <Button size="sm" variant="ghost" onClick={() => setConversationStatus("closed")}>
            Close
          </Button>
        ) : null}
      </div>

      <Card className="mt-4 flex h-[min(60vh,560px)] flex-col">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {list.map((m) =>
            m.role === "system" ? (
              <SystemNote key={m.id} text={m.content} />
            ) : (
              <div key={m.id} className={`flex ${m.role === "visitor" ? "justify-start" : "justify-end"}`}>
                <div className="max-w-[85%]">
                  {m.role !== "visitor" ? <p className={`mb-0.5 text-right text-[10px] font-medium ${m.role === "agent" ? "text-accent" : "text-fg-subtle"}`}>{m.role === "agent" ? "Agent" : "Assistant"}</p> : null}
                  <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${m.role === "visitor" ? "rounded-bl-sm bg-surface-2" : m.refused ? "rounded-br-sm bg-warning-soft text-warning" : m.role === "agent" ? "rounded-br-sm bg-accent text-accent-fg" : "rounded-br-sm border border-border bg-surface"}`}>
                    {m.content}
                  </div>
                  {m.citations?.length ? (
                    <div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
                      {m.citations.map((c) => (
                        <CitationChip key={c.n} title={`[${c.n}] ${c.title}`} detail={c.pageNumber ? `p. ${c.pageNumber}` : undefined} />
                      ))}
                    </div>
                  ) : null}
                  {m.meta ? <p className="mt-1 text-right text-[11px] text-fg-subtle">{m.meta}</p> : null}
                </div>
              </div>
            ),
          )}
        </div>
        <form onSubmit={sendReply} className="flex gap-2 border-t border-border p-3">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={status === "human" ? `Reply as ${agentName}…` : "Replying takes the conversation over from the assistant…"}
            aria-label="Reply"
            disabled={status === "closed"}
            className="h-10 flex-1 rounded-md border border-border-strong bg-surface px-3 text-sm outline-none placeholder:text-fg-subtle focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:opacity-60"
          />
          <Button type="submit" disabled={busy || !reply.trim() || status === "closed"}>
            {busy ? "Sending…" : "Reply"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
