import { ObjectId } from "mongodb";
import { afterAll, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.MONGODB_URI);

describe.skipIf(!hasDb)("built-in tools (integration)", () => {
  const workspaceId = new ObjectId();
  const other = new ObjectId();
  const conversationId = new ObjectId();

  afterAll(async () => {
    const { getDb } = await import("../db");
    const db = await getDb();
    for (const c of ["mock_orders", "tickets", "appointments"]) await db.collection(c).deleteMany({ workspaceId: { $in: [workspaceId, other] } });
  });

  it("seeds orders once and looks them up with a privacy guard, scoped to the workspace", async () => {
    const { getDb } = await import("../db");
    const { seedMockOrders, lookupOrder } = await import("./registry");
    const db = await getDb();
    expect(await seedMockOrders(db, workspaceId)).toBe(3);
    expect(await seedMockOrders(db, workspaceId)).toBe(0);
    const ctx = { db, workspaceId, conversationId };

    const anon = await lookupOrder.run(ctx, { orderNumber: "#48213" });
    expect(anon.ok).toBe(true);
    expect(anon.data.status).toBe("shipped");
    expect(anon.data.items).toBeUndefined();

    const verified = await lookupOrder.run(ctx, { orderNumber: "48213", email: "ANA@example.com" });
    expect(verified.data.items).toEqual(["Oxford · Chestnut · EU 41"]);

    const missing = await lookupOrder.run(ctx, { orderNumber: "99999" });
    expect(missing.ok).toBe(false);

    const crossTenant = await lookupOrder.run({ db, workspaceId: other, conversationId }, { orderNumber: "48213" });
    expect(crossTenant.ok).toBe(false);

    const invalid = await lookupOrder.run(ctx, {});
    expect(invalid.ok).toBe(false);
  });

  it("creates tickets and appointments with validation", async () => {
    const { getDb } = await import("../db");
    const { createTicket, bookAppointment } = await import("./registry");
    const db = await getDb();
    const ctx = { db, workspaceId, conversationId };
    const t = await createTicket.run(ctx, { subject: "Sole came off", details: "After two weeks the sole separated", email: "ana@example.com" });
    expect(t.ok).toBe(true);
    expect(String(t.data.ticketId)).toMatch(/^[0-9A-F]{6}$/);
    expect((await createTicket.run(ctx, { subject: "x" })).ok).toBe(false);

    const a = await bookAppointment.run(ctx, { date: "2026-10-20", time: "15:00", name: "Ana", purpose: "Fitting" });
    expect(a.ok).toBe(true);
    expect(a.summary).toContain("2026-10-20");
    expect((await bookAppointment.run(ctx, { date: "2026-10-20" })).ok).toBe(false);
  });
});
