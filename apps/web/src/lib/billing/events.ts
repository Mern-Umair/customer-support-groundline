import type { Db } from "mongodb";
import { workspaces } from "../db/collections";
import { toObjectId } from "../tenant";

/**
 * The subset of Stripe event data this app reads. Typed locally so the handler can be
 * unit-tested with plain objects and does not depend on the SDK's generated types.
 */
export interface StripeEventLike {
  id: string;
  type: string;
  data: {
    object: {
      id?: string;
      object?: string;
      client_reference_id?: string | null;
      customer?: string | { id: string } | null;
      subscription?: string | { id: string } | null;
      status?: string;
      metadata?: Record<string, string> | null;
      current_period_end?: number;
      items?: { data?: { current_period_end?: number }[] };
    };
  };
}

export type ApplyResult = "applied" | "duplicate" | "ignored";

const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);

const idOf = (v: string | { id: string } | null | undefined): string | undefined => (typeof v === "string" ? v : v?.id);

/**
 * Applies a Stripe event to the workspace plan. Idempotent: every event id is recorded once
 * (Stripe retries deliveries). Unknown event types are ignored, not errors.
 */
export async function applyStripeEvent(db: Db, event: StripeEventLike): Promise<ApplyResult> {
  const seen = db.collection<{ _id: string; receivedAt: Date; type: string }>("stripe_events");
  try {
    await seen.insertOne({ _id: event.id, receivedAt: new Date(), type: event.type });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return "duplicate";
    throw err;
  }

  const obj = event.data.object;
  if (event.type === "checkout.session.completed") {
    const workspaceId = toObjectId(obj.metadata?.workspaceId ?? obj.client_reference_id ?? "");
    if (!workspaceId) return "ignored";
    await workspaces(db).updateOne(
      { _id: workspaceId },
      { $set: { plan: "pro", "billing.stripeCustomerId": idOf(obj.customer), "billing.subscriptionId": idOf(obj.subscription), "billing.status": "active" } },
    );
    return "applied";
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted" || event.type === "customer.subscription.created") {
    const subscriptionId = obj.id;
    const metaWs = toObjectId(obj.metadata?.workspaceId ?? "");
    const filter = metaWs ? { _id: metaWs } : { "billing.subscriptionId": subscriptionId };
    const status = event.type === "customer.subscription.deleted" ? "canceled" : (obj.status ?? "unknown");
    const periodEnd = obj.current_period_end ?? obj.items?.data?.[0]?.current_period_end;
    const res = await workspaces(db).updateOne(filter, {
      $set: {
        plan: PAID_STATUSES.has(status) ? "pro" : "free",
        "billing.status": status,
        "billing.subscriptionId": subscriptionId,
        ...(idOf(obj.customer) ? { "billing.stripeCustomerId": idOf(obj.customer) } : {}),
        ...(periodEnd ? { "billing.currentPeriodEnd": new Date(periodEnd * 1000) } : {}),
      },
    });
    return res.matchedCount ? "applied" : "ignored";
  }

  return "ignored";
}
