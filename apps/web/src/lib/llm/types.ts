import type { ToolCall, ToolDefinition } from "../tools/types";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Assistant turns that requested tools. */
  toolCalls?: ToolCall[];
  /** Tool turns: which call this result answers. */
  toolCallId?: string;
  name?: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "tool_call"; call: ToolCall }
  | { type: "done"; usage: Usage | null; finishReason: string | null };

export interface StreamOptions {
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
  /** When present, the model may answer with tool calls instead of text. */
  tools?: ToolDefinition[];
}

/**
 * Minimal chat-completion provider. Everything above this layer (prompting, citations,
 * logging, the agent loop) is provider-agnostic, so Gemini, Groq and the offline
 * FakeProvider are interchangeable and the choice is a deployment setting.
 */
export interface LLMProvider {
  /** e.g. "gemini" | "groq" | "fake" */
  readonly provider: string;
  /** Model id as the provider names it. */
  readonly model: string;
  stream(messages: ChatMessage[], opts?: StreamOptions): AsyncIterable<StreamEvent>;
}

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "LLMError";
  }
}
