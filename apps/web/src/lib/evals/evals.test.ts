import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import type { EvalResultDoc } from "../db/types";
import { FakeJudge, LLMJudge, buildJudgePrompt, parseJudgeOutput } from "./judge";
import { FakeProvider } from "../llm/fake";
import { citedExpectedSource, computeMetrics } from "./scoring";

const result = (p: Partial<EvalResultDoc>): EvalResultDoc => ({
  caseId: new ObjectId(),
  kind: "answerable",
  question: "q",
  answer: "a",
  refused: false,
  citedTitles: [],
  citedExpected: null,
  verdict: null,
  judgeReason: null,
  latencyMs: 100,
  costUsd: 0.001,
  topScore: 0.8,
  ...p,
});

describe("parseJudgeOutput", () => {
  it("reads the last JSON object and normalises the verdict", () => {
    expect(parseJudgeOutput('Reasoning here {"note":"ignored"}\n{"verdict":"Correct","reason":"all facts present"}')).toEqual({ verdict: "correct", reason: "all facts present" });
  });
  it("returns null for garbage or unknown verdicts", () => {
    expect(parseJudgeOutput("no json")).toBeNull();
    expect(parseJudgeOutput('{"verdict":"maybe"}')).toBeNull();
  });
});

describe("LLMJudge", () => {
  it("records an unparseable judge reply as incorrect instead of dropping it", async () => {
    const llm = { provider: "x", model: "y", async *stream() { yield { type: "text" as const, text: "I cannot decide." }; yield { type: "done" as const, usage: null, finishReason: "stop" }; } };
    const out = await new LLMJudge(llm).judge({ question: "q", expectedAnswer: "e", answer: "a" });
    expect(out.verdict).toBe("incorrect");
    expect(out.reason).toMatch(/could not be parsed/);
  });
  it("builds a rubric prompt with definitions and the three inputs", () => {
    const p = buildJudgePrompt({ question: "Q1", expectedAnswer: "R1", answer: "A1" });
    expect(p).toContain('"correct"');
    expect(p).toContain("QUESTION: Q1");
    expect(p).toContain("REFERENCE ANSWER: R1");
    expect(p).toContain("ASSISTANT ANSWER: A1");
  });
  it("works end to end with the offline provider", async () => {
    const out = await new LLMJudge(new FakeProvider()).judge({ question: "q", expectedAnswer: "e", answer: "a" });
    expect(["correct", "partial", "incorrect"]).toContain(out.verdict);
  });
});

describe("FakeJudge", () => {
  it("grades by reference-term overlap", async () => {
    const j = new FakeJudge();
    expect((await j.judge({ question: "", expectedAnswer: "Returns within 14 days for store credit", answer: "Sale items can be returned within 14 days for store credit." })).verdict).toBe("correct");
    expect((await j.judge({ question: "", expectedAnswer: "Returns within 14 days for store credit", answer: "Returns are possible within 14 days." })).verdict).toBe("partial");
    expect((await j.judge({ question: "", expectedAnswer: "Returns within 14 days for store credit", answer: "Our shop opens at nine." })).verdict).toBe("incorrect");
  });
});

describe("citedExpectedSource", () => {
  it("matches title or url substrings, case-insensitively", () => {
    expect(citedExpectedSource("returns", [{ title: "Returns policy" }])).toBe(true);
    expect(citedExpectedSource("/help/shipping", [{ title: "x", url: "https://a.com/help/shipping" }])).toBe(true);
    expect(citedExpectedSource("warranty", [{ title: "Returns policy" }])).toBe(false);
    expect(citedExpectedSource(undefined, [{ title: "Returns policy" }])).toBeNull();
  });
});

describe("computeMetrics", () => {
  it("computes accuracy, citation hit rate and both refusal numbers", () => {
    const m = computeMetrics([
      result({ verdict: "correct", citedExpected: true }),
      result({ verdict: "partial", citedExpected: false }),
      result({ verdict: "incorrect", refused: true, citedExpected: null }),
      result({ verdict: "correct", citedExpected: null }),
      result({ kind: "unanswerable", refused: true, verdict: null }),
      result({ kind: "unanswerable", refused: false, verdict: null, answer: "made up" }),
    ]);
    expect(m.cases).toBe(6);
    expect(m.answerable).toBe(4);
    expect(m.unanswerable).toBe(2);
    expect(m.correct).toBe(2);
    expect(m.accuracy).toBeCloseTo(0.5);
    expect(m.accuracyLenient).toBeCloseTo(0.75);
    expect(m.citationHitRate).toBeCloseTo(0.5);
    expect(m.overRefusal).toBeCloseTo(0.25);
    expect(m.underRefusal).toBeCloseTo(0.5);
    expect(m.avgLatencyMs).toBe(100);
    expect(m.costUsd).toBeCloseTo(0.006);
  });
  it("returns nulls, not zeros, with no cases", () => {
    const m = computeMetrics([]);
    expect(m.accuracy).toBeNull();
    expect(m.citationHitRate).toBeNull();
    expect(m.avgLatencyMs).toBeNull();
    expect(m.costUsd).toBe(0);
  });
});
