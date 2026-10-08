import { ObjectId, type Db } from "mongodb";
import { evalCases, evalRuns } from "../db/collections";
import type { EvalCaseDoc, EvalResultDoc, EvalRunDoc } from "../db/types";
import type { Embedder } from "../ingest/embeddings";
import type { LLMProvider } from "../llm/types";
import { scoped } from "../tenant";
import { generateGrounded } from "../chat/generate";
import { RUBRIC_VERSION, type Judge } from "./judge";
import { citedExpectedSource, computeMetrics, emptyMetrics } from "./scoring";

export interface EvalContext {
  db: Db;
  workspaceId: ObjectId;
  workspaceName: string;
  userId: ObjectId;
  embedder: Embedder;
  llm: LLMProvider;
  judge: Judge;
}

export class EvalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvalError";
  }
}

export async function createRun(ctx: EvalContext): Promise<EvalRunDoc> {
  const cases = await evalCases(ctx.db).find(scoped(ctx.workspaceId), { projection: { _id: 1 }, sort: { createdAt: 1 } }).toArray();
  if (cases.length === 0) throw new EvalError("Add at least one test case before running evals.");
  const running = await evalRuns(ctx.db).findOne(scoped(ctx.workspaceId, { status: "running" }));
  if (running) return running;
  const run: EvalRunDoc = {
    _id: new ObjectId(),
    workspaceId: ctx.workspaceId,
    status: "running",
    config: { chatProvider: ctx.llm.provider, chatModel: ctx.llm.model, embedder: ctx.embedder.id, judgeProvider: ctx.judge.provider, judgeModel: ctx.judge.model, rubricVersion: RUBRIC_VERSION },
    pending: cases.map((c) => c._id),
    results: [],
    metrics: emptyMetrics(),
    createdBy: ctx.userId,
    startedAt: new Date(),
  };
  await evalRuns(ctx.db).insertOne(run);
  return run;
}

/** Runs one case: generate (no side effects), deterministic checks, then the judge if needed. */
export async function evaluateCase(ctx: EvalContext, c: EvalCaseDoc): Promise<EvalResultDoc> {
  const base = { caseId: c._id, kind: c.kind, question: c.question, expectedAnswer: c.expectedAnswer, expectedSource: c.expectedSource };
  try {
    const out = await generateGrounded(ctx, { question: c.question });
    const cited = out.cited.map((n) => out.used[n - 1]).filter(Boolean);
    const citedTitles = cited.map((x) => x.title);
    const citedExpected = c.kind === "answerable" ? citedExpectedSource(c.expectedSource, cited) : null;

    let verdict: EvalResultDoc["verdict"] = null;
    let judgeReason: string | null = null;
    if (c.kind === "answerable") {
      if (out.refused) {
        verdict = "incorrect";
        judgeReason = "Refused an answerable question";
      } else if (c.expectedAnswer) {
        const j = await ctx.judge.judge({ question: c.question, expectedAnswer: c.expectedAnswer, answer: out.text });
        verdict = j.verdict;
        judgeReason = j.reason;
      } else {
        judgeReason = "No reference answer; only citation and refusal were checked";
      }
    }

    return { ...base, answer: out.text, refused: out.refused, citedTitles, citedExpected, verdict, judgeReason, latencyMs: out.usage.latencyMs, costUsd: out.usage.costUsd, topScore: out.retrieved[0]?.score ?? null, ...(out.error ? { error: out.error } : {}) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ...base, answer: "", refused: false, citedTitles: [], citedExpected: null, verdict: c.kind === "answerable" ? "incorrect" : null, judgeReason: null, latencyMs: 0, costUsd: null, topScore: null, error: message.slice(0, 500) };
  }
}

export interface ProcessRunResult {
  status: EvalRunDoc["status"];
  done: number;
  total: number;
}

/**
 * Advances a run by as many cases as fit in the time budget; call again until "done".
 * Same resumable shape as ingestion so it works inside short serverless invocations.
 */
export async function processRun(ctx: EvalContext, runId: ObjectId, budgetMs = 25_000, now: () => number = Date.now): Promise<ProcessRunResult> {
  const filter = scoped(ctx.workspaceId, { _id: runId });
  const run = await evalRuns(ctx.db).findOne(filter);
  if (!run) throw new EvalError("Run not found");
  const total = run.pending.length + run.results.length;
  if (run.status !== "running") return { status: run.status, done: run.results.length, total };

  const deadline = now() + budgetMs;
  let pending = [...run.pending];
  let results = [...run.results];
  while (pending.length && now() < deadline) {
    const caseId = pending[0];
    const c = await evalCases(ctx.db).findOne(scoped(ctx.workspaceId, { _id: caseId }));
    pending = pending.slice(1);
    if (!c) continue; // deleted mid-run
    const r = await evaluateCase(ctx, c);
    results = [...results, r];
    await evalRuns(ctx.db).updateOne(filter, { $set: { pending, results, metrics: computeMetrics(results) } });
  }

  if (pending.length === 0) {
    await evalRuns(ctx.db).updateOne(filter, { $set: { status: "done", finishedAt: new Date(), metrics: computeMetrics(results) } });
    return { status: "done", done: results.length, total };
  }
  return { status: "running", done: results.length, total };
}

export async function cancelRun(ctx: EvalContext, runId: ObjectId): Promise<boolean> {
  const res = await evalRuns(ctx.db).updateOne(scoped(ctx.workspaceId, { _id: runId, status: "running" }), { $set: { status: "failed", error: "Cancelled", finishedAt: new Date() } });
  return res.matchedCount === 1;
}
