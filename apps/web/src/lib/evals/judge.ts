import type { EvalVerdict } from "../db/types";
import type { LLMProvider } from "../llm/types";

export const RUBRIC_VERSION = "correctness-v1";

export interface JudgeInput {
  question: string;
  expectedAnswer: string;
  answer: string;
}

export interface JudgeOutput {
  verdict: EvalVerdict;
  reason: string;
}

export interface Judge {
  readonly provider: string;
  readonly model: string;
  judge(input: JudgeInput): Promise<JudgeOutput>;
}

/**
 * Rubric (pinned as RUBRIC_VERSION). Design follows the LLM-as-judge guidance reviewed
 * on 9 Oct 2026: objective criteria scored directly (not pairwise), a low-precision
 * three-step scale, explicit definitions, reasoning before the verdict, and an instruction
 * to ignore length and style (verbosity bias). The output is a single JSON object on the
 * last line so parsing is deterministic.
 */
export function buildJudgePrompt(input: JudgeInput): string {
  return [
    "You are grading a customer-support assistant's answer against a reference answer.",
    "Judge factual agreement only. Ignore tone, length, formatting and citation markers like [1].",
    "",
    "Definitions:",
    '- "correct": every key fact in the reference is present in the answer and nothing contradicts the reference.',
    '- "partial": at least one key fact from the reference is missing, but nothing in the answer contradicts it.',
    '- "incorrect": the answer contradicts the reference, invents facts not in the reference, or answers a different question. A refusal to answer is "incorrect".',
    "",
    `QUESTION: ${input.question}`,
    `REFERENCE ANSWER: ${input.expectedAnswer}`,
    `ASSISTANT ANSWER: ${input.answer}`,
    "",
    "First write one or two sentences of reasoning. Then, on the final line, output only a JSON object of the form",
    '{"verdict": "correct" | "partial" | "incorrect", "reason": "<short reason>"}',
  ].join("\n");
}

export function parseJudgeOutput(raw: string): JudgeOutput | null {
  const matches = raw.match(/\{[\s\S]*?\}/g);
  if (!matches) return null;
  for (const candidate of matches.reverse()) {
    try {
      const obj = JSON.parse(candidate) as { verdict?: string; reason?: string };
      const v = obj.verdict?.toLowerCase();
      if (v === "correct" || v === "partial" || v === "incorrect") return { verdict: v, reason: String(obj.reason ?? "").slice(0, 500) };
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

/** Judge backed by any LLMProvider (ideally a different model family than the one under test). */
export class LLMJudge implements Judge {
  readonly provider: string;
  readonly model: string;
  constructor(private readonly llm: LLMProvider) {
    this.provider = llm.provider;
    this.model = llm.model;
  }

  async judge(input: JudgeInput): Promise<JudgeOutput> {
    let raw = "";
    for await (const ev of this.llm.stream([{ role: "user", content: buildJudgePrompt(input) }], { temperature: 0, maxOutputTokens: 400 })) {
      if (ev.type === "text") raw += ev.text;
    }
    const parsed = parseJudgeOutput(raw);
    // A parse failure is recorded as a verdict, never silently dropped from the aggregate.
    return parsed ?? { verdict: "incorrect", reason: `Judge output could not be parsed: ${raw.slice(0, 120)}` };
  }
}

const STOP = new Set(["the", "a", "an", "is", "are", "and", "or", "to", "of", "for", "in", "on", "with", "it", "you", "your", "we", "our", "be", "can", "within", "that", "this"]);
function keyTokens(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)));
}

/**
 * Offline judge for tests and keyless development: token overlap against the reference.
 * Deterministic and cheap, and clearly labelled in the UI as not a real judge.
 */
export class FakeJudge implements Judge {
  readonly provider = "fake";
  readonly model = "fake-overlap-judge";
  async judge(input: JudgeInput): Promise<JudgeOutput> {
    const expected = keyTokens(input.expectedAnswer);
    const got = keyTokens(input.answer);
    if (expected.size === 0) return { verdict: "incorrect", reason: "No reference tokens" };
    let hit = 0;
    for (const t of expected) if (got.has(t)) hit += 1;
    const ratio = hit / expected.size;
    const verdict: EvalVerdict = ratio >= 0.7 ? "correct" : ratio >= 0.35 ? "partial" : "incorrect";
    return { verdict, reason: `${hit}/${expected.size} reference terms present` };
  }
}
