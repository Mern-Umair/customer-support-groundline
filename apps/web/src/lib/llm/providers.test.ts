import { describe, expect, it, vi } from "vitest";
import { FakeProvider } from "./fake";
import { GeminiProvider } from "./gemini";
import { GroqProvider } from "./groq";
import { estimateCostUsd } from "./pricing";
import type { StreamEvent } from "./types";

function sseResponse(events: string[], status = 200): Response {
  const body = events.map((e) => `data: ${e}\n\n`).join("");
  return new Response(body, { status, headers: { "content-type": "text/event-stream" } });
}

async function drain(iter: AsyncIterable<StreamEvent>) {
  const events: StreamEvent[] = [];
  for await (const e of iter) events.push(e);
  const text = events.filter((e) => e.type === "text").map((e) => (e as { text: string }).text).join("");
  const done = events.find((e) => e.type === "done") as Extract<StreamEvent, { type: "done" }> | undefined;
  return { text, done };
}

describe("GeminiProvider", () => {
  it("sends systemInstruction + contents and parses streamed text and usage", async () => {
    let sent: { url: string; body: Record<string, unknown> } | undefined;
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      sent = { url: String(url), body: JSON.parse(String(init?.body)) };
      return sseResponse([
        JSON.stringify({ candidates: [{ content: { parts: [{ text: "Sale items " }] } }], usageMetadata: { promptTokenCount: 50 } }),
        JSON.stringify({ candidates: [{ content: { parts: [{ text: "can be returned [1]" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 7 } }),
      ]);
    }) as unknown as typeof fetch;

    const p = new GeminiProvider({ apiKey: "k", fetchImpl });
    const { text, done } = await drain(p.stream([{ role: "system", content: "rules" }, { role: "user", content: "q" }]));
    expect(text).toBe("Sale items can be returned [1]");
    expect(done?.usage).toEqual({ inputTokens: 50, outputTokens: 7 });
    expect(done?.finishReason).toBe("STOP");
    expect(sent?.url).toContain("gemini-3.5-flash-lite:streamGenerateContent?alt=sse");
    expect(sent?.body.systemInstruction).toEqual({ parts: [{ text: "rules" }] });
    expect(sent?.body.contents).toEqual([{ role: "user", parts: [{ text: "q" }] }]);
  });

  it("throws a retryable LLMError on 429", async () => {
    const fetchImpl = vi.fn(async () => new Response("quota", { status: 429 })) as unknown as typeof fetch;
    const p = new GeminiProvider({ apiKey: "k", fetchImpl });
    await expect(drain(p.stream([{ role: "user", content: "q" }]))).rejects.toMatchObject({ name: "LLMError", status: 429, retryable: true });
  });
});

describe("GroqProvider", () => {
  it("parses OpenAI-style deltas, usage and [DONE]", async () => {
    const fetchImpl = vi.fn(async () =>
      sseResponse([
        JSON.stringify({ choices: [{ delta: { content: "Hello" }, finish_reason: null }] }),
        JSON.stringify({ choices: [{ delta: { content: " world" }, finish_reason: "stop" }] }),
        JSON.stringify({ choices: [], usage: { prompt_tokens: 12, completion_tokens: 2 } }),
        "[DONE]",
      ]),
    ) as unknown as typeof fetch;
    const p = new GroqProvider({ apiKey: "k", fetchImpl });
    const { text, done } = await drain(p.stream([{ role: "user", content: "hi" }]));
    expect(text).toBe("Hello world");
    expect(done?.usage).toEqual({ inputTokens: 12, outputTokens: 2 });
    expect(done?.finishReason).toBe("stop");
  });
});

describe("FakeProvider", () => {
  const sources = `<sources>\n[1] Shipping\nStandard shipping is free over 60 euros. Express costs 9 euros.\n[2] Returns\nSale items can be returned within 14 days for store credit. Keep the box.\n</sources>`;

  it("answers from the best matching source with a citation", async () => {
    const { text, done } = await drain(new FakeProvider().stream([{ role: "system", content: sources }, { role: "user", content: "Can I return sale items?" }]));
    expect(text).toContain("Sale items can be returned within 14 days");
    expect(text.endsWith("[2]")).toBe(true);
    expect(done?.usage?.outputTokens).toBeGreaterThan(0);
  });

  it("refuses when there are no sources", async () => {
    const { text } = await drain(new FakeProvider().stream([{ role: "user", content: "Where is my order?" }]));
    expect(text).toMatch(/don't have that information/);
  });
});

describe("estimateCostUsd", () => {
  it("prices known models and returns null for unknown ones", () => {
    expect(estimateCostUsd("gemini-3.5-flash-lite", { inputTokens: 1_000_000, outputTokens: 0 })).toBeCloseTo(0.3);
    expect(estimateCostUsd("llama-3.1-8b-instant", { inputTokens: 1000, outputTokens: 1000 })).toBeCloseTo(0.00013);
    expect(estimateCostUsd("mystery-model", { inputTokens: 1, outputTokens: 1 })).toBeNull();
    expect(estimateCostUsd("gemini-3.5-flash-lite", null)).toBeNull();
  });
});
