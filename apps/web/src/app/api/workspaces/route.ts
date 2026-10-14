import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, getApiContext, unauthorized } from "@/lib/auth/api";
import { createWorkspace, MAX_OWNED_WORKSPACES } from "@/lib/auth/service";
import { createSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { memberships } from "@/lib/db/collections";

const Body = z.object({ name: z.string().trim().min(2).max(80) });

/** Creates another workspace owned by the signed-in user and switches the session to it. */
export async function POST(request: Request) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Enter a workspace name (2-80 characters)");
  const db = await getDb();
  const owned = await memberships(db).countDocuments({ userId: ctx.user._id, role: "owner" });
  if (owned >= MAX_OWNED_WORKSPACES) return badRequest(`You already own ${MAX_OWNED_WORKSPACES} workspaces`);
  const workspaceId = await createWorkspace(db, ctx.user._id, parsed.data.name);
  await createSession({ userId: ctx.user._id.toHexString(), workspaceId: workspaceId.toHexString() });
  return NextResponse.json({ id: workspaceId.toHexString(), name: parsed.data.name }, { status: 201 });
}
