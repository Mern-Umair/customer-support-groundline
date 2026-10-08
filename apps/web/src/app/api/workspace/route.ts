import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, getApiContext, unauthorized } from "@/lib/auth/api";
import { getDb } from "@/lib/db";
import { workspaces } from "@/lib/db/collections";

const Body = z.object({ evalsPublic: z.boolean().optional() });

/** Workspace settings an owner can change. */
export async function PATCH(request: Request) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== "owner") return NextResponse.json({ error: "Only the owner can change workspace settings" }, { status: 403 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid settings");
  const update: Record<string, unknown> = {};
  if (parsed.data.evalsPublic !== undefined) update.evalsPublic = parsed.data.evalsPublic;
  await workspaces(await getDb()).updateOne({ _id: ctx.workspace._id }, { $set: update });
  return NextResponse.json({ ok: true, ...update });
}
