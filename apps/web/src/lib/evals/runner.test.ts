/**
 * Integration: the eval runner end to end on the test database with the offline stand-ins.
 * Also the CI gate: with EVALS_REAL=1 and a GEMINI_API_KEY it runs the demo set against the
 * real providers and fails if accuracy drops below evals/baseline.json minus the tolerance.
 */
import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.MONGODB_URI);
const real = process.env.EVALS_REAL === "1" && Boolean(process.env.GEMINI_API_KEY);

describe.skipIf(!hasDb)("eval runner (integration)", () => {
  const workspaceId = new ObjectId();
  const userId = new ObjectId();
  let db: import("mongodb").Db;
  let ctx: import("./runner").EvalContext;

  beforeAll(async () => {
    const { getDb } = await import("../db");
    const { FakeEmbedder, GeminiEmbedder } = await import("../ingest/embeddings");
    const { FakeProvider } = await import("../llm/fake");
    const { GeminiProvider } = await import("../llm/gemini");
    const { FakeJudge, LLMJudge } = await import("./judge");
    const { ensureVectorIndex, waitForVectorIndex } = await import("../db/indexes");
    const { loadDemoSet } = await import("./demo/load");
    const { searchChunks } = await import("../ingest/retrieval");

    db = await getDb();
    await ensureVectorIndex(db);
    await waitForVectorIndex(db, 150_000);

    const embedder = real ? new GeminiEmbedder({ apiKey: process.env.GEMINI_API_KEY! }) : new FakeEmbedder();
    const llm = real ? new GeminiProvider({ apiKey: process.env.GEMINI_API_KEY! }) : new FakeProvider();
    const judge = real ? new LLMJudge(new GeminiProvider({ apiKey: process.env.GEMINI_API_KEY! })) : new FakeJudge();

    const pc = { db, workspaceId, userId, plan: "free" as const, embedder };
    const loaded = await loadDemoSet(pc);
    expect(loaded.sourcesCreated).toBe(4);
    expect(loaded.casesCreated).toBe(40);

    // Wait until the index sees the demo chunks.
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      const hits = await searchChunks(db, workspaceId, embedder, "return full price shoes 30 days", { k: 3 });
      if (hits.length >= 3) break;
      await new Promise((r) => setTimeout(r, 3000));
    }
    ctx = { db, workspaceId, workspaceName: "Ali Shoes", userId, embedder, llm, judge };
  }, 400_000);

  afterAll(async () => {
    const { sources, pages, chunks, evalCases, evalRuns } = await import("../db/collections");
    await Promise.all([sources, pages, chunks, evalCases, evalRuns].map((col) => col(db).deleteMany({ workspaceId })));
  });

  it("loads the demo set idempotently", async () => {
    const { loadDemoSet } = await import("./demo/load");
    const again = await loadDemoSet({ db, workspaceId, userId, plan: "free", embedder: ctx.embedder });
    expect(again).toEqual({ sourcesCreated: 0, casesCreated: 0 });
  });

  it("runs all cases across several budgeted calls and computes metrics", async () => {
    const { createRun, processRun } = await import("./runner");
    const { evalRuns } = await import("../db/collections");
    const run = await createRun(ctx);
    expect(run.pending).toHaveLength(40);

    let calls = 0;
    let p = await processRun(ctx, run._id, real ? 40_000 : 2_000);
    calls += 1;
    while (p.status === "running") {
      p = await processRun(ctx, run._id, real ? 40_000 : 2_000);
      calls += 1;
    }
    expect(p.status).toBe("done");
    expect(p.done).toBe(40);
    if (!real) expect(calls).toBeGreaterThan(1); // the small budget forces resumption

    const stored = (await evalRuns(db).findOne({ _id: run._id }))!;
    expect(stored.results).toHaveLength(40);
    expect(stored.metrics.cases).toBe(40);
    expect(stored.metrics.answerable).toBe(30);
    expect(stored.metrics.unanswerable).toBe(10);
    expect(stored.config.rubricVersion).toBe("correctness-v1");

    // The offline stack cannot judge relevance (hashing embedder + extractive stand-in), so only
    // the shape is asserted there; real providers must actually refuse unanswerable questions.
    expect(stored.metrics.underRefusal).not.toBeNull();
    if (real) expect(stored.metrics.underRefusal!).toBeLessThanOrEqual(0.3);

    if (real) {
      const { readFileSync, writeFileSync, mkdirSync } = await import("node:fs");
      const baseline = JSON.parse(readFileSync(new URL("../../../../../evals/baseline.json", import.meta.url), "utf8")) as { accuracy: number; citationHitRate: number; correctRefusals: number; tolerance: number };
      const m = stored.metrics;
      const correctRefusals = m.underRefusal === null ? null : 1 - m.underRefusal;
      console.log(`[evals] accuracy ${m.accuracy} · citation ${m.citationHitRate} · correct refusals ${correctRefusals} · over-refusal ${m.overRefusal} · cost $${m.costUsd.toFixed(4)}`);
      if (process.env.EVALS_WRITE === "1") {
        const dir = new URL("../../../../../evals/results/", import.meta.url);
        mkdirSync(dir, { recursive: true });
        writeFileSync(new URL("latest.json", dir), JSON.stringify({ finishedAt: new Date().toISOString(), config: stored.config, metrics: m }, null, 2));
      }
      expect(m.accuracy!).toBeGreaterThanOrEqual(baseline.accuracy - baseline.tolerance);
      expect(m.citationHitRate!).toBeGreaterThanOrEqual(baseline.citationHitRate - baseline.tolerance);
      expect(correctRefusals!).toBeGreaterThanOrEqual(baseline.correctRefusals - baseline.tolerance);
    }
  }, 900_000);

  it("refuses to start a run for a workspace without cases", async () => {
    const { createRun } = await import("./runner");
    await expect(createRun({ ...ctx, workspaceId: new ObjectId() })).rejects.toThrow(/at least one test case/);
  });
});
