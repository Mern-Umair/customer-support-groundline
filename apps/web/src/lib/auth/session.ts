import "server-only";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { env } from "../env";

export const SESSION_COOKIE = "gl_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

const SessionPayload = z.object({
  userId: z.string().min(1),
  workspaceId: z.string().min(1),
});
export type SessionPayload = z.infer<typeof SessionPayload>;

function key(): Uint8Array {
  return new TextEncoder().encode(env().AUTH_SECRET);
}

export async function encryptSession(payload: SessionPayload, ttlSeconds = SESSION_TTL_SECONDS): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(key());
}

export async function decryptSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    const parsed = SessionPayload.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await encryptSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function deleteSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return decryptSession(store.get(SESSION_COOKIE)?.value);
}
