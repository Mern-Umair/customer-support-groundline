import { NextResponse } from "next/server";
import { badRequest, getApiContext, unauthorized } from "@/lib/auth/api";
import { forbidden, isOwner } from "@/lib/auth/roles";
import { getDb } from "@/lib/db";
import { evalRuns } from "@/lib/db/collections";
import { evalContextFrom } from "@/lib/evals/context";
import { toRunDto } from "@/lib/evals/dto";
import { createRun, EvalError } from "@/lib/evals/runner";
import { scoped } from "@/lib/tenant";

export async function GET() {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const db = await getDb();
  const list = await evalRuns(db).find(scoped(ctx.workspace._id), { projection: { results: 0 }, sort: { startedAt: -1 }, limit: 50 }).toArray();
  return NextResponse.json({ runs: list.map((r) => toRunDto({ ...r, results: [] })) });
}

/** Starts a run (or returns the one already running). The client then calls /process until done. */
export async function POST() {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  if (!isOwner(ctx)) return forbidden();
  try {
    const run = await createRun(await evalContextFrom(ctx));
    return NextResponse.json({ run: toRunDto(run) }, { status: 201 });
  } catch (err) {
    if (err instanceof EvalError) return badRequest(err.message);
    throw err;
  }
}
