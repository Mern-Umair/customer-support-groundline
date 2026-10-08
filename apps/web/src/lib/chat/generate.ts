import type { Db, ObjectId } from "mongodb";
import type { Embedder } from "../ingest/embeddings";
import { searchChunks, type RetrievedChunk } from "../ingest/retrieval";
import { estimateCostUsd } from "../llm/pricing";
import type { ChatMessage, LLMProvider } from "../llm/types";
import type { ToolCall, ToolDefinition } from "../tools/types";
import { parseAnswer } from "./citations";
import { buildMessages, REFUSAL_SENTENCE } from "./prompt";

/** Below this Atlas score (cosine mapped to 0..1) we do not bother the model. */
export const MIN_RETRIEVAL_SCORE = 0.5;
export const TOP_K = 6;
/** Tool rounds per turn: enough for "look up, then answer", small enough to bound cost. */
const MAX_TOOL_ROUNDS = 2;

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
  /** Tools the model may call. Omit for knowledge-only answers (evals, playground without tools). */
  tools?: ToolDefinition[];
  /** Executes (or defers) a tool call and returns the JSON string the model sees. */
  runTool?: (call: ToolCall) => Promise<string>;
  /** Called when a tool call is about to run. */
  onToolCall?: (call: ToolCall) => void;
}

export interface ExecutedToolCall extends ToolCall {
  result: string;
}

export interface GenerateOutput {
  text: string;
  cited: number[];
  used: RetrievedChunk[];
  retrieved: RetrievedChunk[];
  refused: boolean;
  toolCalls: ExecutedToolCall[];
  usage: { provider: string; model: string; inputTokens: number; outputTokens: number; costUsd: number | null; latencyMs: number; firstTokenMs: number | null };
  error?: string;
}

/**
 * One grounded answer with no side effects of its own: retrieve (tenant-scoped), gate by
 * score, prompt, stream, validate citations. With tools, runs a bounded agent loop: a
 * tool call is executed through `runTool` and the result appended as a tool turn before
 * the model is asked again. Used by live chat (which stores the result) and by the eval
 * runner (which does not).
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
  const { messages: prompt, used } = buildMessages({ workspaceName: ctx.workspaceName, question: input.question, chunks: relevant, history: input.history, toolsAvailable: Boolean(input.tools?.length) });
  input.onSources?.(used);

  const toolsEnabled = Boolean(input.tools?.length && input.runTool);
  let raw = "";
  let tokens = { inputTokens: 0, outputTokens: 0 };
  let costUsd: number | null = 0;
  let firstTokenMs: number | null = null;
  let error: string | undefined;
  const executed: ExecutedToolCall[] = [];

  // Without sources and without tools there is nothing to say: refuse without a model call.
  if (used.length === 0 && !toolsEnabled) {
    raw = REFUSAL_SENTENCE;
    input.onText?.(raw);
  } else {
    costUsd = null;
    const messages: ChatMessage[] = [...prompt];
    try {
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const calls: ToolCall[] = [];
        let roundText = "";
        const allowTools = toolsEnabled && round < MAX_TOOL_ROUNDS;
        for await (const ev of ctx.llm.stream(messages, { signal: input.signal, tools: allowTools ? input.tools : undefined })) {
          if (ev.type === "text") {
            if (firstTokenMs === null) firstTokenMs = Math.round(performance.now() - started);
            roundText += ev.text;
            input.onText?.(ev.text);
          } else if (ev.type === "tool_call") {
            calls.push(ev.call);
          } else {
            const u = ev.usage ?? { inputTokens: 0, outputTokens: 0 };
            tokens = { inputTokens: tokens.inputTokens + u.inputTokens, outputTokens: tokens.outputTokens + u.outputTokens };
            const c = estimateCostUsd(ctx.llm.model, ev.usage);
            costUsd = c === null ? null : (costUsd ?? 0) + c;
          }
        }
        raw += roundText;
        if (!calls.length || !input.runTool) break;
        messages.push({ role: "assistant", content: roundText, toolCalls: calls });
        for (const call of calls) {
          input.onToolCall?.(call);
          const result = await input.runTool(call);
          executed.push({ ...call, result });
          messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: result });
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
  // A tool-based answer is not a refusal even if no document was cited.
  const refused = parsed.refused && executed.length === 0;
  const combinedError = [error, retrievalError].filter(Boolean).join(" | ") || undefined;
  return {
    text: parsed.text,
    cited: parsed.cited,
    used,
    retrieved,
    refused,
    toolCalls: executed,
    usage: { provider: ctx.llm.provider, model: ctx.llm.model, inputTokens: tokens.inputTokens, outputTokens: tokens.outputTokens, costUsd, latencyMs: Math.round(performance.now() - started), firstTokenMs },
    ...(combinedError ? { error: combinedError.slice(0, 500) } : {}),
  };
}
