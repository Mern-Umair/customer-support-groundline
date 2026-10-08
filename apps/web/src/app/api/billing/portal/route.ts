import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getApiContext, unauthorized } from "@/lib/auth/api";
import { forbidden, isOwner } from "@/lib/auth/roles";
import { billingConfigured, createPortalUrl } from "@/lib/billing/stripe";
import { getDb } from "@/lib/db";
import { workspaces } from "@/lib/db/collections";

/** Opens the Stripe customer portal (change card, cancel). */
export async function POST() {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  if (!isOwner(ctx)) return forbidden();
  if (!billingConfigured()) return NextResponse.json({ error: "Billing is not configured on this deployment" }, { status: 503 });
  const ws = await workspaces(await getDb()).findOne({ _id: ctx.workspace._id }, { projection: { billing: 1 } });
  if (!ws?.billing?.stripeCustomerId) return NextResponse.json({ error: "No billing account yet" }, { status: 400 });
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const url = await createPortalUrl({ customerId: ws.billing.stripeCustomerId, origin: `${proto}://${host}` });
  return NextResponse.json({ url });
}
