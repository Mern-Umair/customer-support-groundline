import { NextResponse } from "next/server";
import { badRequest, getApiContext, notFound, unauthorized } from "@/lib/auth/api";
import { forbidden, isOwner } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { toObjectId } from "@/lib/tenant";
import { removeMember, TeamError } from "@/lib/team/invites";

export async function DELETE(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  if (!isOwner(ctx)) return forbidden();
  const { userId } = await params;
  const target = toObjectId(userId);
  if (!target) return notFound();
  try {
    return (await removeMember(await getDb(), ctx.workspace._id, ctx.user._id, target)) ? NextResponse.json({ ok: true }) : notFound();
  } catch (err) {
    if (err instanceof TeamError) return badRequest(err.message);
    throw err;
  }
}
