import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, getApiContext, unauthorized } from "@/lib/auth/api";
import { createSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { memberships, workspaces } from "@/lib/db/collections";
import { toObjectId } from "@/lib/tenant";

const Body = z.object({ workspaceId: z.string().min(1) });

/** Switch the active workspace (must be a member). Re-issues the session cookie. */
export async function POST(request: Request) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const parsed = Body.safeParse(await request.json().catch(() => null));
  const workspaceId = parsed.success ? toObjectId(parsed.data.workspaceId) : null;
  if (!workspaceId) return badRequest("Invalid workspace");
  const db = await getDb();
  const m = await memberships(db).findOne({ userId: ctx.user._id, workspaceId });
  if (!m) return NextResponse.json({ error: "Not a member of that workspace" }, { status: 403 });
  await createSession({ userId: ctx.user._id.toHexString(), workspaceId: workspaceId.toHexString() });
  return NextResponse.json({ ok: true });
}

/** Workspaces the signed-in user belongs to (for the switcher). */
export async function GET() {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const db = await getDb();
  const ms = await memberships(db).find({ userId: ctx.user._id }).toArray();
  const ws = await workspaces(db).find({ _id: { $in: ms.map((m) => m.workspaceId) } }, { projection: { name: 1, slug: 1, plan: 1 } }).toArray();
  return NextResponse.json({ workspaces: ws.map((w) => ({ id: w._id.toHexString(), name: w.name, plan: w.plan, role: ms.find((m) => m.workspaceId.equals(w._id))?.role ?? "agent", current: w._id.equals(ctx.workspace._id) })) });
}
