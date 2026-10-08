"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Badge, CitationChip } from "@/components/ui/badge";
import type { CitationDto, SourceSummary } from "@/lib/chat/answer";
import { readAnswerEvents } from "@/lib/chat/read-events";
import type { MessageDoc } from "@/lib/db/types";

export interface Turn {
  id: string;
  role: "visitor" | "assistant" | "agent";
  text: string;
  streaming?: boolean;
  citations?: CitationDto[];
  sources?: SourceSummary[];
  refused?: boolean;
  usage?: MessageDoc["usage"];
  retrieval?: MessageDoc["retrieval"];
  feedback?: "up" | "down";
  error?: string;
}

export interface ChatPanelProps {
  /** Returns the request for a new message. */
  send: (message: string, conversationId: string | undefined) => { url: string; body: Record<string, unknown> };
  /** Returns the request for a feedback vote. */
  feedback?: (messageId: string, vote: "up" | "down") => { url: string; body: Record<string, unknown> };
  /** Show tokens, cost, latency and the sources-considered panel (dashboard only). */
  showDiagnostics?: boolean;
  placeholder?: string;
  emptyHint?: string;
  initialTurns?: Turn[];
  initialConversationId?: string;
  onConversation?: (id: string) => void;
  className?: string;
}

export function ChatPanel({ send, feedback, showDiagnostics = false, placeholder = "Ask a question…", emptyHint, initialTurns = [], initialConversationId, onConversation, className = "" }: ChatPanelProps) {
  const [turns, setTurns] = useState<Turn[]>(initialTurns);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  function patchLast(patch: Partial<Turn> | ((t: Turn) => Partial<Turn>)) {
    setTurns((ts) => {
      const last = ts[ts.length - 1];
      if (!last || last.role !== "assistant") return ts;
      const p = typeof patch === "function" ? patch(last) : patch;
      return [...ts.slice(0, -1), { ...last, ...p }];
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setBusy(true);
    const tempId = `tmp-${Date.now()}`;
    setTurns((ts) => [...ts, { id: `v-${tempId}`, role: "visitor", text: question }, { id: tempId, role: "assistant", text: "", streaming: true }]);
    try {
      const req = send(question, conversationId);
      const res = await fetch(req.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req.body) });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        patchLast({ streaming: false, error: j.error ?? `Request failed (${res.status})` });
        return;
      }
      for await (const ev of readAnswerEvents(res.body)) {
        if (ev.type === "meta") {
          setConversationId(ev.conversationId);
          onConversation?.(ev.conversationId);
        } else if (ev.type === "sources") patchLast({ sources: ev.sources });
        else if (ev.type === "text") patchLast((t) => ({ text: t.text + ev.text }));
        else if (ev.type === "done") patchLast({ id: ev.messageId, text: ev.text, citations: ev.citations, refused: ev.refused, usage: ev.usage, retrieval: ev.retrieval, streaming: false });
        else if (ev.type === "error") patchLast({ streaming: false, error: ev.message });
      }
    } catch {
      patchLast({ streaming: false, error: "Network error" });
    } finally {
      setBusy(false);
    }
  }

  async function vote(turn: Turn, v: "up" | "down") {
    if (!feedback) return;
    setTurns((ts) => ts.map((t) => (t.id === turn.id ? { ...t, feedback: v } : t)));
    const req = feedback(turn.id, v);
    await fetch(req.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req.body) });
  }

  return (
    <div className={`flex h-full flex-col ${className}`}>
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {turns.length === 0 && emptyHint ? <p className="py-12 text-center text-sm text-fg-muted">{emptyHint}</p> : null}
        {turns.map((t) =>
          t.role === "visitor" ? (
            <VisitorBubble key={t.id} turn={t} />
          ) : (
            <AssistantBubble key={t.id} turn={t} onVote={feedback ? vote : undefined} showDiagnostics={showDiagnostics} />
          ),
        )}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-border p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          aria-label="Message"
          className="h-10 flex-1 rounded-md border border-border-strong bg-surface px-3 text-sm outline-none placeholder:text-fg-subtle focus:border-accent focus:ring-2 focus:ring-accent/25"
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          {busy ? "Answering…" : "Send"}
        </Button>
      </form>
    </div>
  );
}

