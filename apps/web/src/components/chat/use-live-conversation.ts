"use client";

import { useEffect, useRef, useState } from "react";
import { REALTIME_EVENTS, type LiveMessage, type StatusChanged } from "@groundline/shared";
import { connectRealtime } from "@/lib/realtime/client";

export interface LiveOptions {
  conversationId: string | undefined;
  realtime: { url: string; token: string } | null;
  /** Agents must explicitly join a conversation room; visitors are placed in it by their token. */
  joinAsAgent?: boolean;
  /** Polling fallback: URL that returns { status, messages } after the given message id. */
  pollUrl?: (afterId: string | undefined) => string;
  /** Poll only while the conversation is in this status (e.g. "human" for the widget). */
  pollWhen?: (status: string | undefined) => boolean;
  onMessage: (m: LiveMessage) => void;
  onStatus: (s: StatusChanged) => void;
  status: string | undefined;
  lastMessageId: string | undefined;
}

/**
 * Subscribes to a conversation: Socket.io when available, HTTP polling every 4s otherwise.
 * The free realtime server sleeps when idle, so the fallback is part of the design, not a hack.
 */
export function useLiveConversation(opts: LiveOptions): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const latest = useRef(opts);
  useEffect(() => {
    latest.current = opts;
  });

  const { realtime, conversationId, joinAsAgent, pollUrl, status } = opts;

  // Socket subscription.
  useEffect(() => {
    if (!realtime || !conversationId) return;
    const socket = connectRealtime(realtime.url, realtime.token);
    const onConnect = () => {
      setConnected(true);
      if (joinAsAgent) socket.emit(REALTIME_EVENTS.join, conversationId);
    };
    const onDisconnect = () => setConnected(false);
    const onMessage = (m: LiveMessage) => {
      if (m.conversationId === conversationId) latest.current.onMessage(m);
    };
    const onStatus = (s: StatusChanged) => {
      if (s.conversationId === conversationId) latest.current.onStatus(s);
    };
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on(REALTIME_EVENTS.message, onMessage);
    socket.on(REALTIME_EVENTS.statusChanged, onStatus);
    if (socket.connected) onConnect();
    return () => {
      if (joinAsAgent) socket.emit(REALTIME_EVENTS.leave, conversationId);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off(REALTIME_EVENTS.message, onMessage);
      socket.off(REALTIME_EVENTS.statusChanged, onStatus);
    };
  }, [realtime, conversationId, joinAsAgent]);

  // Polling fallback.
  useEffect(() => {
    if (!pollUrl || !conversationId) return;
    const shouldPoll = () => !connected && (latest.current.pollWhen ? latest.current.pollWhen(latest.current.status) : true);
    if (!shouldPoll()) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled || !shouldPoll()) return;
      try {
        const res = await fetch(pollUrl(latest.current.lastMessageId));
        if (res.ok) {
          const json = (await res.json()) as { status: string; messages: LiveMessage[] };
          for (const m of json.messages) latest.current.onMessage(m);
          if (json.status !== latest.current.status) latest.current.onStatus({ workspaceId: "", conversationId, status: json.status as StatusChanged["status"] });
        }
      } catch {
        /* retry next tick */
      }
    };
    void tick();
    const id = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pollUrl, conversationId, connected, status]);

  return { connected };
}
