"use client";

import { io, type Socket } from "socket.io-client";

const sockets = new Map<string, Socket>();

/** One socket per (url, token). Reconnects automatically; callers subscribe to events. */
export function connectRealtime(url: string, token: string): Socket {
  const key = `${url}|${token}`;
  const existing = sockets.get(key);
  if (existing) return existing;
  const socket = io(url, { auth: { token }, transports: ["websocket", "polling"], reconnectionDelayMax: 10_000 });
  sockets.set(key, socket);
  return socket;
}

export function disconnectRealtime(url: string, token: string): void {
  const key = `${url}|${token}`;
  sockets.get(key)?.disconnect();
  sockets.delete(key);
}
