import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { conversations, messages } from "@/lib/db/collections";
import { scoped, toObjectId } from "@/lib/tenant";
import { findWorkspaceByPublicKey } from "@/lib/widget/public";

const Body = z.object({
  key: z.string().min(1),
  visitorId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  messageId: z.string().min(1),
  vote: z.enum(["up", "down"]),
});

/** Visitor feedback on an assistant message. Only the visitor who owns the conversation may vote. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { key, visitorId, messageId, vote } = parsed.data;
  const db = await getDb();
  const ws = await findWorkspaceByPublicKey(db, key);
  const msgId = toObjectId(messageId);
  if (!ws || !msgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const msg = await messages(db).findOne(scoped(ws._id, { _id: msgId, role: "assistant" }), { projection: { conversationId: 1 } });
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const convo = await conversations(db).findOne(scoped(ws._id, { _id: msg.conversationId }), { projection: { participantId: 1 } });
  if (!convo || convo.participantId !== visitorId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await messages(db).updateOne(scoped(ws._id, { _id: msgId }), { $set: { feedback: { vote, at: new Date() } } });
  return NextResponse.json({ ok: true });
}
