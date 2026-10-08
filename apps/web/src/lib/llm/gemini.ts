import { parseSse } from "./sse";
import { LLMError, type ChatMessage, type LLMProvider, type StreamEvent, type StreamOptions, type Usage } from "./types";

export interface GeminiProviderOptions {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

interface GeminiChunk {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
}

export const DEFAULT_GEMINI_CHAT_MODEL = "gemini-3.5-flash-lite";

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
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

    const body = {
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents,
      generationConfig: {
        temperature: opts.temperature ?? 0.2,
        maxOutputTokens: opts.maxOutputTokens ?? 1024,
      },
    };

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
        if (part.text && !part.thought) yield { type: "text", text: part.text };
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
