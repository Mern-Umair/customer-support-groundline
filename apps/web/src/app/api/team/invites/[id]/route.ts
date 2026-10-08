import { NextResponse } from "next/server";
import { getApiContext, notFound, unauthorized } from "@/lib/auth/api";
import { forbidden, isOwner } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { toObjectId } from "@/lib/tenant";
import { revokeInvite } from "@/lib/team/invites";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  if (!isOwner(ctx)) return forbidden();
  const { id } = await params;
  const inviteId = toObjectId(id);
  if (!inviteId) return notFound();
  return (await revokeInvite(await getDb(), ctx.workspace._id, inviteId)) ? NextResponse.json({ ok: true }) : notFound();
}
