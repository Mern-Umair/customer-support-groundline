import "server-only";
import Stripe from "stripe";
import { env } from "../env";

/**
 * Stripe in test mode. Everything here is optional: without STRIPE_SECRET_KEY the app runs
 * on the free plan only and the UI says billing is not configured. No fake prices are shown.
 */
let client: Stripe | undefined;

export function billingConfigured(): boolean {
  const e = env();
  return Boolean(e.STRIPE_SECRET_KEY && e.STRIPE_PRICE_PRO);
}

export function getStripe(): Stripe {
  if (client) return client;
  const key = env().STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured (STRIPE_SECRET_KEY)");
  client = new Stripe(key);
  return client;
}

export async function createCheckoutUrl(params: { workspaceId: string; email: string; origin: string; customerId?: string }): Promise<string> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: env().STRIPE_PRICE_PRO!, quantity: 1 }],
    ...(params.customerId ? { customer: params.customerId } : { customer_email: params.email }),
    client_reference_id: params.workspaceId,
    metadata: { workspaceId: params.workspaceId },
    subscription_data: { metadata: { workspaceId: params.workspaceId } },
    success_url: `${params.origin}/dashboard/settings?billing=success`,
    cancel_url: `${params.origin}/dashboard/settings?billing=cancelled`,
    allow_promotion_codes: true,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

export async function createPortalUrl(params: { customerId: string; origin: string }): Promise<string> {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({ customer: params.customerId, return_url: `${params.origin}/dashboard/settings` });
  return session.url;
}

/** Verifies the webhook signature against the raw body. Throws on failure. */
export function verifyWebhook(rawBody: string, signature: string | null): Stripe.Event {
  const secret = env().STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  if (!signature) throw new Error("Missing stripe-signature header");
  return Stripe.webhooks.constructEvent(rawBody, signature, secret.trim());
}
