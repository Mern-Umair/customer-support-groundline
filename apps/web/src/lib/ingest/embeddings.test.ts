import { describe, expect, it, vi } from "vitest";
import { cosineSimilarity, FakeEmbedder, GeminiEmbedder, normalize } from "./embeddings";

describe("FakeEmbedder", () => {
  const e = new FakeEmbedder();
  it("is deterministic and unit-length", async () => {
    const [a] = await e.embedDocuments(["return policy for shoes"]);
    const b = await e.embedQuery("return policy for shoes");
    expect(a).toEqual(b);
    expect(a).toHaveLength(768);
    expect(Math.sqrt(a.reduce((s, x) => s + x * x, 0))).toBeCloseTo(1, 5);
  });
  it("places related texts closer than unrelated ones", async () => {
    const q = await e.embedQuery("how do I return shoes");
    const [related, unrelated] = await e.embedDocuments(["You can return shoes within 14 days.", "Our office hours are 9 to 5 on weekdays."]);
    expect(cosineSimilarity(q, related)).toBeGreaterThan(cosineSimilarity(q, unrelated));
  });
});

describe("GeminiEmbedder", () => {
  it("batches requests, sets task types and normalises vectors", async () => {
    const calls: { url: string; body: unknown }[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      calls.push({ url: String(url), body });
      const n = body.requests.length;
      return new Response(JSON.stringify({ embeddings: Array.from({ length: n }, () => ({ values: [3, 4] })) }), { status: 200 });
    }) as unknown as typeof fetch;

    const e = new GeminiEmbedder({ apiKey: "k", dimensions: 2, batchSize: 2, fetchImpl });
    const vectors = await e.embedDocuments(["a", "b", "c"]);
    expect(vectors).toHaveLength(3);
    expect(vectors[0]).toEqual([0.6, 0.8]);
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain("gemini-embedding-001:batchEmbedContents");
    const first = calls[0].body as { requests: { taskType: string; outputDimensionality: number }[] };
    expect(first.requests[0].taskType).toBe("RETRIEVAL_DOCUMENT");
    expect(first.requests[0].outputDimensionality).toBe(2);

    await e.embedQuery("q");
    const last = calls[2].body as { requests: { taskType: string }[] };
    expect(last.requests[0].taskType).toBe("RETRIEVAL_QUERY");
  });

  it("retries on 429 then succeeds", async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => {
      n += 1;
      if (n === 1) return new Response("slow down", { status: 429, headers: { "retry-after": "0" } });
      return new Response(JSON.stringify({ embeddings: [{ values: [1, 0] }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const e = new GeminiEmbedder({ apiKey: "k", dimensions: 2, fetchImpl });
    expect(await e.embedQuery("x")).toEqual([1, 0]);
    expect(n).toBe(2);
  });

  it("throws a readable error on 400", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad key", { status: 400 })) as unknown as typeof fetch;
    const e = new GeminiEmbedder({ apiKey: "k", dimensions: 2, fetchImpl });
    await expect(e.embedQuery("x")).rejects.toThrow(/400.*bad key/);
  });
});

describe("normalize", () => {
  it("returns a unit vector and leaves zero vectors alone", () => {
    expect(normalize([3, 4])).toEqual([0.6, 0.8]);
    expect(normalize([0, 0])).toEqual([0, 0]);
  });
});
