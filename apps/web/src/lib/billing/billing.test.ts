import { ObjectId } from "mongodb";
import Stripe from "stripe";
import { afterAll, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.MONGODB_URI);

describe("Stripe webhook signature", () => {
  it("accepts a correctly signed payload and rejects a tampered one", () => {
    const secret = "whsec_test_secret";
    const payload = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: {} } });
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
    const event = Stripe.webhooks.constructEvent(payload, header, secret);
    expect(event.id).toBe("evt_1");
    expect(() => Stripe.webhooks.constructEvent(payload.replace("evt_1", "evt_2"), header, secret)).toThrow(/signature/i);
    expect(() => Stripe.webhooks.constructEvent(payload, header, "whsec_other")).toThrow(/signature/i);
  });
});

describe.skipIf(!hasDb)("applyStripeEvent (integration)", () => {
  const workspaceId = new ObjectId();
  const stamp = Date.now();

  afterAll(async () => {
    const { getDb } = await import("../db");
    const { workspaces } = await import("../db/collections");
    const db = await getDb();
    await workspaces(db).deleteOne({ _id: workspaceId });
    await db.collection<{ _id: string }>("stripe_events").deleteMany({ _id: { $regex: `^evt_${stamp}` } });
  });

  it("upgrades on checkout, follows subscription status, downgrades on deletion, ignores duplicates and unknown events", async () => {
    const { getDb } = await import("../db");
    const { workspaces } = await import("../db/collections");
    const { applyStripeEvent } = await import("./events");
    const db = await getDb();
    await workspaces(db).insertOne({ _id: workspaceId, name: "B", slug: `b-${stamp}`, publicKey: `wk_${stamp.toString(16).padStart(32, "1")}`, plan: "free", createdBy: new ObjectId(), createdAt: new Date() });

    const checkout = { id: `evt_${stamp}_1`, type: "checkout.session.completed", data: { object: { customer: "cus_1", subscription: "sub_1", metadata: { workspaceId: workspaceId.toHexString() } } } };
    expect(await applyStripeEvent(db, checkout)).toBe("applied");
    expect(await applyStripeEvent(db, checkout)).toBe("duplicate");
    let ws = await workspaces(db).findOne({ _id: workspaceId });
    expect(ws?.plan).toBe("pro");
    expect(ws?.billing).toMatchObject({ stripeCustomerId: "cus_1", subscriptionId: "sub_1", status: "active" });

    expect(await applyStripeEvent(db, { id: `evt_${stamp}_2`, type: "customer.subscription.updated", data: { object: { id: "sub_1", status: "past_due", items: { data: [{ current_period_end: 1_800_000_000 }] } } } })).toBe("applied");
    ws = await workspaces(db).findOne({ _id: workspaceId });
    expect(ws?.plan).toBe("pro");
    expect(ws?.billing?.status).toBe("past_due");
    expect(ws?.billing?.currentPeriodEnd?.getTime()).toBe(1_800_000_000 * 1000);

    expect(await applyStripeEvent(db, { id: `evt_${stamp}_3`, type: "customer.subscription.deleted", data: { object: { id: "sub_1", status: "canceled" } } })).toBe("applied");
    ws = await workspaces(db).findOne({ _id: workspaceId });
    expect(ws?.plan).toBe("free");
    expect(ws?.billing?.status).toBe("canceled");

    expect(await applyStripeEvent(db, { id: `evt_${stamp}_4`, type: "invoice.paid", data: { object: {} } })).toBe("ignored");
    expect(await applyStripeEvent(db, { id: `evt_${stamp}_5`, type: "customer.subscription.updated", data: { object: { id: "sub_unknown", status: "active" } } })).toBe("ignored");
  }, 30_000);
});
