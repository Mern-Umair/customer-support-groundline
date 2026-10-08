import { NextResponse } from "next/server";
import { getApiContext, unauthorized } from "@/lib/auth/api";
import { getDb } from "@/lib/db";
import { seedMockOrders } from "@/lib/tools/registry";

/** Seeds the fictional orders the lookupOrder tool reads. Idempotent. */
export async function POST() {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const created = await seedMockOrders(await getDb(), ctx.workspace._id);
  return NextResponse.json({ created });
}
