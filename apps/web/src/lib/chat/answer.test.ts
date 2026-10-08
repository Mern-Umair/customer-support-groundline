/**
 * Integration: full RAG turn on the test database with the offline embedder and provider.
 * Reuses the vector index created by the pipeline tests (same cluster/database).
 */
import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.MONGODB_URI);

describe.skipIf(!hasDb)("answerQuestion (integration)", () => {
  const workspaceId = new ObjectId();
  const userId = new ObjectId();
  let db: import("mongodb").Db;
  let ctx: import("./answer").AnswerContext;

  beforeAll(async () => {
    const { getDb } = await import("../db");
    const { FakeEmbedder } = await import("../ingest/embeddings");
    const { FakeProvider } = await import("../llm/fake");
    const { createTextSource, processSource } = await import("../ingest/pipeline");
    const { ensureVectorIndex, waitForVectorIndex } = await import("../db/indexes");
    const { searchChunks } = await import("../ingest/retrieval");

    db = await getDb();
    const embedder = new FakeEmbedder();
    await ensureVectorIndex(db);
    await waitForVectorIndex(db, 150_000);

    const pc = { db, workspaceId, userId, plan: "free" as const, embedder };
    const src = await createTextSource(pc, "Store policies", "Sale items can be returned within 14 days for store credit if unworn. Standard shipping is free over 60 euros and takes three business days.");
    await processSource(pc, src._id, { budgetMs: 20_000 });

    // Wait for Atlas Search to see the new chunk.
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      const hits = await searchChunks(db, workspaceId, embedder, "return sale items 14 days", { k: 3 });
      if (hits.length) break;
      await new Promise((r) => setTimeout(r, 3000));
    }
    ctx = { db, workspaceId, workspaceName: "Ali Shoes", embedder, llm: new FakeProvider() };
  }, 300_000);

  afterAll(async () => {
    const { sources, pages, chunks, conversations, messages } = await import("../db/collections");
    await Promise.all([
      sources(db).deleteMany({ workspaceId }),
      pages(db).deleteMany({ workspaceId }),
      chunks(db).deleteMany({ workspaceId }),
      conversations(db).deleteMany({ workspaceId }),
      messages(db).deleteMany({ workspaceId }),
    ]);
  });

  it("streams an answer with a validated citation and stores both messages with usage", async () => {
    const { answerQuestion } = await import("./answer");
    const { messages, conversations } = await import("../db/collections");

    const events = [];
    for await (const ev of answerQuestion(ctx, { channel: "playground", participantId: userId.toHexString(), question: "Can I return sale items?" })) events.push(ev);

    const meta = events.find((e) => e.type === "meta");
    const done = events.find((e) => e.type === "done");
    expect(meta?.type).toBe("meta");
    expect(done?.type).toBe("done");
    if (done?.type !== "done" || meta?.type !== "meta") return;

    expect(done.refused).toBe(false);
    expect(done.text).toContain("14 days");
    expect(done.citations).toHaveLength(1);
    expect(done.citations[0].title).toBe("Store policies");
    expect(done.usage?.provider).toBe("fake");
    expect(done.usage?.latencyMs).toBeGreaterThan(0);
    expect(events.filter((e) => e.type === "text").length).toBeGreaterThan(1);

    const stored = await messages(db).find({ conversationId: new ObjectId(meta.conversationId) }).sort({ createdAt: 1 }).toArray();
    expect(stored.map((m) => m.role)).toEqual(["visitor", "assistant"]);
    expect(stored[1].citations?.[0].chunkId).toBeInstanceOf(ObjectId);

    const convo = await conversations(db).findOne({ _id: new ObjectId(meta.conversationId) });
    expect(convo?.messageCount).toBe(2);
    expect(convo?.totals.answers).toBe(1);
    expect(convo?.totals.refusals).toBe(0);
  }, 60_000);

  it("refuses when retrieval finds nothing and does not call the model", async () => {
    const { answerQuestion } = await import("./answer");
    const emptyTenant = { ...ctx, workspaceId: new ObjectId() };
    const events = [];
    for await (const ev of answerQuestion(emptyTenant, { channel: "playground", participantId: "u", question: "Where is my order 48213?" })) events.push(ev);
    const done = events.find((e) => e.type === "done");
    expect(done?.type === "done" && done.refused).toBe(true);
    expect(done?.type === "done" && done.usage?.inputTokens).toBe(0);
    const { conversations } = await import("../db/collections");
    await conversations(db).deleteMany({ workspaceId: emptyTenant.workspaceId });
    const { messages } = await import("../db/collections");
    await messages(db).deleteMany({ workspaceId: emptyTenant.workspaceId });
  }, 60_000);

  it("rejects a conversation that belongs to someone else", async () => {
    const { answerQuestion } = await import("./answer");
    const { conversations } = await import("../db/collections");
    const convo = await conversations(db).findOne({ workspaceId });
    const gen = answerQuestion(ctx, { channel: "playground", participantId: "someone-else", conversationId: convo!._id, question: "hi" });
    await expect(gen.next()).rejects.toThrow(/Conversation not found/);
  });

  it("records feedback only on assistant messages in the same workspace", async () => {
    const { recordFeedback } = await import("./answer");
    const { messages } = await import("../db/collections");
    const assistant = await messages(db).findOne({ workspaceId, role: "assistant" });
    const visitor = await messages(db).findOne({ workspaceId, role: "visitor" });
    expect(await recordFeedback(db, workspaceId, assistant!._id, "up")).toBe(true);
    expect(await recordFeedback(db, workspaceId, visitor!._id, "up")).toBe(false);
    expect(await recordFeedback(db, new ObjectId(), assistant!._id, "down")).toBe(false);
    const updated = await messages(db).findOne({ _id: assistant!._id });
    expect(updated?.feedback?.vote).toBe("up");
  });
});
