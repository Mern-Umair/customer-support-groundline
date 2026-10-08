import { ObjectId } from "mongodb";
import { afterAll, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.MONGODB_URI);

describe.skipIf(!hasDb)("getInsights (integration)", () => {
  const workspaceId = new ObjectId();
  const other = new ObjectId();

  afterAll(async () => {
    const { getDb } = await import("./db");
    const { conversations, messages } = await import("./db/collections");
    const db = await getDb();
    await conversations(db).deleteMany({ workspaceId: { $in: [workspaceId, other] } });
    await messages(db).deleteMany({ workspaceId: { $in: [workspaceId, other] } });
  });

  it("aggregates conversations, answers, refusals, handoffs, cost, feedback and the daily series per tenant", async () => {
    const { getDb } = await import("./db");
    const { conversations, messages } = await import("./db/collections");
    const { getInsights } = await import("./insights");
    const db = await getDb();
    const now = new Date("2026-10-09T12:00:00Z");
    const day = (d: number) => new Date(now.getTime() - d * 24 * 3600 * 1000);

    const convo = (ws: ObjectId, createdAt: Date, extra: Record<string, unknown> = {}) => ({
      _id: new ObjectId(),
      workspaceId: ws,
      channel: "widget" as const,
      status: "ai" as const,
      participantId: "v",
      messageCount: 2,
      totals: { inputTokens: 100, outputTokens: 50, costUsd: 0.001, latencyMs: 800, answers: 1, refusals: 0 },
      createdAt,
      lastMessageAt: createdAt,
      ...extra,
    });
    const c1 = convo(workspaceId, day(0));
    const c2 = convo(workspaceId, day(1), { status: "human", totals: { inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 200, answers: 1, refusals: 1 }, handoff: { requestedAt: day(1), reason: "low_confidence" } });
    const c3 = convo(workspaceId, day(45)); // outside range
    const c4 = convo(other, day(0)); // other tenant
    await conversations(db).insertMany([c1, c2, c3, c4]);

    const msg = (ws: ObjectId, conversationId: ObjectId, createdAt: Date, extra: Record<string, unknown> = {}) => ({
      _id: new ObjectId(),
      workspaceId: ws,
      conversationId,
      role: "assistant" as const,
      content: "x",
      createdAt,
      ...extra,
    });
    await messages(db).insertMany([
      msg(workspaceId, c1._id, day(0), { question: "Do you ship to Spain?", feedback: { vote: "up", at: day(0) } }),
      msg(workspaceId, c2._id, day(1), { question: "Where is my order 48213?", refused: true, feedback: { vote: "down", at: day(1) } }),
      msg(workspaceId, c3._id, day(45), { question: "old", refused: true }),
      msg(other, c4._id, day(0), { question: "other tenant", refused: true }),
    ]);

    const i = await getInsights(db, workspaceId, 30, now);
    expect(i.conversations).toBe(2);
    expect(i.answers).toBe(2);
    expect(i.refusals).toBe(1);
    expect(i.answeredRate).toBeCloseTo(0.5);
    expect(i.handoffs).toBe(1);
    expect(i.avgLatencyMs).toBe(500);
    expect(i.costUsd).toBeCloseTo(0.001);
    expect(i.tokens).toBe(150);
    expect(i.feedback).toEqual({ up: 1, down: 1, score: 0.5 });
    expect(i.daily).toHaveLength(30);
    expect(i.daily[29]).toEqual({ day: "2026-10-09", conversations: 1, handoffs: 0 });
    expect(i.daily[28]).toEqual({ day: "2026-10-08", conversations: 1, handoffs: 1 });
    expect(i.unanswered.map((u) => u.question)).toEqual(["Where is my order 48213?"]);
    expect(i.unanswered[0].channel).toBe("widget");

    const empty = await getInsights(db, new ObjectId(), 30, now);
    expect(empty.conversations).toBe(0);
    expect(empty.answeredRate).toBeNull();
    expect(empty.unanswered).toEqual([]);
  }, 30_000);
});
