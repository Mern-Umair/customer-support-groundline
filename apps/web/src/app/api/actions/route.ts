import { NextResponse } from "next/server";
import { getApiContext, unauthorized } from "@/lib/auth/api";
import { getDb } from "@/lib/db";
import { pendingActions } from "@/lib/db/collections";
import { scoped, toObjectId } from "@/lib/tenant";
import { toActionDto } from "@/lib/tools/dto";

/** Pending (or, with ?all=1, recent) actions for the workspace; ?conversation=<id> narrows. */
export async function GET(request: Request) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const q = new URL(request.url).searchParams;
  const conversationId = toObjectId(q.get("conversation") ?? "");
  const all = q.get("all") === "1";
  const list = await pendingActions(await getDb())
    .find(scoped(ctx.workspace._id, { ...(all ? {} : { status: "pending" }), ...(conversationId ? { conversationId } : {}) }), { sort: { requestedAt: -1 }, limit: 100 })
    .toArray();
  return NextResponse.json({ actions: list.map(toActionDto) });
}
