import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getApiContext, unauthorized } from "@/lib/auth/api";
import { forbidden, isOwner } from "@/lib/auth/roles";
import { billingConfigured, createCheckoutUrl } from "@/lib/billing/stripe";
import { getDb } from "@/lib/db";
import { workspaces } from "@/lib/db/collections";

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Starts a Stripe Checkout session for the Pro plan. */
export async function POST() {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  if (!isOwner(ctx)) return forbidden();
  if (!billingConfigured()) return NextResponse.json({ error: "Billing is not configured on this deployment" }, { status: 503 });
  const ws = await workspaces(await getDb()).findOne({ _id: ctx.workspace._id }, { projection: { billing: 1 } });
  const url = await createCheckoutUrl({ workspaceId: ctx.workspace._id.toHexString(), email: ctx.user.email, origin: await origin(), customerId: ws?.billing?.stripeCustomerId });
  return NextResponse.json({ url });
}
