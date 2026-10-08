import { NextResponse } from "next/server";
import { getApiContext, unauthorized } from "@/lib/auth/api";
import { forbidden, isOwner } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { seedMockOrders } from "@/lib/tools/registry";

/** Seeds the fictional orders the lookupOrder tool reads. Idempotent. */
export async function POST() {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  if (!isOwner(ctx)) return forbidden();
  const created = await seedMockOrders(await getDb(), ctx.workspace._id);
  return NextResponse.json({ created });
}
