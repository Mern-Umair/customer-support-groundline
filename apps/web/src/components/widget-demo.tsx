"use client";

import { useEffect, useRef, useState } from "react";
import { CitationChip } from "./ui/badge";

/**
 * Scripted preview of the widget for the landing page. It is honest about being a demo:
 * no model call happens here; the real widget streams from the API (week 2–3).
 */

type Step =
  | { kind: "visitor"; text: string }
  | { kind: "assistant"; text: string; cite?: { title: string; detail: string } }
  | { kind: "handoff"; text: string }
  | { kind: "agent"; text: string };

const SCRIPT: Step[] = [
  { kind: "visitor", text: "Can I return shoes I bought on sale?" },
  {
    kind: "assistant",
    text: "Yes. Sale items can be returned within 14 days for store credit, as long as they are unworn and in the original box.",
    cite: { title: "returns-policy.pdf", detail: "p. 2" },
  },
  { kind: "visitor", text: "Where is my order #48213?" },
  { kind: "handoff", text: "I can't see order details. Bringing in a teammate…" },
  { kind: "agent", text: "Hi, this is Sara. Your order shipped yesterday, tracking is in your inbox now." },
];

const TYPE_MS = 18;
const PAUSE_MS = 900;

export function WidgetDemo() {
  const [shown, setShown] = useState<Step[]>([]);
  const [typing, setTyping] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, ms));
      });

    (async () => {
      for (const step of SCRIPT) {
        if (cancelled) return;
        if (step.kind === "visitor") {
          await wait(PAUSE_MS);
          if (cancelled) return;
          setShown((s) => [...s, step]);
          continue;
        }
        await wait(PAUSE_MS);
        if (cancelled) return;
        setTyping("");
        await wait(500);
        for (let i = 1; i <= step.text.length; i++) {
          if (cancelled) return;
          setTyping(step.text.slice(0, i));
          await wait(TYPE_MS);
        }
        setTyping(null);
        setShown((s) => [...s, step]);
      }
      if (!cancelled) setDone(true);
    })();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [shown, typing]);

  const handoffHappened = shown.some((s) => s.kind === "handoff");

  return (
    <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${handoffHappened ? "bg-warning" : "bg-success"}`} />
          <span className="text-sm font-medium">Ali Shoes support</span>
        </div>
        <span className="text-[11px] text-fg-subtle">{handoffHappened ? "Sara · human" : "AI · grounded"}</span>
      </div>

      <div ref={scrollRef} className="flex h-80 flex-col gap-3 overflow-y-auto px-4 py-4 text-sm">
        {shown.map((step, i) => (
          <Bubble key={i} step={step} />
        ))}
        {typing !== null ? (
          <div className="flex animate-fade-up flex-col items-start gap-1.5">
            <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-surface-2 px-3 py-2 text-fg">
              {typing.length === 0 ? <TypingDots /> : typing}
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-2 rounded-full border border-border bg-bg px-3 py-2 text-xs text-fg-subtle">
          <span className="flex-1">Ask a question…</span>
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-fg">Send</span>
        </div>
        <p className="mt-2 text-center text-[10px] text-fg-subtle">
          {done ? "Scripted preview · the real widget streams from your documents" : "Scripted preview"}
        </p>
      </div>
    </div>
  );
}

function Bubble({ step }: { step: Step }) {
  if (step.kind === "visitor") {
    return (
      <div className="flex animate-fade-up justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-3 py-2 text-accent-fg">{step.text}</div>
      </div>
    );
  }
  if (step.kind === "handoff") {
    return (
      <div className="flex animate-fade-up justify-center">
        <span className="rounded-full bg-warning-soft px-2.5 py-1 text-[11px] font-medium text-warning">{step.text}</span>
      </div>
    );
  }
  return (
    <div className="flex animate-fade-up flex-col items-start gap-1.5">
      {step.kind === "agent" ? <span className="px-1 text-[10px] font-medium text-fg-subtle">Sara · Support</span> : null}
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-surface-2 px-3 py-2 text-fg">{step.text}</div>
      {step.kind === "assistant" && step.cite ? <CitationChip title={step.cite.title} detail={step.cite.detail} /> : null}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-fg-subtle" style={{ animationDelay: `${i * 0.2}s` }} />
      ))}
    </span>
  );
}
