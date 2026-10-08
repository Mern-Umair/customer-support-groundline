import { ObjectId, type Db } from "mongodb";
import { conversations, messages } from "../db/collections";
import type { Citation, ConversationChannel, ConversationDoc, MessageDoc } from "../db/types";
import type { Embedder } from "../ingest/embeddings";
import { searchChunks, type RetrievedChunk } from "../ingest/retrieval";
import { estimateCostUsd } from "../llm/pricing";
import type { LLMProvider } from "../llm/types";
import { scoped } from "../tenant";
import { parseAnswer } from "./citations";
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
  | { type: "meta"; conversationId: string; visitorMessageId: string }
  | { type: "sources"; sources: SourceSummary[] }
  | { type: "text"; text: string }
  | { type: "done"; messageId: string; text: string; citations: CitationDto[]; refused: boolean; usage: MessageDoc["usage"]; retrieval: MessageDoc["retrieval"] }
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

export class ChatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatError";
  }
}

async function getOrCreateConversation(ctx: AnswerContext, input: AnswerInput): Promise<ConversationDoc> {
  if (input.conversationId) {
    const existing = await conversations(ctx.db).findOne(scoped(ctx.workspaceId, { _id: input.conversationId }));
    if (!existing) throw new ChatError("Conversation not found");
    if (existing.participantId !== input.participantId) throw new ChatError("Conversation not found");
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
    .find(scoped(ctx.workspaceId, { conversationId }), { sort: { createdAt: -1 }, limit: 8, projection: { role: 1, content: 1 } })
    .toArray();
  return docs.reverse().map((m) => ({ role: m.role, content: m.content }));
}

/**
 * Full RAG turn as an async generator: store the visitor message, retrieve, prompt, stream
 * the model, validate citations, store the assistant message with usage, update totals.
 * The generator shape lets a route handler forward events as SSE without buffering.
 */
export async function* answerQuestion(ctx: AnswerContext, input: AnswerInput): AsyncGenerator<AnswerEvent> {
  const question = input.question.trim();
  if (!question) throw new ChatError("Ask a question");
  const started = performance.now();

  const conversation = await getOrCreateConversation(ctx, input);
  const history = await recentHistory(ctx, conversation._id);

  const visitorMsg: MessageDoc = {
    _id: new ObjectId(),
    workspaceId: ctx.workspaceId,
    conversationId: conversation._id,
    role: "visitor",
    content: question,
    createdAt: new Date(),
  };
  await messages(ctx.db).insertOne(visitorMsg);
  yield { type: "meta", conversationId: conversation._id.toHexString(), visitorMessageId: visitorMsg._id.toHexString() };

  // Retrieval, tenant-scoped inside the vector search.
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

  // Generation. No sources at all → refuse without a model call (cheaper, deterministic).
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
          usage = {
            provider: ctx.llm.provider,
            model: ctx.llm.model,
            inputTokens: tokens.inputTokens,
            outputTokens: tokens.outputTokens,
            costUsd: estimateCostUsd(ctx.llm.model, ev.usage),
            latencyMs: 0,
            firstTokenMs,
          };
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

  const assistantMsg: MessageDoc = {
    _id: new ObjectId(),
    workspaceId: ctx.workspaceId,
    conversationId: conversation._id,
    role: "assistant",
    content: parsed.text,
    citations,
    refused: parsed.refused,
    retrieval,
    usage: finalUsage,
    ...(error || retrievalError ? { error: [error, retrievalError].filter(Boolean).join(" | ").slice(0, 500) } : {}),
    createdAt: new Date(),
  };
  await messages(ctx.db).insertOne(assistantMsg);
  await conversations(ctx.db).updateOne(scoped(ctx.workspaceId, { _id: conversation._id }), {
    $set: { lastMessageAt: new Date() },
    $inc: {
      messageCount: 2,
      "totals.inputTokens": finalUsage.inputTokens,
      "totals.outputTokens": finalUsage.outputTokens,
      "totals.costUsd": finalUsage.costUsd ?? 0,
      "totals.latencyMs": latencyMs,
      "totals.answers": 1,
      "totals.refusals": parsed.refused ? 1 : 0,
    },
  });

  yield {
    type: "done",
    messageId: assistantMsg._id.toHexString(),
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
