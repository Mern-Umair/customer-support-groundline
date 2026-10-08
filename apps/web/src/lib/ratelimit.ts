import type { Db } from "mongodb";

interface RateLimitDoc {
  _id: string;
  count: number;
  expiresAt: Date;
}

/**
 * Fixed-window counter in MongoDB. Serverless instances share nothing in memory, so the
 * store must be shared; a Redis would be the usual choice but we have no free one that
 * never sleeps. One atomic upsert per request, TTL index cleans up windows.
 * Approximate at window edges, which is acceptable for abuse protection.
 */
export async function checkRateLimit(db: Db, scope: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const col = db.collection<RateLimitDoc>("ratelimits");
  const now = Date.now();
  const windowStart = Math.floor(now / 1000 / windowSeconds) * windowSeconds;
  const resetAt = new Date((windowStart + windowSeconds) * 1000);
  const id = `${scope}:${windowStart}`;
  const doc = await col.findOneAndUpdate(
    { _id: id },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(resetAt.getTime() + 60_000) } },
    { upsert: true, returnDocument: "after" },
  );
  const count = doc?.count ?? 1;
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt };
}

export async function ensureRateLimitIndex(db: Db): Promise<void> {
  await db.collection<RateLimitDoc>("ratelimits").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}
