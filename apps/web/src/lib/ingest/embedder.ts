import "server-only";
import { env } from "../env";
import { FakeEmbedder, GeminiEmbedder, type Embedder } from "./embeddings";

let cached: Embedder | undefined;

/**
 * Production embedder. Falls back to the deterministic FakeEmbedder when no Gemini key is
 * configured so local development works offline; the dashboard shows which one is active.
 */
export function getEmbedder(): Embedder {
  if (cached) return cached;
  const key = env().GEMINI_API_KEY;
  cached = key ? new GeminiEmbedder({ apiKey: key }) : new FakeEmbedder();
  return cached;
}
