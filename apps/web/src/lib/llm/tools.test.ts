import { describe, expect, it, vi } from "vitest";
import type { ToolDefinition } from "../tools/types";
import { FakeProvider } from "./fake";
import { GeminiProvider, toGeminiContents } from "./gemini";
import { GroqProvider, toOpenAIMessages } from "./groq";
import type { StreamEvent } from "./types";

const lookupOrder: ToolDefinition = {
  name: "lookupOrder",
  description: "Look up an order",
  parameters: { type: "object", properties: { orderNumber: { type: "string", description: "n" } }, required: ["orderNumber"] },
  sideEffect: false,
};

function sse(events: string[]): Response {
  return new Response(events.map((e) => `data: ${e}\n\n`).join(""), { status: 200 });
}
async function drain(iter: AsyncIterable<StreamEvent>) {
  const out: StreamEvent[] = [];
  for await (const e of iter) out.push(e);
  return out;
}

describe("Gemini tool calling", () => {
  it("sends functionDeclarations and emits tool_call events from functionCall parts", async () => {
    let body: Record<string, unknown> = {};
    const fetchImpl = vi.fn(async (_u: string | URL | Request, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return sse([JSON.stringify({ candidates: [{ content: { parts: [{ functionCall: { name: "lookupOrder", args: { orderNumber: "48213" } } }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } })]);
    }) as unknown as typeof fetch;
    const events = await drain(new GeminiProvider({ apiKey: "k", fetchImpl }).stream([{ role: "user", content: "where is order 48213" }], { tools: [lookupOrder] }));
    expect((body.tools as { functionDeclarations: { name: string }[] }[])[0].functionDeclarations[0].name).toBe("lookupOrder");
    expect(body.toolConfig).toEqual({ functionCallingConfig: { mode: "AUTO" } });
    expect(events[0]).toEqual({ type: "tool_call", call: { id: "call_1", name: "lookupOrder", args: { orderNumber: "48213" } } });
  });

  it("maps assistant tool calls and tool results to model/user parts and merges consecutive roles", () => {
    const contents = toGeminiContents([
      { role: "system", content: "sys" },
      { role: "user", content: "q" },
      { role: "assistant", content: "", toolCalls: [{ id: "c1", name: "lookupOrder", args: { orderNumber: "1" } }] },
      { role: "tool", toolCallId: "c1", name: "lookupOrder", content: JSON.stringify({ ok: true, status: "shipped" }) },
      { role: "tool", toolCallId: "c2", name: "other", content: "plain" },
    ]);
    expect(contents).toHaveLength(3);
    expect(contents[1]).toEqual({ role: "model", parts: [{ functionCall: { id: "c1", name: "lookupOrder", args: { orderNumber: "1" } } }] });
    expect(contents[2].role).toBe("user");
    expect(contents[2].parts).toEqual([
      { functionResponse: { id: "c1", name: "lookupOrder", response: { ok: true, status: "shipped" } } },
      { functionResponse: { id: "c2", name: "other", response: { result: "plain" } } },
    ]);
  });
});

describe("Groq tool calling", () => {
  it("assembles streamed tool_call fragments and emits them before done", async () => {
    const fetchImpl = vi.fn(async () =>
      sse([
        JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: "call_abc", function: { name: "lookupOrder", arguments: '{"order' } }] }, finish_reason: null }] }),
        JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'Number":"48213"}' } }] }, finish_reason: "tool_calls" }] }),
        JSON.stringify({ choices: [], usage: { prompt_tokens: 9, completion_tokens: 4 } }),
        "[DONE]",
      ]),
    ) as unknown as typeof fetch;
    const events = await drain(new GroqProvider({ apiKey: "k", fetchImpl }).stream([{ role: "user", content: "q" }], { tools: [lookupOrder] }));
    expect(events[0]).toEqual({ type: "tool_call", call: { id: "call_abc", name: "lookupOrder", args: { orderNumber: "48213" } } });
    expect(events[1]).toEqual({ type: "done", usage: { inputTokens: 9, outputTokens: 4 }, finishReason: "tool_calls" });
  });

  it("maps tool calls and results to the OpenAI message format", () => {
    const msgs = toOpenAIMessages([
      { role: "assistant", content: "", toolCalls: [{ id: "c1", name: "lookupOrder", args: { orderNumber: "1" } }] },
      { role: "tool", toolCallId: "c1", name: "lookupOrder", content: "{}" },
    ]);
    expect(msgs[0]).toEqual({ role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "lookupOrder", arguments: '{"orderNumber":"1"}' } }] });
    expect(msgs[1]).toEqual({ role: "tool", tool_call_id: "c1", name: "lookupOrder", content: "{}" });
  });
});

describe("FakeProvider tools", () => {
  const tools: ToolDefinition[] = [lookupOrder, { ...lookupOrder, name: "createTicket", sideEffect: true }, { ...lookupOrder, name: "bookAppointment", sideEffect: true }];

  it("turns an order question into a lookupOrder call", async () => {
    const events = await drain(new FakeProvider().stream([{ role: "user", content: "Where is my order #48213? ana@example.com" }], { tools }));
    expect(events[0]).toEqual({ type: "tool_call", call: { id: "call_1", name: "lookupOrder", args: { orderNumber: "48213", email: "ana@example.com" } } });
  });

  it("answers from a tool result and explains pending approvals", async () => {
    const final = await drain(new FakeProvider().stream([{ role: "user", content: "x" }, { role: "assistant", content: "", toolCalls: [{ id: "c", name: "lookupOrder", args: {} }] }, { role: "tool", toolCallId: "c", name: "lookupOrder", content: JSON.stringify({ ok: true, summary: "Order 48213: shipped" }) }], { tools }));
    expect(final.filter((e) => e.type === "text").map((e) => (e as { text: string }).text).join("")).toBe("Order 48213: shipped.");

    const pending = await drain(new FakeProvider().stream([{ role: "user", content: "x" }, { role: "tool", toolCallId: "c", name: "createTicket", content: JSON.stringify({ status: "pending_approval", summary: "create ticket" }) }], { tools }));
    expect(pending.filter((e) => e.type === "text").map((e) => (e as { text: string }).text).join("")).toMatch(/asked the team to approve/);
  });

  it("ignores tools for ordinary questions", async () => {
    const events = await drain(new FakeProvider().stream([{ role: "system", content: "<sources>\n[1] Returns\nReturns within 14 days.\n</sources>" }, { role: "user", content: "How long for returns?" }], { tools }));
    expect(events.some((e) => e.type === "tool_call")).toBe(false);
  });
});
