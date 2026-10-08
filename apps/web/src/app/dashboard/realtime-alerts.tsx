"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { REALTIME_EVENTS, type HandoffRequested } from "@groundline/shared";
import { connectRealtime } from "@/lib/realtime/client";

interface Alert extends HandoffRequested {
  id: string;
}

/**
 * Mounted in the dashboard layout. Connects as an agent and shows a toast when a
 * conversation needs a human. The toast links straight to the live thread.
 */
export function RealtimeAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [state, setState] = useState<"off" | "connecting" | "live" | "down">("off");

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    (async () => {
      const res = await fetch("/api/realtime/token");
      if (!res.ok) return;
      const { url, token } = (await res.json()) as { url: string | null; token: string | null };
      if (!url || !token || cancelled) return;
      setState("connecting");
      const socket = connectRealtime(url, token);
      const onConnect = () => setState("live");
      const onDisconnect = () => setState("down");
      const onHandoff = (h: HandoffRequested) => {
        setAlerts((a) => [{ ...h, id: `${h.conversationId}-${h.requestedAt}` }, ...a].slice(0, 5));
        if (typeof document !== "undefined") document.title = `● Needs attention · Groundline`;
      };
      socket.on("connect", onConnect);
      socket.on("disconnect", onDisconnect);
      socket.on(REALTIME_EVENTS.handoffRequested, onHandoff);
      if (socket.connected) onConnect();
      cleanup = () => {
        socket.off("connect", onConnect);
        socket.off("disconnect", onDisconnect);
        socket.off(REALTIME_EVENTS.handoffRequested, onHandoff);
      };
    })();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  return (
    <>
      <span className="fixed bottom-3 left-3 z-40 hidden items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-1 text-[10px] text-fg-subtle sm:inline-flex" data-testid="realtime-state">
        <span className={`h-1.5 w-1.5 rounded-full ${state === "live" ? "bg-success" : state === "connecting" ? "bg-warning" : "bg-fg-subtle"}`} />
        {state === "live" ? "Live alerts on" : state === "connecting" ? "Connecting…" : state === "down" ? "Alerts offline · reconnecting" : "Live alerts off"}
      </span>
      <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2" aria-live="polite">
        {alerts.map((a) => (
          <div key={a.id} className="animate-fade-up rounded-lg border border-warning/40 bg-surface p-3 shadow-card" role="status">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">Visitor needs a human</p>
              <button type="button" aria-label="Dismiss" onClick={() => setAlerts((list) => list.filter((x) => x.id !== a.id))} className="text-fg-subtle hover:text-fg">
                ✕
              </button>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-fg-muted">&ldquo;{a.lastVisitorMessage}&rdquo;</p>
            <p className="mt-0.5 text-[10px] text-fg-subtle">{a.reason === "visitor_asked" ? "Asked for a person" : a.reason === "low_confidence" ? "Assistant could not answer" : "Needs approval"}</p>
            <Link href={`/dashboard/conversations/${a.conversationId}`} onClick={() => setAlerts((list) => list.filter((x) => x.id !== a.id))} className="mt-2 inline-flex rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-fg hover:bg-accent-hover">
              Open conversation
            </Link>
          </div>
        ))}
      </div>
    </>
  );
}
