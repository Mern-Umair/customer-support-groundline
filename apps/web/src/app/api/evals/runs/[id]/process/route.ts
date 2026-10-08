import { NextResponse } from "next/server";
import { getApiContext, notFound, unauthorized } from "@/lib/auth/api";
import { evalContextFrom } from "@/lib/evals/context";
import { EvalError, processRun } from "@/lib/evals/runner";
import { toObjectId } from "@/lib/tenant";

export const maxDuration = 60;

/** Evaluates cases for up to ~25s and returns progress; the client calls again until done. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const { id } = await params;
  const runId = toObjectId(id);
  if (!runId) return notFound();
  try {
    return NextResponse.json(await processRun(await evalContextFrom(ctx), runId, 25_000));
  } catch (err) {
    if (err instanceof EvalError) return notFound();
    throw err;
  }
}
