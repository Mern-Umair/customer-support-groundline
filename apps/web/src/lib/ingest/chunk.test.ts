import { describe, expect, it } from "vitest";
import { approxTokens, chunkText, normalizeWhitespace } from "./chunk";

const para = (n: number, words = 120) =>
  Array.from({ length: words }, (_, i) => `para${n}word${i}`).join(" ") + ".";

describe("normalizeWhitespace", () => {
  it("collapses runs of spaces and blank lines", () => {
    expect(normalizeWhitespace("a   b\r\n\r\n\r\n\r\nc \n d")).toBe("a b\n\nc\nd");
  });
});

describe("chunkText", () => {
  it("returns nothing for empty input", () => {
    expect(chunkText("   \n ")).toEqual([]);
  });

  it("keeps short text as a single chunk without overlap prefix", () => {
    const chunks = chunkText("Returns are accepted within 14 days.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe("Returns are accepted within 14 days.");
    expect(chunks[0].index).toBe(0);
  });

  it("splits long text into chunks within the target size band", () => {
    const text = Array.from({ length: 12 }, (_, i) => para(i)).join("\n\n");
    const chunks = chunkText(text, { targetTokens: 256, overlapTokens: 32 });
    expect(chunks.length).toBeGreaterThan(3);
    for (const c of chunks) {
      // Target 256 tokens plus up to 32 tokens of overlap, with a little slack for merges.
      expect(c.approxTokens).toBeLessThanOrEqual(256 * 1.2 + 32);
    }
  });

  it("prefers paragraph boundaries over mid-sentence cuts", () => {
    const text = `${para(1, 60)}\n\n${para(2, 60)}\n\n${para(3, 60)}`;
    const chunks = chunkText(text, { targetTokens: 150, overlapTokens: 0 });
    expect(chunks.length).toBe(3);
    expect(chunks[1].text.startsWith("para2word0")).toBe(true);
  });

  it("overlaps consecutive chunks", () => {
    const text = `${para(1, 60)}\n\n${para(2, 60)}`;
    const chunks = chunkText(text, { targetTokens: 150, overlapTokens: 20 });
    expect(chunks).toHaveLength(2);
    const tailOfFirst = chunks[0].text.slice(-30);
    const lastWordOfFirst = tailOfFirst.trim().split(" ").pop();
    expect(chunks[1].text).toContain(lastWordOfFirst);
    expect(chunks[1].text).toContain("para2word0");
  });

  it("merges tiny trailing fragments instead of emitting them alone", () => {
    const text = `${para(1, 100)}\n\nOk.`;
    const chunks = chunkText(text, { targetTokens: 200, overlapTokens: 0 });
    expect(chunks[chunks.length - 1].text.endsWith("Ok.")).toBe(true);
    expect(chunks.every((c) => c.approxTokens >= 10)).toBe(true);
  });

  it("hard-splits a single giant token", () => {
    const text = "x".repeat(5000);
    const chunks = chunkText(text, { targetTokens: 100, overlapTokens: 0 });
    expect(chunks.length).toBeGreaterThanOrEqual(12);
    expect(approxTokens(chunks[0].text)).toBeLessThanOrEqual(100);
  });
});
