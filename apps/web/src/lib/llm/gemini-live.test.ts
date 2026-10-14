/**
 * Opt-in live check against the real Gemini API (GEMINI_LIVE=1 and GEMINI_API_KEY):
 * a tool call round-trip must end in a text answer that uses the tool result.
 */
import { describe, expect, it } from "vitest";
import type { ToolDefinition } from "../tools/types";
import { GeminiProvider } from "./gemini";
import type { ChatMessage } from "./types";
import type { ToolCall } from "../tools/types";

const live = process.env.GEMINI_LIVE === "1" && Boolean(process.env.GEMINI_API_KEY);

const lookupOrder: ToolDefinition = {
  name: "lookupOrder",
  description: "Look up the status of an order by its order number.",
  parameters: { type: "object", properties: { orderNumber: { type: "string", description: "digits only" } }, required: ["orderNumber"] },
  sideEffect: false,
};

describe.skipIf(!live)("Gemini live tool round-trip", () => {
  it("calls the tool, accepts the result, and answers from it", async () => {
    const p = new GeminiProvider({ apiKey: process.env.GEMINI_API_KEY! });
    const messages: ChatMessage[] = [
      { role: "system", content: "You are a support assistant. Use the lookupOrder tool for order status questions. After a tool result, answer from it in one sentence." },
      { role: "user", content: "Where is my order #48213?" },
    ];
    const calls: ToolCall[] = [];
    let text = "";
    for await (const ev of p.stream(messages, { tools: [lookupOrder] })) {
      if (ev.type === "tool_call") calls.push(ev.call);
      if (ev.type === "text") text += ev.text;
    }
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("lookupOrder");
    messages.push({ role: "assistant", content: text, toolCalls: calls });
    messages.push({ role: "tool", toolCallId: calls[0].id, name: "lookupOrder", content: JSON.stringify({ ok: true, summary: "Order 48213: shipped", data: { status: "shipped", orderNumber: "48213" } }) });
    let final = "";
    for await (const ev of p.stream(messages, { tools: [lookupOrder] })) if (ev.type === "text") final += ev.text;
    expect(final.toLowerCase()).toContain("shipped");
  }, 60_000);
});
