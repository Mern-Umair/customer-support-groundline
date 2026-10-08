import { NextResponse } from "next/server";
import { getApiContext, notFound, unauthorized } from "@/lib/auth/api";
import { getDb } from "@/lib/db";
import { evalRuns } from "@/lib/db/collections";
import { toResultDto, toRunDto } from "@/lib/evals/dto";
import { scoped, toObjectId } from "@/lib/tenant";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const { id } = await params;
  const runId = toObjectId(id);
  if (!runId) return notFound();
  const run = await evalRuns(await getDb()).findOne(scoped(ctx.workspace._id, { _id: runId }));
  if (!run) return notFound();
  return NextResponse.json({ run: toRunDto(run), results: run.results.map(toResultDto) });
}
