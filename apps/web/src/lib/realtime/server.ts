import "server-only";
import { SignJWT } from "jose";
import type { RealtimeTokenPayload } from "@groundline/shared";
import { env } from "../env";

const AUDIENCE = "groundline-realtime";

/** Short-lived token a browser presents to the Socket.io server. Same secret as sessions. */
export async function signRealtimeToken(payload: RealtimeTokenPayload, ttl = "2h"): Promise<string> {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setAudience(AUDIENCE).setIssuedAt().setExpirationTime(ttl).sign(new TextEncoder().encode(env().AUTH_SECRET));
}

export function realtimeConfigured(): boolean {
  const e = env();
  return Boolean(e.REALTIME_URL && e.REALTIME_SECRET);
}

/** Browser-facing URL (inlined at build time). Null when realtime is not set up. */
export function publicRealtimeUrl(): string | null {
  return process.env.NEXT_PUBLIC_REALTIME_URL || null;
}

/**
 * Fire-and-forget delivery to a room. The database is the source of truth, so a failed
 * emit (server asleep on the free tier, network blip) only delays what polling will show.
 */
export async function emitRealtime(room: string, event: string, payload: unknown): Promise<boolean> {
  const e = env();
  if (!e.REALTIME_URL || !e.REALTIME_SECRET) return false;
  try {
    const res = await fetch(`${e.REALTIME_URL}/emit`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${e.REALTIME_SECRET}` },
      body: JSON.stringify({ room, event, payload }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) console.warn(`[realtime] emit ${event} → ${room} failed: HTTP ${res.status}`);
    return res.ok;
  } catch (err) {
    console.warn(`[realtime] emit ${event} → ${room} failed:`, (err as Error).message);
    return false;
  }
}
