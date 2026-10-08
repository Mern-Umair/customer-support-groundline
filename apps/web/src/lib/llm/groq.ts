import { parseSse } from "./sse";
import { LLMError, type ChatMessage, type LLMProvider, type StreamEvent, type StreamOptions, type Usage } from "./types";

export interface GroqProviderOptions {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

interface OpenAIChunk {
  choices?: { delta?: { content?: string }; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
  x_groq?: { usage?: { prompt_tokens?: number; completion_tokens?: number } };
  error?: { message?: string };
}

export const DEFAULT_GROQ_CHAT_MODEL = "llama-3.3-70b-versatile";

/** Groq's OpenAI-compatible chat completions with SSE streaming. */
export class GroqProvider implements LLMProvider {
  readonly provider = "groq";
  readonly model: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: GroqProviderOptions) {
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? DEFAULT_GROQ_CHAT_MODEL;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async *stream(messages: ChatMessage[], opts: StreamOptions = {}): AsyncIterable<StreamEvent> {
    const res = await this.fetchImpl("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
        stream_options: { include_usage: true },
        temperature: opts.temperature ?? 0.2,
        max_completion_tokens: opts.maxOutputTokens ?? 1024,
      }),
      signal: opts.signal,
    });
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      throw new LLMError(`Groq request failed (${res.status}): ${detail.slice(0, 300)}`, res.status, res.status === 429 || res.status >= 500);
    }

    let usage: Usage | null = null;
    let finishReason: string | null = null;
    for await (const data of parseSse(res.body)) {
      if (data === "[DONE]") break;
      let chunk: OpenAIChunk;
      try {
        chunk = JSON.parse(data) as OpenAIChunk;
      } catch {
        continue;
      }
      if (chunk.error) throw new LLMError(`Groq error: ${chunk.error.message}`);
      const choice = chunk.choices?.[0];
      if (choice?.delta?.content) yield { type: "text", text: choice.delta.content };
      if (choice?.finish_reason) finishReason = choice.finish_reason;
      const u = chunk.usage ?? chunk.x_groq?.usage;
      if (u) usage = { inputTokens: u.prompt_tokens ?? 0, outputTokens: u.completion_tokens ?? 0 };
    }
    yield { type: "done", usage, finishReason };
  }
}
