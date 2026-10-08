import { NextResponse } from "next/server";
import { badRequest, getApiContext, unauthorized } from "@/lib/auth/api";
import { createSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { acceptInvite, TeamError } from "@/lib/team/invites";

/** Signed-in user joins the invited workspace and switches to it. */
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const { token } = await params;
  try {
    const { workspaceId } = await acceptInvite(await getDb(), token, ctx.user._id);
    await createSession({ userId: ctx.user._id.toHexString(), workspaceId: workspaceId.toHexString() });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof TeamError) return badRequest(err.message);
    throw err;
  }
}
