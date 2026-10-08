import "server-only";
import { env } from "../env";
import { FakeProvider } from "./fake";
import { GeminiProvider } from "./gemini";
import { GroqProvider } from "./groq";
import type { LLMProvider } from "./types";

let cached: LLMProvider | undefined;

/**
 * Gemini when a key exists, else Groq, else the offline FakeProvider.
 * Models can be pinned with GEMINI_CHAT_MODEL / GROQ_CHAT_MODEL.
 */
export function getChatProvider(): LLMProvider {
  if (cached) return cached;
  const e = env();
  if (e.GEMINI_API_KEY) cached = new GeminiProvider({ apiKey: e.GEMINI_API_KEY, model: process.env.GEMINI_CHAT_MODEL || undefined });
  else if (e.GROQ_API_KEY) cached = new GroqProvider({ apiKey: e.GROQ_API_KEY, model: process.env.GROQ_CHAT_MODEL || undefined });
  else cached = new FakeProvider();
  return cached;
}
