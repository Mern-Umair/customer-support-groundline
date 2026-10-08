import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, getApiContext, notFound, unauthorized } from "@/lib/auth/api";
import { recordFeedback } from "@/lib/chat/answer";
import { getDb } from "@/lib/db";
import { toObjectId } from "@/lib/tenant";

const Body = z.object({ vote: z.enum(["up", "down"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const { id } = await params;
  const messageId = toObjectId(id);
  if (!messageId) return notFound();
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("vote must be up or down");
  const ok = await recordFeedback(await getDb(), ctx.workspace._id, messageId, parsed.data.vote);
  return ok ? NextResponse.json({ ok: true }) : notFound();
}
