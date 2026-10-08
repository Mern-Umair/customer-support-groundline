import { NextResponse } from "next/server";
import { toLiveMessage } from "@/lib/chat/handoff";
import { getDb } from "@/lib/db";
import { conversations, messages } from "@/lib/db/collections";
import { scoped, toObjectId } from "@/lib/tenant";
import { findWorkspaceByPublicKey } from "@/lib/widget/public";

/**
 * Polling fallback for the widget when the realtime server is unreachable (it sleeps on the
 * free tier). Returns agent/system messages after `after` for the visitor's own conversation.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const key = q.get("key") ?? "";
  const visitorId = q.get("visitorId") ?? "";
  const conversationId = toObjectId(q.get("conversationId") ?? "");
  const after = toObjectId(q.get("after") ?? "");
  const db = await getDb();
  const ws = await findWorkspaceByPublicKey(db, key);
  if (!ws || !conversationId || !/^[A-Za-z0-9_-]{8,64}$/.test(visitorId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const convo = await conversations(db).findOne(scoped(ws._id, { _id: conversationId }), { projection: { participantId: 1, status: 1 } });
  if (!convo || convo.participantId !== visitorId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const list = await messages(db)
    .find(scoped(ws._id, { conversationId, role: { $in: ["agent", "system"] }, ...(after ? { _id: { $gt: after } } : {}) }), { sort: { _id: 1 }, limit: 100 })
    .toArray();
  return NextResponse.json({ status: convo.status, messages: list.map(toLiveMessage) });
}
