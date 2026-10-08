import type { Usage } from "./types";

/**
 * USD per 1M tokens, standard (non-batch) tier, from the providers' public price lists
 * on 8 Oct 2026. Used only to show an honest cost estimate per conversation; the free
 * tiers we run on charge nothing, and the UI says so.
 *
 * Gemini: https://ai.google.dev/gemini-api/docs/pricing
 * Groq: https://groq.com/pricing (via third-party price tables, verify before billing)
 */
const PRICES: Record<string, { input: number; output: number }> = {
  "gemini-3.8-flash": { input: 0.75, output: 3.75 },
  "gemini-3.5-flash": { input: 1.5, output: 9.0 },
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.5 },
  "gemini-3-flash-preview": { input: 0.5, output: 3.0 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "gemini-embedding-001": { input: 0.15, output: 0 },
  "gemini-embedding-2": { input: 0.2, output: 0 },
  "llama-3.3-70b-versatile": { input: 0.59, output: 0.79 },
  "llama-3.1-8b-instant": { input: 0.05, output: 0.08 },
};

/** Returns null when the model is not in the table so the UI never shows a made-up number. */
export function estimateCostUsd(model: string, usage: Usage | null): number | null {
  if (!usage) return null;
  const p = PRICES[model];
  if (!p) return null;
  return (usage.inputTokens * p.input + usage.outputTokens * p.output) / 1_000_000;
}

export const knownModels = () => Object.keys(PRICES);
