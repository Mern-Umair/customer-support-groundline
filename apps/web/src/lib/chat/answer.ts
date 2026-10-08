import { ObjectId, type Db } from "mongodb";
import type { HandoffReason } from "@groundline/shared";
import { conversations, messages } from "../db/collections";
import type { Citation, ConversationChannel, ConversationDoc, ConversationStatus, MessageDoc } from "../db/types";
import type { Embedder } from "../ingest/embeddings";
import { searchChunks, type RetrievedChunk } from "../ingest/retrieval";
import { estimateCostUsd } from "../llm/pricing";
import type { LLMProvider } from "../llm/types";
import { publicRealtimeUrl, signRealtimeToken } from "../realtime/server";
import { scoped } from "../tenant";
import { parseAnswer } from "./citations";
import { broadcastMessage, requestHandoff, wantsHuman } from "./handoff";
import { buildMessages, REFUSAL_SENTENCE } from "./prompt";

export interface AnswerContext {
  db: Db;
  workspaceId: ObjectId;
  workspaceName: string;
  embedder: Embedder;
  llm: LLMProvider;
}

export interface AnswerInput {
  channel: ConversationChannel;
  participantId: string;
  conversationId?: ObjectId;
  question: string;
  signal?: AbortSignal;
}

/** Events streamed to the client while an answer is produced. */
export type AnswerEvent =
  | { type: "meta"; conversationId: string; visitorMessageId: string; status: ConversationStatus; realtime: { url: string; token: string } | null }
  | { type: "sources"; sources: SourceSummary[] }
  | { type: "text"; text: string }
  | { type: "handoff"; reason: HandoffReason; status: ConversationStatus; note: string; noteId: string | null }
  | { type: "done"; messageId: string; role: "assistant" | "system"; text: string; citations: CitationDto[]; refused: boolean; usage: MessageDoc["usage"] | null; retrieval: MessageDoc["retrieval"] | null }
  | { type: "error"; message: string };

export interface SourceSummary {
  n: number;
  chunkId: string;
  title: string;
  url?: string;
  pageNumber?: number;
  score: number;
  preview: string;
}

export interface CitationDto {
  n: number;
  chunkId: string;
  title: string;
  url?: string;
  pageNumber?: number;
}

/** Below this Atlas score (cosine mapped to 0..1) we do not bother the model. */
export const MIN_RETRIEVAL_SCORE = 0.5;
const TOP_K = 6;

export const HANDOFF_NOTE = "I'm bringing in a teammate. They will reply right here; you can keep typing in the meantime.";
export const HUMAN_MODE_NOTE = "A teammate has this conversation. They will reply here.";

export class ChatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatError";
  }
}

async function getOrCreateConversation(ctx: AnswerContext, input: AnswerInput): Promise<ConversationDoc> {
  if (input.conversationId) {
    const existing = await conversations(ctx.db).findOne(scoped(ctx.workspaceId, { _id: input.conversationId }));
    if (!existing || existing.participantId !== input.participantId) throw new ChatError("Conversation not found");
    return existing;
  }
  const now = new Date();
  const doc: ConversationDoc = {
    _id: new ObjectId(),
    workspaceId: ctx.workspaceId,
    channel: input.channel,
    status: "ai",
    participantId: input.participantId,
    title: input.question.slice(0, 80),
    messageCount: 0,
    totals: { inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 0, answers: 0, refusals: 0 },
    createdAt: now,
    lastMessageAt: now,
  };
  await conversations(ctx.db).insertOne(doc);
  return doc;
}

async function recentHistory(ctx: AnswerContext, conversationId: ObjectId) {
  const docs = await messages(ctx.db)
    .find(scoped(ctx.workspaceId, { conversationId, role: { $in: ["visitor", "assistant", "agent"] } }), { sort: { createdAt: -1 }, limit: 8, projection: { role: 1, content: 1 } })
    .toArray();
  return docs.reverse().map((m) => ({ role: m.role as "visitor" | "assistant" | "agent", content: m.content }));
}

async function storeMessage(ctx: AnswerContext, m: Omit<MessageDoc, "_id" | "workspaceId" | "createdAt">): Promise<MessageDoc> {
  const doc: MessageDoc = { _id: new ObjectId(), workspaceId: ctx.workspaceId, createdAt: new Date(), ...m };
  await messages(ctx.db).insertOne(doc);
  await broadcastMessage(doc);
  return doc;
}

