"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { LiveMessage, StatusChanged } from "@groundline/shared";
import { Button } from "@/components/ui/button";
import { Badge, CitationChip } from "@/components/ui/badge";
import type { CitationDto, SourceSummary } from "@/lib/chat/answer";
import { readAnswerEvents } from "@/lib/chat/read-events";
import type { MessageDoc } from "@/lib/db/types";
import { useLiveConversation } from "./use-live-conversation";

export interface Turn {
  id: string;
  role: "visitor" | "assistant" | "agent" | "system";
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
  send: (message: string, conversationId: string | undefined) => { url: string; body: Record<string, unknown> };
  feedback?: (messageId: string, vote: "up" | "down") => { url: string; body: Record<string, unknown> };
  /** Polling fallback for agent/system messages when the socket is unavailable. */
  pollUrl?: (conversationId: string, afterId: string | undefined) => string;
  showDiagnostics?: boolean;
  placeholder?: string;
  emptyHint?: string;
  initialTurns?: Turn[];
  initialConversationId?: string;
  onConversation?: (id: string) => void;
  className?: string;
}

export function ChatPanel({ send, feedback, pollUrl, showDiagnostics = false, placeholder = "Ask a question…", emptyHint, initialTurns = [], initialConversationId, onConversation, className = "" }: ChatPanelProps) {
  const [turns, setTurns] = useState<Turn[]>(initialTurns);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [status, setStatus] = useState<string | undefined>();
  const [realtime, setRealtime] = useState<{ url: string; token: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<string>(initialTurns.map((t) => t.id)));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const patch = useCallback((id: string, p: Partial<Turn> | ((t: Turn) => Partial<Turn>)) => {
    setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, ...(typeof p === "function" ? p(t) : p) } : t)));
  }, []);

  const appendLive = useCallback((m: LiveMessage) => {
    if (m.role !== "agent" && m.role !== "system") return; // our own visitor/assistant turns are already shown
    if (seen.current.has(m.id)) return;
    seen.current.add(m.id);
    setTurns((ts) => [...ts, { id: m.id, role: m.role, text: m.content }]);
  }, []);

  const onStatus = useCallback((s: StatusChanged) => {
    setStatus(s.status);
    if (s.status === "human" && s.agentName) setTurns((ts) => [...ts, { id: `st-${Date.now()}`, role: "system", text: `${s.agentName} from the support team has joined.` }]);
    if (s.status === "ai") setTurns((ts) => [...ts, { id: `st-${Date.now()}`, role: "system", text: "The assistant is back on this conversation." }]);
  }, []);

  const lastLiveId = [...turns].reverse().find((t) => t.role === "agent" || t.role === "system")?.id;
  const { connected } = useLiveConversation({
    conversationId,
    realtime,
    pollUrl: pollUrl && conversationId ? (after) => pollUrl(conversationId, after) : undefined,
    pollWhen: (s) => s === "human",
    status,
    lastMessageId: lastLiveId && /^[0-9a-f]{24}$/.test(lastLiveId) ? lastLiveId : undefined,
    onMessage: appendLive,
    onStatus,
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setBusy(true);
    const tempId = `tmp-${Date.now()}`;
    setTurns((ts) => [...ts, { id: `v-${tempId}`, role: "visitor", text: question }, { id: tempId, role: "assistant", text: "", streaming: true }]);
    let currentId = tempId;
    let streamedText = "";
    try {
      const req = send(question, conversationId);
      const res = await fetch(req.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req.body) });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        patch(currentId, { streaming: false, error: j.error ?? `Request failed (${res.status})` });
        return;
      }
      for await (const ev of readAnswerEvents(res.body)) {
        if (ev.type === "meta") {
          setConversationId(ev.conversationId);
          setStatus(ev.status);
          if (ev.realtime) setRealtime(ev.realtime);
          onConversation?.(ev.conversationId);
        } else if (ev.type === "sources") patch(currentId, { sources: ev.sources });
        else if (ev.type === "text") {
          streamedText += ev.text;
          patch(currentId, (t) => ({ text: t.text + ev.text }));
        }
        else if (ev.type === "handoff") {
          setStatus(ev.status);
          // The stored note is also broadcast over the socket; remember its id so it is not shown twice.
          const noteId = ev.noteId ?? `note-${Date.now()}`;
          seen.current.add(noteId);
          // The same note may already have arrived over the socket (it races the SSE event):
          // then only drop the empty pending bubble. Capture ids now; updaters run later.
          const pendingId = currentId;
          const convertPending = !streamedText;
          setTurns((ts) => {
            if (ts.some((t) => t.id === noteId)) return convertPending ? ts.filter((t) => t.id !== pendingId) : ts;
            if (convertPending) return ts.map((t) => (t.id === pendingId ? { ...t, id: noteId, role: "system", text: ev.note, streaming: false } : t));
            return [...ts, { id: noteId, role: "system", text: ev.note }];
          });
          if (convertPending) currentId = noteId;
        } else if (ev.type === "done") {
          seen.current.add(ev.messageId);
          if (ev.role === "system") {
            // Either the pending bubble already became the note or there is nothing to show: drop an empty pending bubble.
            const pendingId = currentId;
            setTurns((ts) => ts.filter((t) => t.id !== pendingId || Boolean(t.text)));
          } else {
            patch(currentId, { id: ev.messageId, text: ev.text, citations: ev.citations, refused: ev.refused, usage: ev.usage ?? undefined, retrieval: ev.retrieval ?? undefined, streaming: false });
            currentId = ev.messageId;
          }
        } else if (ev.type === "error") patch(currentId, { streaming: false, error: ev.message });
      }
    } catch {
      patch(currentId, { streaming: false, error: "Network error" });
    } finally {
      setBusy(false);
    }
  }

  async function vote(turn: Turn, v: "up" | "down") {
    if (!feedback) return;
    patch(turn.id, { feedback: v });
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
          ) : t.role === "system" ? (
            <SystemNote key={t.id} text={t.text} />
          ) : (
            <AssistantBubble key={t.id} turn={t} onVote={feedback && t.role === "assistant" ? vote : undefined} showDiagnostics={showDiagnostics} />
          ),
        )}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-border p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={status === "human" ? "Reply to the team…" : placeholder}
          aria-label="Message"
          className="h-10 flex-1 rounded-md border border-border-strong bg-surface px-3 text-sm outline-none placeholder:text-fg-subtle focus:border-accent focus:ring-2 focus:ring-accent/25"
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          {busy ? "Answering…" : "Send"}
        </Button>
      </form>
      {status === "human" ? (
        <p className="px-3 pb-2 text-[10px] text-fg-subtle" data-testid="live-indicator">
          {connected ? "Live · a teammate will reply here" : "Waiting for a teammate · checking for replies"}
        </p>
      ) : null}
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

export function SystemNote({ text }: { text: string }) {
  return (
    <div className="flex justify-center">
      <span className="max-w-[90%] rounded-full bg-warning-soft px-3 py-1 text-center text-[11px] font-medium text-warning">{text}</span>
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
      <div className={`max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm leading-relaxed ${turn.refused ? "bg-warning-soft text-warning" : isAgent ? "border border-accent/30 bg-accent-soft/40 text-fg" : "bg-surface-2 text-fg"}`}>
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
