import { parseSse } from "./sse";
import { LLMError, type ChatMessage, type LLMProvider, type StreamEvent, type StreamOptions, type Usage } from "./types";

export interface GroqProviderOptions {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

interface OpenAIToolCallDelta {
  index?: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}
interface OpenAIChunk {
  choices?: { delta?: { content?: string; tool_calls?: OpenAIToolCallDelta[] }; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
  x_groq?: { usage?: { prompt_tokens?: number; completion_tokens?: number } };
  error?: { message?: string };
}

export const DEFAULT_GROQ_CHAT_MODEL = "llama-3.3-70b-versatile";

/** Maps our messages to the OpenAI chat format, including tool calls and tool results. */
export function toOpenAIMessages(messages: ChatMessage[]): Record<string, unknown>[] {
  return messages.map((m) => {
    if (m.role === "assistant" && m.toolCalls?.length) {
      return { role: "assistant", content: m.content || null, tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.args) } })) };
    }
    if (m.role === "tool") return { role: "tool", tool_call_id: m.toolCallId, name: m.name, content: m.content };
    return { role: m.role, content: m.content };
  });
}

/** Groq's OpenAI-compatible chat completions with SSE streaming and tool calls. */
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
    const body: Record<string, unknown> = {
      model: this.model,
      messages: toOpenAIMessages(messages),
      stream: true,
      stream_options: { include_usage: true },
      temperature: opts.temperature ?? 0.2,
      max_completion_tokens: opts.maxOutputTokens ?? 1024,
    };
    if (opts.tools?.length) {
      body.tools = opts.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
      body.tool_choice = "auto";
    }
    const res = await this.fetchImpl("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      throw new LLMError(`Groq request failed (${res.status}): ${detail.slice(0, 300)}`, res.status, res.status === 429 || res.status >= 500);
    }

    let usage: Usage | null = null;
    let finishReason: string | null = null;
    // Tool call arguments stream in fragments keyed by index; assemble, then emit at the end.
    const calls = new Map<number, { id: string; name: string; args: string }>();
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
      for (const d of choice?.delta?.tool_calls ?? []) {
        const idx = d.index ?? 0;
        const cur = calls.get(idx) ?? { id: d.id ?? `call_${idx + 1}`, name: "", args: "" };
        if (d.id) cur.id = d.id;
        if (d.function?.name) cur.name += d.function.name;
        if (d.function?.arguments) cur.args += d.function.arguments;
        calls.set(idx, cur);
      }
      if (choice?.finish_reason) finishReason = choice.finish_reason;
      const u = chunk.usage ?? chunk.x_groq?.usage;
      if (u) usage = { inputTokens: u.prompt_tokens ?? 0, outputTokens: u.completion_tokens ?? 0 };
    }
    for (const c of [...calls.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v)) {
      if (!c.name) continue;
      let args: Record<string, unknown> = {};
      try {
        args = c.args ? (JSON.parse(c.args) as Record<string, unknown>) : {};
      } catch {
        args = { _raw: c.args };
      }
      yield { type: "tool_call", call: { id: c.id, name: c.name, args } };
    }
    yield { type: "done", usage, finishReason };
  }
}
