import { NextResponse } from "next/server";
import { z } from "zod";
import { answerQuestion, ChatError } from "@/lib/chat/answer";
import { sseResponse } from "@/lib/chat/sse-response";
import { getDb } from "@/lib/db";
import { getEmbedder } from "@/lib/ingest/embedder";
import { getChatProvider } from "@/lib/llm/provider";
import { toObjectId } from "@/lib/tenant";
import { findWorkspaceByPublicKey, gatePublicChat } from "@/lib/widget/public";

export const maxDuration = 60;

const Body = z.object({
  key: z.string().min(1),
  visitorId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  message: z.string().trim().min(1).max(2000),
  conversationId: z.string().optional(),
});

/**
 * Public, unauthenticated chat for the embedded widget. The public key selects the tenant;
 * the visitor id scopes the conversation. Rate limits and the plan quota apply.
 * Same-origin with the embed iframe, so no CORS headers are needed.
 */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { key, visitorId, message, conversationId } = parsed.data;

  const db = await getDb();
  const ws = await findWorkspaceByPublicKey(db, key);
  if (!ws) return NextResponse.json({ error: "Unknown widget key" }, { status: 404 });

  const gate = await gatePublicChat(db, ws, visitorId);
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  const convoId = conversationId ? toObjectId(conversationId) : undefined;
  if (conversationId && !convoId) return NextResponse.json({ error: "Invalid conversation id" }, { status: 400 });

  try {
    const events = answerQuestion(
      { db, workspaceId: ws._id, workspaceName: ws.name, embedder: getEmbedder(), llm: getChatProvider(), toolsEnabled: Boolean(ws.toolsEnabled) },
      { channel: "widget", participantId: visitorId, conversationId: convoId ?? undefined, question: message, signal: request.signal },
    );
    return sseResponse(events, request.signal);
  } catch (err) {
    if (err instanceof ChatError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
