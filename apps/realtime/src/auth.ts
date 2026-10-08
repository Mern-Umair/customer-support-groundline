import { jwtVerify } from "jose";
import { RealtimeTokenPayload } from "@groundline/shared";

/** Verifies a token signed by the web app (same AUTH_SECRET) and returns its payload. */
export async function verifyRealtimeToken(token: string, secret: string): Promise<RealtimeTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"], audience: "groundline-realtime" });
    const parsed = RealtimeTokenPayload.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
