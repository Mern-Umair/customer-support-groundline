import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentContext } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { evalRuns } from "@/lib/db/collections";
import { toResultDto, toRunDto } from "@/lib/evals/dto";
import { scoped, toObjectId } from "@/lib/tenant";
import { RunView } from "./run-view";

export default async function EvalRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const runId = toObjectId(id);
  if (!runId) notFound();
  const ctx = await getCurrentContext();
  const run = await evalRuns(await getDb()).findOne(scoped(ctx.workspace._id, { _id: runId }));
  if (!run) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard/evals" className="text-sm text-fg-muted hover:text-fg">
        ← Evals
      </Link>
      <RunView initialRun={toRunDto(run)} initialResults={run.results.map(toResultDto)} />
    </div>
  );
}
