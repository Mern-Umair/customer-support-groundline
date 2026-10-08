import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, getApiContext, unauthorized } from "@/lib/auth/api";
import { forbidden, isOwner } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { createInvite, listTeam, TeamError } from "@/lib/team/invites";

export async function GET() {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  return NextResponse.json(await listTeam(await getDb(), ctx.workspace._id));
}

const Body = z.object({ email: z.string().trim().email(), role: z.enum(["owner", "agent"]).default("agent") });

/** Owner creates an invite link (no email is sent on the free tier; the link is shown to copy). */
export async function POST(request: Request) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  if (!isOwner(ctx)) return forbidden();
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Enter a valid email");
  try {
    const invite = await createInvite(await getDb(), ctx.workspace._id, ctx.workspace.plan, ctx.user._id, parsed.data.email, parsed.data.role);
    return NextResponse.json({ invite: { id: invite._id.toHexString(), email: invite.email, role: invite.role, token: invite.token, expiresAt: invite.expiresAt.toISOString() } }, { status: 201 });
  } catch (err) {
    if (err instanceof TeamError) return badRequest(err.message);
    throw err;
  }
}
