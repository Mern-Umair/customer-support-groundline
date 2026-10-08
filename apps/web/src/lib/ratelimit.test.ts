import { describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.MONGODB_URI);

describe.skipIf(!hasDb)("checkRateLimit (integration)", () => {
  it("allows up to the limit within a window, then blocks, with separate scopes", async () => {
    const { getDb } = await import("./db");
    const { checkRateLimit } = await import("./ratelimit");
    const db = await getDb();
    const scope = `test:${Date.now()}`;
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await checkRateLimit(db, scope, 3, 60));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[0].remaining).toBe(2);
    expect(results[3].remaining).toBe(0);
    expect((await checkRateLimit(db, `${scope}:other`, 3, 60)).allowed).toBe(true);
    await db.collection<{ _id: string }>("ratelimits").deleteMany({ _id: { $regex: `^${scope}` } });
  }, 30_000);
});
