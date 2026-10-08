import { NextResponse } from "next/server";
import { applyStripeEvent } from "@/lib/billing/events";
import { verifyWebhook } from "@/lib/billing/stripe";
import { getDb } from "@/lib/db";

/**
 * Stripe webhook. The raw body is read with request.text() and verified before any parsing;
 * failures return 400 so Stripe retries. Applying is idempotent by event id.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  let event;
  try {
    event = verifyWebhook(raw, request.headers.get("stripe-signature"));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
  const result = await applyStripeEvent(await getDb(), event as unknown as Parameters<typeof applyStripeEvent>[1]);
  return NextResponse.json({ received: true, result });
}
