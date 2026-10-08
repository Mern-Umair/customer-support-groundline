import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, getApiContext, notFound, unauthorized } from "@/lib/auth/api";
import { setConversationStatus } from "@/lib/chat/handoff";
import { getDb } from "@/lib/db";
import { toObjectId } from "@/lib/tenant";

const Body = z.object({ status: z.enum(["ai", "human", "closed"]) });

/** Take over (human), hand back to the assistant (ai), or close. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const { id } = await params;
  const conversationId = toObjectId(id);
  if (!conversationId) return notFound();
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("status must be ai, human or closed");
  const ok = await setConversationStatus(await getDb(), ctx.workspace._id, conversationId, parsed.data.status, { id: ctx.user._id, name: ctx.user.name });
  return ok ? NextResponse.json({ ok: true, status: parsed.data.status }) : notFound();
}
