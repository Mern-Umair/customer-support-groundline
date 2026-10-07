import { createHash } from "node:crypto";

/**
 * Embedding provider interface. The pipeline and retrieval only depend on this,
 * so tests use FakeEmbedder (deterministic, offline) and production uses Gemini.
 */
export interface Embedder {
  readonly id: string;
  readonly dimensions: number;
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

export const EMBEDDING_DIMENSIONS = 768;

/**
 * Deterministic bag-of-words hashing embedder for tests and local dev without an API key.
 * Similar texts share tokens and therefore land near each other; good enough to test
 * indexing, filtering and tenant isolation. Not for real answers.
 */
export class FakeEmbedder implements Embedder {
  readonly id = "fake-hash-v1";
  readonly dimensions = EMBEDDING_DIMENSIONS;

  private vector(text: string): number[] {
    const v = new Array<number>(this.dimensions).fill(0);
    const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    for (const t of tokens) {
      const h = createHash("sha1").update(t).digest();
      const idx = h.readUInt32BE(0) % this.dimensions;
      const sign = h[4] & 1 ? 1 : -1;
      v[idx] += sign;
    }
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / norm);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.vector(t));
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.vector(text);
  }
}

export interface GeminiEmbedderOptions {
  apiKey: string;
  /** gemini-embedding-001 is GA and supports taskType; dimensions reduced via outputDimensionality. */
  model?: string;
  dimensions?: number;
  /** Max texts per embedContent request. */
  batchSize?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Gemini embeddings via the REST API (batchEmbedContents). We call REST directly instead of
 * the SDK so the request shape is explicit, retries are ours, and the module stays small.
 */
export class GeminiEmbedder implements Embedder {
  readonly id: string;
  readonly dimensions: number;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly batchSize: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: GeminiEmbedderOptions) {
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? "gemini-embedding-001";
    this.dimensions = opts.dimensions ?? EMBEDDING_DIMENSIONS;
    this.batchSize = opts.batchSize ?? 32;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.id = `${this.model}@${this.dimensions}`;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      out.push(...(await this.request(batch, "RETRIEVAL_DOCUMENT")));
    }
    return out;
  }

  async embedQuery(text: string): Promise<number[]> {
    const [v] = await this.request([text], "RETRIEVAL_QUERY");
    return v;
  }

  private async request(texts: string[], taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<number[][]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:batchEmbedContents`;
    const body = {
      requests: texts.map((text) => ({
        model: `models/${this.model}`,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: this.dimensions,
      })),
    };

    let attempt = 0;
    for (;;) {
      const res = await this.fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const json = (await res.json()) as { embeddings?: { values: number[] }[] };
        const vectors = json.embeddings?.map((e) => normalize(e.values)) ?? [];
        if (vectors.length !== texts.length) throw new Error(`Gemini returned ${vectors.length} embeddings for ${texts.length} inputs`);
        return vectors;
      }
      // 429 (rate limit) and 5xx are retried with backoff; anything else is fatal.
      if ((res.status === 429 || res.status >= 500) && attempt < 4) {
        attempt += 1;
        const retryAfter = Number(res.headers.get("retry-after"));
        const waitMs = retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt;
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      const detail = await res.text().catch(() => "");
      throw new Error(`Gemini embeddings failed (${res.status}): ${detail.slice(0, 300)}`);
    }
  }
}

/** gemini-embedding-001 needs normalisation when dimensions are reduced below 3072. */
export function normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
