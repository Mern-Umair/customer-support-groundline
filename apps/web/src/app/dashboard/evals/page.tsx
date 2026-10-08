import type { Metadata } from "next";
import { getCurrentContext } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { evalCases, evalRuns, workspaces } from "@/lib/db/collections";
import { getJudge } from "@/lib/evals/context";
import { toCaseDto, toRunDto } from "@/lib/evals/dto";
import { getChatProvider } from "@/lib/llm/provider";
import { scoped } from "@/lib/tenant";
import { EvalsPanel } from "./evals-panel";

export const metadata: Metadata = { title: "Evals · Groundline" };

export default async function EvalsPage() {
  const ctx = await getCurrentContext();
  const db = await getDb();
  const [cases, runs, ws] = await Promise.all([
    evalCases(db).find(scoped(ctx.workspace._id)).sort({ createdAt: 1 }).toArray(),
    evalRuns(db).find(scoped(ctx.workspace._id), { projection: { results: 0 }, sort: { startedAt: -1 }, limit: 20 }).toArray(),
    workspaces(db).findOne({ _id: ctx.workspace._id }, { projection: { evalsPublic: 1 } }),
  ]);
  const llm = getChatProvider();
  const judge = getJudge();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">Evals</h1>
      <p className="mt-1 text-sm text-fg-muted">
        A fixed set of questions with reference answers. Every run asks all of them, checks refusals and citations deterministically, and has a judge model grade correctness. Numbers are stored per run so you can see regressions.
      </p>
      <EvalsPanel
        initialCases={cases.map(toCaseDto)}
        initialRuns={runs.map((r) => toRunDto({ ...r, results: [] }))}
        evalsPublic={Boolean(ws?.evalsPublic)}
        slug={ctx.workspace.slug}
        isOwner={ctx.role === "owner"}
        config={{ chat: `${llm.provider} · ${llm.model}`, judge: `${judge.provider} · ${judge.model}`, offline: llm.provider === "fake" || judge.provider === "fake" }}
      />
    </div>
  );
}
