/**
 * Integration: the agent loop through answerQuestion with the offline provider.
 * Read-only tool → immediate answer; side-effecting tool → pending action → approval → note.
 */
import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.MONGODB_URI);

describe.skipIf(!hasDb)("agent tools via answerQuestion (integration)", () => {
  const workspaceId = new ObjectId();
  let db: import("mongodb").Db;
  let ctx: import("../chat/answer").AnswerContext;

  beforeAll(async () => {
    const { getDb } = await import("../db");
    const { FakeEmbedder } = await import("../ingest/embeddings");
    const { FakeProvider } = await import("../llm/fake");
    const { seedMockOrders } = await import("./registry");
    db = await getDb();
    await seedMockOrders(db, workspaceId);
    ctx = { db, workspaceId, workspaceName: "Ali Shoes", embedder: new FakeEmbedder(), llm: new FakeProvider(), toolsEnabled: true };
  }, 60_000);

  afterAll(async () => {
    const { conversations, messages, pendingActions } = await import("../db/collections");
    await Promise.all([conversations(db).deleteMany({ workspaceId }), messages(db).deleteMany({ workspaceId }), pendingActions(db).deleteMany({ workspaceId })]);
    for (const c of ["mock_orders", "tickets", "appointments"]) await db.collection(c).deleteMany({ workspaceId });
  });

  async function ask(question: string, conversationId?: ObjectId) {
    const { answerQuestion } = await import("../chat/answer");
    const events = [];
    for await (const ev of answerQuestion(ctx, { channel: "widget", participantId: "v_agenttest01", question, conversationId })) events.push(ev);
    const meta = events.find((e) => e.type === "meta");
    const done = events.find((e) => e.type === "done");
    const tools = events.filter((e) => e.type === "tool");
    return { events, meta: meta?.type === "meta" ? meta : null, done: done?.type === "done" ? done : null, tools };
  }

  it("answers an order question through the read-only tool without a refusal or a handoff", async () => {
    const { pendingActions, messages } = await import("../db/collections");
    const r = await ask("Where is my order #48213? ana@example.com");
    expect(r.tools).toEqual([{ type: "tool", name: "lookupOrder", summary: "Order 48213: shipped", pending: false }]);
    expect(r.done?.refused).toBe(false);
    expect(r.done?.text).toContain("shipped");
    expect(r.events.some((e) => e.type === "handoff")).toBe(false);
    expect(await pendingActions(db).countDocuments({ workspaceId })).toBe(0);
    const stored = await messages(db).findOne({ workspaceId, role: "assistant" });
    expect(stored?.toolCalls?.[0]).toMatchObject({ name: "lookupOrder", pending: false });
  }, 60_000);

  it("defers a side-effecting tool to approval, then executes it and notes the result in the thread", async () => {
    const { pendingActions, messages } = await import("../db/collections");
    const { decideAction } = await import("./actions");
    const r = await ask("I want to file a complaint, the sole of my boots broke after a week. ana@example.com");
    expect(r.tools).toHaveLength(1);
    expect(r.tools[0]).toMatchObject({ type: "tool", name: "createTicket", pending: true });
    expect(r.done?.text).toMatch(/asked the team to approve/);
    expect(r.done?.refused).toBe(false);

    const action = await pendingActions(db).findOne({ workspaceId, status: "pending" });
    expect(action?.tool).toBe("createTicket");
    expect(action?.conversationId.toHexString()).toBe(r.meta?.conversationId);

    const decided = await decideAction(db, workspaceId, action!._id, "approve", { id: new ObjectId(), name: "Sara" });
    expect(decided.status).toBe("approved");
    expect(decided.result?.ok).toBe(true);
    expect(await db.collection("tickets").countDocuments({ workspaceId })).toBe(1);
    const note = await messages(db).findOne({ workspaceId, role: "system", content: /approved by Sara/ });
    expect(note?.content).toMatch(/Ticket [0-9A-F]{6} created/);

    await expect(decideAction(db, workspaceId, action!._id, "approve", { id: new ObjectId(), name: "Sara" })).rejects.toThrow(/already decided/);
  }, 60_000);

  it("rejecting leaves a note and creates nothing", async () => {
    const { pendingActions } = await import("../db/collections");
    const { decideAction } = await import("./actions");
    const r = await ask("Please book a fitting appointment on 2026-11-02 at 15:00");
    expect(r.tools[0]).toMatchObject({ name: "bookAppointment", pending: true });
    const action = await pendingActions(db).findOne({ workspaceId, status: "pending", tool: "bookAppointment" });
    const decided = await decideAction(db, workspaceId, action!._id, "reject", { id: new ObjectId(), name: "Sara" });
    expect(decided.status).toBe("rejected");
    expect(await db.collection("appointments").countDocuments({ workspaceId })).toBe(0);
  }, 60_000);

  it("does not offer tools when the workspace has them disabled", async () => {
    const { answerQuestion } = await import("../chat/answer");
    const events = [];
    for await (const ev of answerQuestion({ ...ctx, toolsEnabled: false }, { channel: "widget", participantId: "v_agenttest02", question: "Where is my order #48213?" })) events.push(ev);
    expect(events.some((e) => e.type === "tool")).toBe(false);
  }, 60_000);
});
