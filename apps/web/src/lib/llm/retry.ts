import { LLMError } from "./types";

/**
 * Free tiers rate-limit hard (Gemini: roughly 10 requests/minute on Flash models).
 * Retries 429 and 5xx with exponential backoff, honouring Retry-After when present.
 */
export async function fetchWithRetry(fetchImpl: typeof fetch, url: string, init: RequestInit, label: string, maxAttempts = 5): Promise<Response> {
  let attempt = 0;
  for (;;) {
    const res = await fetchImpl(url, init);
    if (res.ok) return res;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= maxAttempts - 1) {
      const detail = await res.text().catch(() => "");
      throw new LLMError(`${label} request failed (${res.status}): ${detail.slice(0, 300)}`, res.status, retryable);
    }
    attempt += 1;
    const header = res.headers.get("retry-after");
    const retryAfter = header === null ? NaN : Number(header);
    const waitMs = Number.isFinite(retryAfter) && retryAfter >= 0 ? Math.min(retryAfter * 1000, 60_000) : Math.min(1500 * 2 ** attempt, 30_000);
    await res.text().catch(() => "");
    await new Promise((r) => setTimeout(r, waitMs));
  }
}