function VisitorBubble({ turn }: { turn: Turn }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-accent px-3.5 py-2 text-sm text-accent-fg">{turn.text}</div>
    </div>
  );
}

function AssistantBubble({ turn, onVote, showDiagnostics }: { turn: Turn; onVote?: (t: Turn, v: "up" | "down") => void; showDiagnostics: boolean }) {
  const [showSources, setShowSources] = useState(false);
  const u = turn.usage;
  const isAgent = turn.role === "agent";
  return (
    <div className="flex flex-col items-start gap-1.5">
      {isAgent ? <span className="px-1 text-[10px] font-medium text-fg-subtle">Support team</span> : null}
      <div className={`max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm leading-relaxed ${turn.refused ? "bg-warning-soft text-warning" : "bg-surface-2 text-fg"}`}>
        {turn.text || (turn.streaming ? <span className="text-fg-subtle">Thinking…</span> : null)}
        {turn.streaming && turn.text ? <span className="ml-0.5 inline-block h-3.5 w-1 animate-pulse bg-fg-subtle align-middle" /> : null}
      </div>
      {turn.error ? <p className="text-xs text-danger">{turn.error}</p> : null}
      {turn.citations?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {turn.citations.map((c) =>
            c.url ? (
              <a key={c.n} href={c.url} target="_blank" rel="noreferrer" className="max-w-full">
                <CitationChip title={`[${c.n}] ${c.title}`} detail={c.pageNumber ? `p. ${c.pageNumber}` : undefined} />
              </a>
            ) : (
              <CitationChip key={c.n} title={`[${c.n}] ${c.title}`} detail={c.pageNumber ? `p. ${c.pageNumber}` : undefined} />
            ),
          )}
        </div>
      ) : null}
      {!turn.streaming && !isAgent && (u || onVote) ? (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-fg-subtle">
          {showDiagnostics && u ? (
            <>
              <span>{u.latencyMs} ms</span>
              {u.firstTokenMs !== null ? <span>· first token {u.firstTokenMs} ms</span> : null}
              <span>· {u.inputTokens + u.outputTokens} tokens</span>
              <span>· {u.costUsd === null ? "cost n/a" : `$${u.costUsd.toFixed(5)}`}</span>
              {turn.retrieval ? <span>· top score {turn.retrieval.topScore?.toFixed(2) ?? "–"}</span> : null}
              {turn.sources?.length ? (
                <button type="button" onClick={() => setShowSources((s) => !s)} className="underline-offset-2 hover:underline">
                  {showSources ? "hide" : "show"} {turn.sources.length} sources considered
                </button>
              ) : null}
            </>
          ) : null}
          {onVote ? (
            <span className="inline-flex gap-1">
              <FeedbackButton label="Good answer" active={turn.feedback === "up"} onClick={() => onVote(turn, "up")} glyph="👍" />
              <FeedbackButton label="Bad answer" active={turn.feedback === "down"} onClick={() => onVote(turn, "down")} glyph="👎" />
            </span>
          ) : null}
        </div>
      ) : null}
      {showDiagnostics && showSources && turn.sources ? (
        <ol className="mt-1 w-full max-w-[85%] space-y-1.5">
          {turn.sources.map((s) => (
            <li key={s.chunkId} className="rounded-md border border-border p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">
                  [{s.n}] {s.title}
                  {s.pageNumber ? ` · p. ${s.pageNumber}` : ""}
                </span>
                <Badge tone="neutral">{s.score.toFixed(2)}</Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-fg-muted">{s.preview}</p>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function FeedbackButton({ label, active, onClick, glyph }: { label: string; active: boolean; onClick: () => void; glyph: string }) {
  return (
    <button type="button" aria-label={label} aria-pressed={active} onClick={onClick} className={`rounded px-1 text-sm leading-none transition-colors hover:bg-surface-2 ${active ? "bg-accent-soft" : ""}`}>
      {glyph}
    </button>
  );
}
