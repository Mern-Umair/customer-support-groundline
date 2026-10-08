"use client";

import { useSyncExternalStore } from "react";
import { ChatPanel } from "@/components/chat/chat-panel";

interface Props {
  publicKey: string;
  workspaceName: string;
}

const VISITOR_KEY = "gl_visitor";

let visitorCache: string | null = null;
function getVisitorId(): string {
  if (visitorCache) return visitorCache;
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return (visitorCache = existing);
    const id = `v_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
    localStorage.setItem(VISITOR_KEY, id);
    return (visitorCache = id);
  } catch {
    return (visitorCache = `v_${Math.random().toString(36).slice(2, 14)}${Date.now().toString(36)}`);
  }
}

const noopSubscribe = () => () => {};

/** Browser-only values without a hydration mismatch: null on the server, real value after mount. */
function useBrowserValue<T>(get: () => T): T | null {
  return useSyncExternalStore(noopSubscribe, get, () => null);
}

export function EmbedChat({ publicKey, workspaceName }: Props) {
  const visitorId = useBrowserValue(getVisitorId);
  const savedConversation = useBrowserValue(() => {
    try {
      return sessionStorage.getItem(`gl_convo:${publicKey}`) ?? "";
    } catch {
      return "";
    }
  });

  function close() {
    // Only the loader on the host page listens; it checks our origin before acting.
    window.parent?.postMessage({ type: "groundline:close" }, "*");
  }

  if (visitorId === null || savedConversation === null) return null;

  return (
    <div className="flex h-dvh flex-col bg-surface text-fg">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-success" />
          <span className="text-sm font-medium">{workspaceName} support</span>
        </div>
        <button type="button" onClick={close} aria-label="Close chat" className="rounded-md px-2 py-1 text-fg-muted hover:bg-surface-2 hover:text-fg">
          ✕
        </button>
      </header>
      <ChatPanel
        className="min-h-0 flex-1"
        placeholder="Type your question…"
        emptyHint={`Ask anything about ${workspaceName}. Answers come from their own documentation.`}
        initialConversationId={savedConversation || undefined}
        onConversation={(id) => {
          try {
            sessionStorage.setItem(`gl_convo:${publicKey}`, id);
          } catch {
            /* ignore */
          }
        }}
        send={(message, convo) => ({ url: "/api/widget/chat", body: { key: publicKey, visitorId, message, conversationId: convo } })}
        feedback={(messageId, vote) => ({ url: "/api/widget/feedback", body: { key: publicKey, visitorId, messageId, vote } })}
        pollUrl={(conversationId, after) => `/api/widget/messages?key=${encodeURIComponent(publicKey)}&visitorId=${encodeURIComponent(visitorId)}&conversationId=${conversationId}${after ? `&after=${after}` : ""}`}
      />
      <p className="border-t border-border py-1.5 text-center text-[10px] text-fg-subtle">Answers are grounded in {workspaceName}&apos;s documents · Powered by Groundline</p>
    </div>
  );
}
