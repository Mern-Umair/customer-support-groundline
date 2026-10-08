import { parseSse } from "./sse";
import { LLMError, type ChatMessage, type LLMProvider, type StreamEvent, type StreamOptions, type Usage } from "./types";

export interface GeminiProviderOptions {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

interface GeminiPart {
  text?: string;
  thought?: boolean;
  functionCall?: { id?: string; name?: string; args?: Record<string, unknown> };
  functionResponse?: { id?: string; name: string; response: Record<string, unknown> };
}
interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}
interface GeminiChunk {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
}

export const DEFAULT_GEMINI_CHAT_MODEL = "gemini-3.5-flash-lite";

/** Maps our provider-agnostic messages to Gemini `contents`, merging consecutive same-role turns. */
export function toGeminiContents(messages: ChatMessage[]): GeminiContent[] {
  const out: GeminiContent[] = [];
  const push = (role: GeminiContent["role"], parts: GeminiPart[]) => {
    const last = out[out.length - 1];
    if (last && last.role === role) last.parts.push(...parts);
    else out.push({ role, parts });
  };
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "user") push("user", [{ text: m.content }]);
    else if (m.role === "assistant") {
      const parts: GeminiPart[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const c of m.toolCalls ?? []) parts.push({ functionCall: { id: c.id, name: c.name, args: c.args } });
      if (parts.length) push("model", parts);
    } else if (m.role === "tool") {
      let response: Record<string, unknown>;
      try {
        const parsed = JSON.parse(m.content) as unknown;
        response = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : { result: parsed };
      } catch {
        response = { result: m.content };
      }
      push("user", [{ functionResponse: { id: m.toolCallId, name: m.name ?? "tool", response } }]);
    }
  }
  return out;
}

/** Gemini via REST `streamGenerateContent?alt=sse`. System prompt goes to `systemInstruction`. */
export class GeminiProvider implements LLMProvider {
  readonly provider = "gemini";
  readonly model: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: GeminiProviderOptions) {
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? DEFAULT_GEMINI_CHAT_MODEL;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async *stream(messages: ChatMessage[], opts: StreamOptions = {}): AsyncIterable<StreamEvent> {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const body: Record<string, unknown> = {
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: toGeminiContents(messages),
      generationConfig: {
        temperature: opts.temperature ?? 0.2,
        maxOutputTokens: opts.maxOutputTokens ?? 1024,
      },
    };
    if (opts.tools?.length) {
      body.tools = [{ functionDeclarations: opts.tools.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.parameters })) }];
      body.toolConfig = { functionCallingConfig: { mode: "AUTO" } };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?alt=sse`;
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      throw new LLMError(`Gemini request failed (${res.status}): ${detail.slice(0, 300)}`, res.status, res.status === 429 || res.status >= 500);
    }

    let usage: Usage | null = null;
    let finishReason: string | null = null;
    let callIndex = 0;
    for await (const data of parseSse(res.body)) {
      let chunk: GeminiChunk;
      try {
        chunk = JSON.parse(data) as GeminiChunk;
      } catch {
        continue;
      }
      if (chunk.error) throw new LLMError(`Gemini error: ${chunk.error.message ?? chunk.error.status}`);
      if (chunk.promptFeedback?.blockReason) throw new LLMError(`Gemini blocked the prompt: ${chunk.promptFeedback.blockReason}`);
      const cand = chunk.candidates?.[0];
      for (const part of cand?.content?.parts ?? []) {
        if (part.functionCall?.name) {
          callIndex += 1;
          yield { type: "tool_call", call: { id: part.functionCall.id ?? `call_${callIndex}`, name: part.functionCall.name, args: part.functionCall.args ?? {} } };
        } else if (part.text && !part.thought) yield { type: "text", text: part.text };
      }
      if (cand?.finishReason) finishReason = cand.finishReason;
      if (chunk.usageMetadata) {
        usage = {
          inputTokens: chunk.usageMetadata.promptTokenCount ?? 0,
          outputTokens: (chunk.usageMetadata.candidatesTokenCount ?? 0) + (chunk.usageMetadata.thoughtsTokenCount ?? 0),
        };
      }
    }
    yield { type: "done", usage, finishReason };
  }
}
