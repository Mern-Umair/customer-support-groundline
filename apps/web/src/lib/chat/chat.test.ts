import { describe, expect, it } from "vitest";
import type { RetrievedChunk } from "../ingest/retrieval";
import { isRefusal, parseAnswer } from "./citations";
import { buildMessages, REFUSAL_SENTENCE } from "./prompt";

const chunk = (i: number, text: string, extra: Partial<RetrievedChunk> = {}): RetrievedChunk => ({
  chunkId: `c${i}`,
  sourceId: "s",
  pageId: `p${i}`,
  text,
  title: `Doc ${i}`,
  score: 0.9 - i * 0.1,
  ...extra,
});

describe("buildMessages", () => {
  it("numbers sources, includes page numbers, and puts the question last", () => {
    const { messages, used } = buildMessages({
      workspaceName: "Ali Shoes",
      question: "Can I return sale items?",
      chunks: [chunk(1, "Sale items can be returned within 14 days."), chunk(2, "Express costs 9 euros.", { pageNumber: 3 })],
    });
    expect(used).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("[1] Doc 1\nSale items can be returned within 14 days.");
    expect(messages[0].content).toContain("[2] Doc 2, page 3\nExpress costs 9 euros.");
    expect(messages[0].content).toContain(REFUSAL_SENTENCE);
    expect(messages.at(-1)).toEqual({ role: "user", content: "Can I return sale items?" });
  });

  it("keeps only the last six history turns and maps roles", () => {
    const history = Array.from({ length: 10 }, (_, i) => ({ role: (i % 2 ? "assistant" : "visitor") as "assistant" | "visitor", content: `t${i}` }));
    const { messages } = buildMessages({ workspaceName: "X", question: "q", chunks: [], history });
    const turns = messages.slice(1, -1);
    expect(turns).toHaveLength(6);
    expect(turns[0]).toEqual({ role: "user", content: "t4" });
    expect(turns[5]).toEqual({ role: "assistant", content: "t9" });
  });

  it("stops adding sources when the context budget is exceeded", () => {
    const big = "x".repeat(7000);
    const { used } = buildMessages({ workspaceName: "X", question: "q", chunks: [chunk(1, big), chunk(2, big), chunk(3, "small")] });
    expect(used.map((u) => u.chunkId)).toEqual(["c1"]);
  });

  it("says when no sources were found", () => {
    const { messages } = buildMessages({ workspaceName: "X", question: "q", chunks: [] });
    expect(messages[0].content).toContain("(no relevant sources were found)");
  });
});

describe("parseAnswer", () => {
  it("keeps valid citations and strips invalid ones", () => {
    const out = parseAnswer("Returns take 14 days [1]. Shipping is free [7]. Both apply [2, 9].", 2);
    expect(out.text).toBe("Returns take 14 days [1]. Shipping is free. Both apply [2].");
    expect(out.cited).toEqual([1, 2]);
    expect(out.refused).toBe(false);
  });

  it("detects the refusal sentence and drops citations", () => {
    const out = parseAnswer(`${REFUSAL_SENTENCE} [1]`, 3);
    expect(out.refused).toBe(true);
    expect(out.cited).toEqual([]);
  });

  it("treats an empty answer as a refusal", () => {
    expect(parseAnswer("   ", 3).refused).toBe(true);
  });
});

describe("isRefusal", () => {
  it("matches common phrasings", () => {
    expect(isRefusal("I don't have that information in the available documents.")).toBe(true);
    expect(isRefusal("I do not have this information, sorry.")).toBe(true);
    expect(isRefusal("Sale items can be returned within 14 days [1].")).toBe(false);
  });
});
