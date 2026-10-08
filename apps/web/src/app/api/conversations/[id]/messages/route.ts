import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, getApiContext, notFound, unauthorized } from "@/lib/auth/api";
import { agentReply, ChatError } from "@/lib/chat/answer";
import { toLiveMessage } from "@/lib/chat/handoff";
import { getDb } from "@/lib/db";
import { conversations, messages } from "@/lib/db/collections";
import { scoped, toObjectId } from "@/lib/tenant";

type Params = { params: Promise<{ id: string }> };

/** Messages after a given id (polling fallback for the dashboard when the socket is down). */
export async function GET(request: Request, { params }: Params) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const { id } = await params;
  const conversationId = toObjectId(id);
  if (!conversationId) return notFound();
  const db = await getDb();
  const convo = await conversations(db).findOne(scoped(ctx.workspace._id, { _id: conversationId }), { projection: { status: 1 } });
  if (!convo) return notFound();
  const after = toObjectId(new URL(request.url).searchParams.get("after") ?? "");
  const list = await messages(db)
    .find(scoped(ctx.workspace._id, { conversationId, ...(after ? { _id: { $gt: after } } : {}) }), { sort: { _id: 1 }, limit: 200 })
    .toArray();
  return NextResponse.json({ status: convo.status, messages: list.map(toLiveMessage) });
}

const Body = z.object({ content: z.string().trim().min(1).max(4000) });

/** Agent reply from the dashboard. */
export async function POST(request: Request, { params }: Params) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const { id } = await params;
  const conversationId = toObjectId(id);
  if (!conversationId) return notFound();
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Type a reply");
  try {
    const doc = await agentReply(await getDb(), ctx.workspace._id, conversationId, { id: ctx.user._id, name: ctx.user.name }, parsed.data.content);
    return NextResponse.json({ message: toLiveMessage(doc) }, { status: 201 });
  } catch (err) {
    if (err instanceof ChatError) return notFound();
    throw err;
  }
}
