import type { Db, ObjectId } from "mongodb";
import type { Embedder } from "../ingest/embeddings";
import { searchChunks, type RetrievedChunk } from "../ingest/retrieval";
import { estimateCostUsd } from "../llm/pricing";
import type { LLMProvider } from "../llm/types";
import { parseAnswer } from "./citations";
import { buildMessages, REFUSAL_SENTENCE } from "./prompt";

/** Below this Atlas score (cosine mapped to 0..1) we do not bother the model. */
export const MIN_RETRIEVAL_SCORE = 0.5;
export const TOP_K = 6;

export interface GenerateContext {
  db: Db;
  workspaceId: ObjectId;
  workspaceName: string;
  embedder: Embedder;
  llm: LLMProvider;
}

export interface GenerateInput {
  question: string;
  history?: { role: "visitor" | "assistant" | "agent"; content: string }[];
  signal?: AbortSignal;
  /** Called with each streamed text delta. */
  onText?: (text: string) => void;
  /** Called once retrieval is done, before generation. */
  onSources?: (used: RetrievedChunk[]) => void;
}

export interface GenerateOutput {
  text: string;
  cited: number[];
  used: RetrievedChunk[];
  retrieved: RetrievedChunk[];
  refused: boolean;
  usage: { provider: string; model: string; inputTokens: number; outputTokens: number; costUsd: number | null; latencyMs: number; firstTokenMs: number | null };
  error?: string;
}

/**
 * One grounded answer with no side effects: retrieve (tenant-scoped), gate by score,
 * prompt, stream, validate citations. Used by live chat (which stores the result) and by
 * the eval runner (which does not).
 */
export async function generateGrounded(ctx: GenerateContext, input: GenerateInput): Promise<GenerateOutput> {
  const started = performance.now();
  let retrieved: RetrievedChunk[] = [];
  let retrievalError: string | undefined;
  try {
    retrieved = await searchChunks(ctx.db, ctx.workspaceId, ctx.embedder, input.question, { k: TOP_K });
  } catch (err) {
    retrievalError = err instanceof Error ? err.message : String(err);
  }
  const relevant = retrieved.filter((c) => c.score >= MIN_RETRIEVAL_SCORE);
  const { messages: prompt, used } = buildMessages({ workspaceName: ctx.workspaceName, question: input.question, chunks: relevant, history: input.history });
  input.onSources?.(used);

  let raw = "";
  let tokens = { inputTokens: 0, outputTokens: 0 };
  let costUsd: number | null = 0;
  let firstTokenMs: number | null = null;
  let error: string | undefined;

  if (used.length === 0) {
    raw = REFUSAL_SENTENCE;
    input.onText?.(raw);
  } else {
    costUsd = null;
    try {
      for await (const ev of ctx.llm.stream(prompt, { signal: input.signal })) {
        if (ev.type === "text") {
          if (firstTokenMs === null) firstTokenMs = Math.round(performance.now() - started);
          raw += ev.text;
          input.onText?.(ev.text);
        } else {
          tokens = ev.usage ?? tokens;
          costUsd = estimateCostUsd(ctx.llm.model, ev.usage);
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      if (!raw) {
        raw = REFUSAL_SENTENCE;
        input.onText?.(raw);
      }
    }
  }

  const parsed = parseAnswer(raw, used.length);
  const combinedError = [error, retrievalError].filter(Boolean).join(" | ") || undefined;
  return {
    text: parsed.text,
    cited: parsed.cited,
    used,
    retrieved,
    refused: parsed.refused,
    usage: { provider: ctx.llm.provider, model: ctx.llm.model, inputTokens: tokens.inputTokens, outputTokens: tokens.outputTokens, costUsd, latencyMs: Math.round(performance.now() - started), firstTokenMs },
    ...(combinedError ? { error: combinedError.slice(0, 500) } : {}),
  };
}
