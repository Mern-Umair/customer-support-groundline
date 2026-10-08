import { z } from "zod";
import { badRequest, getApiContext, unauthorized } from "@/lib/auth/api";
import { answerQuestion, ChatError } from "@/lib/chat/answer";
import { answerContextFrom } from "@/lib/chat/context";
import { sseResponse } from "@/lib/chat/sse-response";
import { toObjectId } from "@/lib/tenant";

export const maxDuration = 60;

const Body = z.object({
  message: z.string().trim().min(1).max(2000),
  conversationId: z.string().optional(),
});

/** Dashboard playground chat. Streams SSE events (meta, sources, text, done, error). */
export async function POST(request: Request) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Type a message");
  const conversationId = parsed.data.conversationId ? toObjectId(parsed.data.conversationId) : undefined;
  if (parsed.data.conversationId && !conversationId) return badRequest("Invalid conversation id");

  const ac = await answerContextFrom(ctx);
  try {
    const events = answerQuestion(ac, {
      channel: "playground",
      participantId: ctx.user._id.toHexString(),
      conversationId: conversationId ?? undefined,
      question: parsed.data.message,
      signal: request.signal,
    });
    return sseResponse(events, request.signal);
  } catch (err) {
    if (err instanceof ChatError) return badRequest(err.message);
    throw err;
  }
}
