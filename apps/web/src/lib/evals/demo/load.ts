import { ObjectId, type Db } from "mongodb";
import { evalCases, sources } from "../../db/collections";
import type { EvalCaseDoc } from "../../db/types";
import type { PipelineContext } from "../../ingest/pipeline";
import { createTextSource, processSource } from "../../ingest/pipeline";
import { scoped } from "../../tenant";
import { DEMO_CASES } from "./cases";
import { DEMO_DOCS } from "./docs";

export interface LoadDemoResult {
  sourcesCreated: number;
  casesCreated: number;
}

/**
 * Adds the Ali Shoes documents as text sources (indexed immediately) and the 40 cases.
 * Idempotent per workspace: documents and cases that already exist by name/question are skipped.
 */
export async function loadDemoSet(pc: PipelineContext, opts: { indexNow?: boolean } = {}): Promise<LoadDemoResult> {
  const existingSources = new Set((await sources(pc.db).find(scoped(pc.workspaceId), { projection: { name: 1 } }).toArray()).map((s) => s.name));
  let sourcesCreated = 0;
  for (const doc of DEMO_DOCS) {
    if (existingSources.has(doc.name)) continue;
    const src = await createTextSource(pc, doc.name, doc.text);
    sourcesCreated += 1;
    if (opts.indexNow !== false) {
      let r = await processSource(pc, src._id, { budgetMs: 20_000 });
      while (r.status === "processing") r = await processSource(pc, src._id, { budgetMs: 20_000 });
    }
  }
  const casesCreated = await insertCases(pc.db, pc.workspaceId, DEMO_CASES);
  return { sourcesCreated, casesCreated };
}

export async function insertCases(db: Db, workspaceId: ObjectId, cases: Omit<EvalCaseDoc, "_id" | "workspaceId" | "createdAt" | "updatedAt">[]): Promise<number> {
  const existing = new Set((await evalCases(db).find(scoped(workspaceId), { projection: { question: 1 } }).toArray()).map((c) => c.question.trim().toLowerCase()));
  const now = new Date();
  const fresh = cases.filter((c) => !existing.has(c.question.trim().toLowerCase()));
  if (!fresh.length) return 0;
  await evalCases(db).insertMany(fresh.map((c) => ({ _id: new ObjectId(), workspaceId, createdAt: now, updatedAt: now, ...c })));
  return fresh.length;
}