async function visitorRealtime(ctx: AnswerContext, conversationId: ObjectId): Promise<{ url: string; token: string } | null> {
  const url = publicRealtimeUrl();
  if (!url) return null;
  const token = await signRealtimeToken({ role: "visitor", workspaceId: ctx.workspaceId.toHexString(), conversationId: conversationId.toHexString() });
  return { url, token };
}

/**
 * Full turn as an async generator so a route handler can forward events as SSE:
 *  1. store the visitor message (and broadcast it);
 *  2. if a human owns the conversation, or the visitor asks for one, do not call the model;
 *  3. otherwise retrieve, prompt, stream, validate citations, store the answer with usage;
 *  4. a refusal triggers a handoff request (dashboard rings).
 */
export async function* answerQuestion(ctx: AnswerContext, input: AnswerInput): AsyncGenerator<AnswerEvent> {
  const question = input.question.trim();
  if (!question) throw new ChatError("Ask a question");
  const started = performance.now();

  const conversation = await getOrCreateConversation(ctx, input);
  const visitorMsg = await storeMessage(ctx, { conversationId: conversation._id, role: "visitor", content: question });
  await conversations(ctx.db).updateOne(scoped(ctx.workspaceId, { _id: conversation._id }), { $set: { lastMessageAt: new Date() }, $inc: { messageCount: 1 } });

  yield { type: "meta", conversationId: conversation._id.toHexString(), visitorMessageId: visitorMsg._id.toHexString(), status: conversation.status, realtime: await visitorRealtime(ctx, conversation._id) };

  // Handoff applies to real visitors. The playground is the owner's test bench and stays AI-only.
  const handoffEnabled = input.channel === "widget";

  // Human mode: the message is for the agent, not the model.
  if (conversation.status === "human") {
    yield { type: "handoff", reason: conversation.handoff?.reason ?? "visitor_asked", status: "human", note: HUMAN_MODE_NOTE, noteId: null };
    yield { type: "done", messageId: visitorMsg._id.toHexString(), role: "system", text: "", citations: [], refused: false, usage: null, retrieval: null };
    return;
  }

  // Explicit request for a person: no model call, flag and ring.
  if (handoffEnabled && wantsHuman(question)) {
    const note = await storeMessage(ctx, { conversationId: conversation._id, role: "system", content: HANDOFF_NOTE });
    await conversations(ctx.db).updateOne(scoped(ctx.workspaceId, { _id: conversation._id }), { $inc: { messageCount: 1 } });
    await requestHandoff(ctx.db, conversation, "visitor_asked", question);
    yield { type: "handoff", reason: "visitor_asked", status: "human", note: HANDOFF_NOTE, noteId: note._id.toHexString() };
    yield { type: "done", messageId: note._id.toHexString(), role: "system", text: HANDOFF_NOTE, citations: [], refused: false, usage: null, retrieval: null };
    return;
  }

  const history = (await recentHistory(ctx, conversation._id)).slice(0, -1); // exclude the message we just stored

  let retrieved: RetrievedChunk[] = [];
  let retrievalError: string | undefined;
  try {
    retrieved = await searchChunks(ctx.db, ctx.workspaceId, ctx.embedder, question, { k: TOP_K });
  } catch (err) {
    retrievalError = err instanceof Error ? err.message : String(err);
  }
  const relevant = retrieved.filter((c) => c.score >= MIN_RETRIEVAL_SCORE);
  const { messages: prompt, used } = buildMessages({ workspaceName: ctx.workspaceName, question, chunks: relevant, history });

  yield {
    type: "sources",
    sources: used.map((c, i) => ({ n: i + 1, chunkId: c.chunkId, title: c.title, url: c.url, pageNumber: c.pageNumber, score: c.score, preview: c.text.slice(0, 200) })),
  };

  let raw = "";
  let usage: MessageDoc["usage"] | undefined;
  let firstTokenMs: number | null = null;
  let error: string | undefined;

  if (used.length === 0) {
    raw = REFUSAL_SENTENCE;
    yield { type: "text", text: raw };
    usage = { provider: ctx.llm.provider, model: ctx.llm.model, inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 0, firstTokenMs: null };
  } else {
    try {
      for await (const ev of ctx.llm.stream(prompt, { signal: input.signal })) {
        if (ev.type === "text") {
          if (firstTokenMs === null) firstTokenMs = Math.round(performance.now() - started);
          raw += ev.text;
          yield { type: "text", text: ev.text };
        } else {
          const tokens = ev.usage ?? { inputTokens: 0, outputTokens: 0 };
          usage = { provider: ctx.llm.provider, model: ctx.llm.model, inputTokens: tokens.inputTokens, outputTokens: tokens.outputTokens, costUsd: estimateCostUsd(ctx.llm.model, ev.usage), latencyMs: 0, firstTokenMs };
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      if (!raw) {
        raw = REFUSAL_SENTENCE;
        yield { type: "text", text: raw };
      }
    }
  }

  const parsed = parseAnswer(raw, used.length);
  const citations: Citation[] = parsed.cited.map((n) => {
    const c = used[n - 1];
    return { n, chunkId: new ObjectId(c.chunkId), sourceId: new ObjectId(c.sourceId), title: c.title, url: c.url, pageNumber: c.pageNumber };
  });
  const latencyMs = Math.round(performance.now() - started);
  const finalUsage: MessageDoc["usage"] = {
    provider: ctx.llm.provider,
    model: ctx.llm.model,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    costUsd: usage?.costUsd ?? null,
    latencyMs,
    firstTokenMs,
  };
  const retrieval: MessageDoc["retrieval"] = { k: TOP_K, topScore: retrieved[0]?.score ?? null, considered: retrieved.length };

  const assistantMsg = await storeMessage(ctx, {
    conversationId: conversation._id,
    role: "assistant",
    content: parsed.text,
    citations,
    refused: parsed.refused,
    retrieval,
    usage: finalUsage,
    ...(error || retrievalError ? { error: [error, retrievalError].filter(Boolean).join(" | ").slice(0, 500) } : {}),
  });
  await conversations(ctx.db).updateOne(scoped(ctx.workspaceId, { _id: conversation._id }), {
    $set: { lastMessageAt: new Date() },
    $inc: {
      messageCount: 1,
      "totals.inputTokens": finalUsage.inputTokens,
      "totals.outputTokens": finalUsage.outputTokens,
      "totals.costUsd": finalUsage.costUsd ?? 0,
      "totals.latencyMs": latencyMs,
      "totals.answers": 1,
      "totals.refusals": parsed.refused ? 1 : 0,
    },
  });

  if (parsed.refused && handoffEnabled) {
    const rang = await requestHandoff(ctx.db, conversation, "low_confidence", question);
    if (rang) {
      const note = await storeMessage(ctx, { conversationId: conversation._id, role: "system", content: HANDOFF_NOTE });
      await conversations(ctx.db).updateOne(scoped(ctx.workspaceId, { _id: conversation._id }), { $inc: { messageCount: 1 } });
      yield { type: "handoff", reason: "low_confidence", status: "human", note: HANDOFF_NOTE, noteId: note._id.toHexString() };
    }
  }

  yield {
    type: "done",
    messageId: assistantMsg._id.toHexString(),
    role: "assistant",
    text: parsed.text,
    citations: citations.map((c) => ({ n: c.n, chunkId: c.chunkId.toHexString(), title: c.title, url: c.url, pageNumber: c.pageNumber })),
    refused: parsed.refused,
    usage: finalUsage,
    retrieval,
  };
}

export async function recordFeedback(db: Db, workspaceId: ObjectId, messageId: ObjectId, vote: "up" | "down"): Promise<boolean> {
  const res = await messages(db).updateOne(scoped(workspaceId, { _id: messageId, role: "assistant" }), { $set: { feedback: { vote, at: new Date() } } });
  return res.matchedCount === 1;
}

/** Agent reply: stored, broadcast, and the conversation is marked as taken by that agent. */
export async function agentReply(db: Db, workspaceId: ObjectId, conversationId: ObjectId, agent: { id: ObjectId; name: string }, content: string): Promise<MessageDoc> {
  const convo = await conversations(db).findOne(scoped(workspaceId, { _id: conversationId }));
  if (!convo) throw new ChatError("Conversation not found");
  const doc: MessageDoc = { _id: new ObjectId(), workspaceId, conversationId, role: "agent", content: content.trim(), createdAt: new Date() };
  await messages(db).insertOne(doc);
  await conversations(db).updateOne(scoped(workspaceId, { _id: conversationId }), {
    $set: { status: "human", lastMessageAt: doc.createdAt, "handoff.agentId": agent.id, ...(convo.handoff?.takenAt ? {} : { "handoff.takenAt": doc.createdAt }), ...(convo.handoff ? {} : { "handoff.requestedAt": doc.createdAt, "handoff.reason": "visitor_asked" }) },
    $inc: { messageCount: 1 },
  });
  await broadcastMessage(doc);
  return doc;
}
